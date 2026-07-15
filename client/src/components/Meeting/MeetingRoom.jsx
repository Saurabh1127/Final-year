import React, { useEffect, useState } from 'react';
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
  const echoAudioRef = React.useRef(null);

  // Audio/Video capture
  const { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error: mediaError } = useAudioCapture();
  
  // Apply local stream to echo test audio element when activated
  React.useEffect(() => {
    if (echoAudioRef.current && localStream && isEchoTestActive) {
      echoAudioRef.current.srcObject = localStream;
    }
  }, [localStream, isEchoTestActive]);

  // WebRTC
  const { remoteStreams, removePeerConnection } = useWebRTC(localStream, user?.id);

  // Fetch meeting details and start media capture on mount
  useEffect(() => {
    let mounted = true;
    
    api.get(`/meetings/${roomCode}`)
      .then(res => {
        if (mounted) setMeeting(res.data);
      })
      .catch(err => {
        if (mounted) setError(err.response?.data?.message || 'Failed to join meeting.');
      });

    // Start capture with video enabled by default
    startCapture(true);

    return () => {
      mounted = false;
      stopCapture();
    };
  }, [roomCode, startCapture, stopCapture]);

  // Join socket room only AFTER we have the local media stream and meeting data
  useEffect(() => {
    if (meeting && socket && connected && localStream && !joinedRoom) {
      socket.emit('join-meeting', {
        roomCode,
        userId: user.id,
        displayName: user.name,
        targetLanguage: user.preferredLanguage || 'en',
        isMuted,
        isVideoOff
      });
      setJoinedRoom(true);
    }
  }, [meeting, socket, connected, localStream, joinedRoom, roomCode, user, isMuted, isVideoOff]);

  // Leave meeting on unmount
  useEffect(() => {
    return () => {
      if (socket && joinedRoom) {
        socket.emit('leave-meeting', { roomCode, userId: user?.id });
      }
    };
  }, [socket, joinedRoom, roomCode, user?.id]);

  // Broadcast media state changes to others
  useEffect(() => {
    if (socket && connected && meeting && joinedRoom) {
      socket.emit('toggle-media', { roomCode, userId: user?.id, isMuted, isVideoOff });
    }
  }, [isMuted, isVideoOff, socket, connected, roomCode, user, meeting, joinedRoom]);

  // Socket event listeners for participant changes
  useEffect(() => {
    if (!socket) return;

    const handleMeetingJoined = ({ participants: initialParticipants }) => {
      setParticipants(initialParticipants.filter(p => p.userId !== user.id));
    };

    const handleParticipantJoined = (newParticipant) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => p.userId !== newParticipant.userId);
        return [...filtered, newParticipant];
      });
    };

    const handleParticipantLeft = ({ userId: leftUserId }) => {
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      removePeerConnection(leftUserId);
    };

    const handleMediaChanged = ({ userId: changedUserId, isMuted: changedMuted, isVideoOff: changedVideoOff }) => {
      setParticipants(prev => prev.map(p => {
        if (p.userId === changedUserId) {
          return { ...p, isMuted: changedMuted, isVideoOff: changedVideoOff };
        }
        return p;
      }));
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
        toggleEchoTest={() => setIsEchoTestActive(!isEchoTestActive)}
        onLeave={handleLeave} 
      />
    </div>
  );
};

export default MeetingRoom;
