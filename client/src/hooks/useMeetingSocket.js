import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useMeetingSocket
 * Handles meeting data retrieval, socket room lifecycle, WebRTC participant synchronization,
 * tab visibility recovery, and host session actions.
 */
export function useMeetingSocket({
  socket,
  connected,
  roomCode,
  user,
  displayName,
  targetLanguage,
  isMuted,
  isVideoOff,
  hasJoinedLobby,
  localStream,
  removePeerConnection,
  stopCapture,
  navigate,
}) {
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const joinedRef = useRef(false);

  // 1. Fetch meeting metadata
  useEffect(() => {
    let mounted = true;
    api.get(`/meetings/${roomCode}`)
      .then((res) => {
        if (mounted) setMeeting(res.data);
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || 'Failed to join meeting.');
      });

    return () => {
      mounted = false;
    };
  }, [roomCode]);

  // 2. Join socket room once past the lobby and stream is ready
  useEffect(() => {
    if (!meeting || !socket || !connected || !localStream || joinedRef.current || !hasJoinedLobby) return;
    socket.emit('join-meeting', {
      roomCode,
      userId: user.id,
      displayName,
      targetLanguage: targetLanguage || 'hi',
      isMuted,
      isVideoOff,
    });
    joinedRef.current = true;
  }, [meeting, socket, connected, localStream, roomCode, user, targetLanguage, isMuted, isVideoOff, hasJoinedLobby, displayName]);

  // 3. Socket reconnection handler
  const reconnectValuesRef = useRef({ roomCode, user, displayName, targetLanguage, isMuted, isVideoOff });
  useEffect(() => {
    reconnectValuesRef.current = { roomCode, user, displayName, targetLanguage, isMuted, isVideoOff };
  }, [roomCode, user, displayName, targetLanguage, isMuted, isVideoOff]);

  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => {
      if (!meeting || !localStream) return;
      const { roomCode: rc, user: u, displayName: dn, targetLanguage: tl, isMuted: im, isVideoOff: iv } = reconnectValuesRef.current;
      joinedRef.current = false;
      socket.emit('join-meeting', { roomCode: rc, userId: u.id, displayName: dn, targetLanguage: tl || 'hi', isMuted: im, isVideoOff: iv });
      joinedRef.current = true;
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [socket, meeting, localStream]);

  // 4. Leave meeting cleanup
  useEffect(() => {
    return () => {
      if (socket && joinedRef.current) {
        socket.emit('leave-meeting', { roomCode, userId: user?.id });
        joinedRef.current = false;
      }
    };
  }, [socket, roomCode, user?.id]);

  // 5. Broadcast media mute/video toggles
  useEffect(() => {
    if (socket && connected && joinedRef.current) {
      socket.emit('toggle-media', { roomCode, userId: user?.id, isMuted, isVideoOff });
    }
  }, [isMuted, isVideoOff, socket, connected, roomCode, user]);

  // 6. Tab visibility recovery
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (socket && !socket.connected) socket.connect();
        else if (socket && connected) {
          socket.emit('toggle-media', { roomCode, userId: user?.id, isMuted, isVideoOff });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [socket, connected, roomCode, user, isMuted, isVideoOff]);

  // 7. Participant & room event handlers
  useEffect(() => {
    if (!socket) return;
    const myId = user?.id?.toString();

    const handleMeetingJoined = ({ participants: initialParticipants }) => {
      const map = new Map();
      for (const p of initialParticipants || []) {
        const pid = p.userId?.toString();
        if (pid && pid !== myId && !map.has(pid)) map.set(pid, p);
      }
      setParticipants(Array.from(map.values()));
    };

    const handleParticipantJoined = (p) => {
      const pid = p?.userId?.toString();
      if (!pid || pid === myId) return;
      setParticipants((prev) => [...prev.filter((item) => item.userId?.toString() !== pid), p]);
    };

    const handleParticipantLeft = ({ userId: leftId }) => {
      const pid = leftId?.toString();
      setParticipants((prev) => prev.filter((p) => p.userId?.toString() !== pid));
      if (pid && removePeerConnection) removePeerConnection(pid);
    };

    const handleMediaChanged = ({ userId: changedId, isMuted: m, isVideoOff: v }) => {
      const pid = changedId?.toString();
      setParticipants((prev) => prev.map((p) => (p.userId?.toString() === pid ? { ...p, isMuted: m, isVideoOff: v } : p)));
    };

    const handleParticipantRenamed = ({ userId: rId, newDisplayName: nName }) => {
      const pid = rId?.toString();
      setParticipants((prev) => prev.map((p) => (p.userId?.toString() === pid ? { ...p, displayName: nName } : p)));
    };

    const handleMeetingEnded = ({ message }) => {
      if (stopCapture) stopCapture();
      alert(message || 'The host has ended the meeting for all participants.');
      navigate(`/summary/${roomCode}`);
    };

    const handleSessionReplaced = ({ message }) => {
      if (stopCapture) stopCapture();
      alert(message || 'You joined this meeting from another window.');
      navigate('/');
    };

    socket.on('meeting-joined', handleMeetingJoined);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-media-changed', handleMediaChanged);
    socket.on('participant-renamed', handleParticipantRenamed);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('session-replaced', handleSessionReplaced);

    return () => {
      socket.off('meeting-joined', handleMeetingJoined);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-media-changed', handleMediaChanged);
      socket.off('participant-renamed', handleParticipantRenamed);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('session-replaced', handleSessionReplaced);
    };
  }, [socket, user, removePeerConnection, navigate, roomCode, stopCapture]);

  const handleRename = useCallback((newName) => {
    if (socket && connected && joinedRef.current) {
      socket.emit('rename-participant', { roomCode, userId: user?.id, newDisplayName: newName });
    }
  }, [socket, connected, roomCode, user]);

  const handleLanguageChange = useCallback((newLang) => {
    if (socket && connected && joinedRef.current) {
      socket.emit('update-language', { roomCode, targetLanguage: newLang });
    }
  }, [socket, connected, roomCode]);

  const handleEndMeetingForAll = useCallback(() => {
    if (socket && connected) {
      socket.emit('end-meeting', { roomCode });
    }
  }, [socket, connected, roomCode]);

  return {
    meeting,
    participants,
    error,
    handleRename,
    handleLanguageChange,
    handleEndMeetingForAll,
  };
}

export default useMeetingSocket;
