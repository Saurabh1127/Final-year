import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import ParticipantGrid from './ParticipantGrid';
import ControlBar from './ControlBar';
import api from '../../services/api';

const MeetingRoom = ({ roomCode }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [isEchoTestActive, setIsEchoTestActive] = useState(false);
  const echoAudioRef = useRef(null);
  const joinedRef = useRef(false); // Prevents double-join

  // Audio/Video capture
  const { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error: mediaError } = useAudioCapture();
  
  // WebRTC — only pass localStream once it's ready
  const { remoteStreams, removePeerConnection } = useWebRTC(localStream, user?.id);

  // Echo test
  useEffect(() => {
    if (echoAudioRef.current && localStream && isEchoTestActive) {
      echoAudioRef.current.srcObject = localStream;
    }
    if (echoAudioRef.current && !isEchoTestActive) {
      echoAudioRef.current.srcObject = null;
    }
  }, [localStream, isEchoTestActive]);

  // 1. Fetch meeting data + start media capture (runs once on mount)
  useEffect(() => {
    let mounted = true;

    api.get(`/meetings/${roomCode}`)
      .then(res => { if (mounted) setMeeting(res.data); })
      .catch(err => {
        if (mounted) setError(err.response?.data?.message || 'Failed to join meeting.');
      });

    startCapture(true);

    return () => {
      mounted = false;
      stopCapture();
    };
  }, [roomCode, startCapture, stopCapture]);

  // 2. Join the socket room ONLY after we have meeting data + local media
  useEffect(() => {
    if (!meeting || !socket || !connected || !localStream || joinedRef.current) return;

    console.log('🚀 [Meeting] Joining room:', roomCode);
    socket.emit('join-meeting', {
      roomCode,
      userId: user.id,
      displayName: user.name,
      targetLanguage: user.preferredLanguage || 'en',
      isMuted,
      isVideoOff
    });
    joinedRef.current = true;
    setJoinedRoom(true);
  }, [meeting, socket, connected, localStream, roomCode, user, isMuted, isVideoOff]);

  // 3. Leave room on unmount
  useEffect(() => {
    return () => {
      if (socket && joinedRef.current) {
        console.log('👋 [Meeting] Leaving room:', roomCode);
        socket.emit('leave-meeting', { roomCode, userId: user?.id });
        joinedRef.current = false;
      }
    };
  }, [socket, roomCode, user?.id]);

  // 4. Broadcast mute/video changes to other participants
  useEffect(() => {
    if (socket && connected && joinedRef.current) {
      socket.emit('toggle-media', { roomCode, userId: user?.id, isMuted, isVideoOff });
    }
  }, [isMuted, isVideoOff, socket, connected, roomCode, user]);

  // 5. Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleMeetingJoined = ({ participants: initialParticipants }) => {
      console.log('✅ [Meeting] Joined, existing participants:', initialParticipants.length);
      setParticipants(initialParticipants.filter(p => p.userId !== user.id));
    };

    const handleParticipantJoined = (newParticipant) => {
      console.log('👤 [Meeting] Participant joined:', newParticipant.displayName);
      setParticipants(prev => {
        const filtered = prev.filter(p => p.userId !== newParticipant.userId);
        return [...filtered, newParticipant];
      });
    };

    const handleParticipantLeft = ({ userId: leftUserId }) => {
      console.log('👤 [Meeting] Participant left:', leftUserId);
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      removePeerConnection(leftUserId);
    };

    const handleMediaChanged = ({ userId: changedUserId, isMuted: m, isVideoOff: v }) => {
      setParticipants(prev => prev.map(p =>
        p.userId === changedUserId ? { ...p, isMuted: m, isVideoOff: v } : p
      ));
    };

    socket.on('meeting-joined', handleMeetingJoined);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-media-changed', handleMediaChanged);

    return () => {
      socket.off('meeting-joined', handleMeetingJoined);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-media-changed', handleMediaChanged);
    };
  }, [socket, user, removePeerConnection]);

  const handleLeave = () => {
    navigate('/');
  };

  if (error || mediaError) {
    return (
      <div className="meeting-error">
        <div className="alert alert-error">{error || mediaError}</div>
        <button className="btn btn-primary" onClick={handleLeave}>Return to Home</button>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Joining meeting...</p>
      </div>
    );
  }

  const localParticipant = {
    userId: user.id,
    displayName: user.name,
    targetLanguage: user.preferredLanguage || 'en',
    isMuted,
    isVideoOff
  };

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <div className="meeting-info">
          <h2>{meeting.title}</h2>
          <span className="meeting-code-badge">{roomCode}</span>
        </div>
      </div>

      <div className="meeting-content">
        <ParticipantGrid 
          participants={participants} 
          remoteStreams={remoteStreams} 
          localParticipant={localParticipant}
          localStream={localStream}
        />
      </div>

      {isEchoTestActive && <audio ref={echoAudioRef} autoPlay playsInline />}

      <ControlBar 
        isMuted={isMuted} 
        toggleMute={toggleMute} 
        isVideoOff={isVideoOff}
        toggleVideo={toggleVideo}
        isEchoTestActive={isEchoTestActive}
        toggleEchoTest={() => setIsEchoTestActive(prev => !prev)}
        onLeave={handleLeave} 
      />
    </div>
  );
};

export default MeetingRoom;
