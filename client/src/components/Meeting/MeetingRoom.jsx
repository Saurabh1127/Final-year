import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import useSpeechTranslation from '../../hooks/useSpeechTranslation';
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

  // ── Translation feature states ──────────────────────────────────────────────
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [subtitle, setSubtitle] = useState(null);        // { speakerName, originalText, translatedText, lang }
  const [transcriptLog, setTranscriptLog] = useState([]); // Live sidebar entries
  const [showTranscript, setShowTranscript] = useState(false);
  const subtitleTimeoutRef = useRef(null);

  // Remote <video> elements tracked by WebRTC for audio ducking
  const remoteVideoRefs = useRef([]);                    // populated via ParticipantGrid refs

  const echoAudioRef = useRef(null);
  const joinedRef = useRef(false);

  // Audio/Video capture
  const { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error: mediaError } = useAudioCapture();
  
  // WebRTC — only pass localStream once it's ready
  const { remoteStreams, removePeerConnection } = useWebRTC(localStream, user?.id);

  // ── Subtitle callback: show for 4 seconds then fade ─────────────────────────
  const handleSubtitle = useCallback((sub) => {
    setSubtitle(sub);
    clearTimeout(subtitleTimeoutRef.current);
    subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), 4000);
  }, []);

  // ── Transcript callback: prepend to sidebar log ──────────────────────────────
  const handleTranscriptEntry = useCallback((entry) => {
    setTranscriptLog((prev) => [entry, ...prev].slice(0, 200)); // keep last 200 entries
  }, []);

  // ── Socket.IO: receive transcripts from other participants ───────────────────
  useEffect(() => {
    if (!socket) return;
    const handleNewTranscript = (entry) => {
      if (entry.speakerId !== user?.id) {
        handleTranscriptEntry(entry);
      }
    };
    socket.on('new-transcript', handleNewTranscript);
    return () => socket.off('new-transcript', handleNewTranscript);
  }, [socket, user?.id, handleTranscriptEntry]);

  // ── Speech Translation hook (VAD-powered) ───────────────────────────────────
  const { isTranslating, startTranslation, stopTranslation } = useSpeechTranslation({
    meetingId: roomCode,
    userId: user?.id,
    speakerName: user?.name || 'Me',
    targetLanguages: [user?.preferredLanguage || 'hi', 'en'].filter(
      (l, i, arr) => arr.indexOf(l) === i  // deduplicate
    ),
    remoteAudioRefs: remoteVideoRefs.current,
    onSubtitle: handleSubtitle,
    onTranscriptEntry: handleTranscriptEntry,
    enabled: translationEnabled,
  });

  // Start/stop translation when toggle changes
  useEffect(() => {
    if (translationEnabled) {
      startTranslation();
    } else {
      stopTranslation();
    }
  }, [translationEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranslation();
      clearTimeout(subtitleTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    navigate(`/summary/${roomCode}`);
  };

  if (error || mediaError) {
    return (
      <div className="meeting-error">
        <div className="alert alert-error">{error || mediaError}</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Return to Home</button>
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

        {/* Translation & Transcript Toggles */}
        <div className="meeting-header-actions">
          <button
            id="btn-toggle-translation"
            className={`btn btn-sm ${translationEnabled ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setTranslationEnabled(prev => !prev)}
            title={translationEnabled ? 'Stop live translation' : 'Start live AI translation'}
          >
            {isTranslating ? '🔴 Translating...' : translationEnabled ? '⏹ Stop Translation' : '🌐 Start Translation'}
          </button>
          <button
            id="btn-toggle-transcript"
            className={`btn btn-sm ${showTranscript ? 'btn-secondary' : 'btn-outline'}`}
            onClick={() => setShowTranscript(prev => !prev)}
            title="Toggle transcript sidebar"
          >
            📝 Transcript {transcriptLog.length > 0 && `(${transcriptLog.length})`}
          </button>
        </div>
      </div>

      <div className="meeting-content">
        <ParticipantGrid 
          participants={participants} 
          remoteStreams={remoteStreams} 
          localParticipant={localParticipant}
          localStream={localStream}
        />

        {/* ── Live Transcript Sidebar ───────────────────────────────────────── */}
        {showTranscript && (
          <aside className="transcript-sidebar" id="transcript-sidebar">
            <div className="transcript-sidebar-header">
              <h3>📝 Live Transcript</h3>
              <button
                className="transcript-sidebar-close"
                onClick={() => setShowTranscript(false)}
                aria-label="Close transcript"
              >
                ✕
              </button>
            </div>
            <div className="transcript-sidebar-body">
              {transcriptLog.length === 0 ? (
                <p className="transcript-empty">Transcript will appear here as people speak…</p>
              ) : (
                transcriptLog.map((entry, idx) => (
                  <div key={idx} className="transcript-entry">
                    <div className="transcript-entry-header">
                      <span className="transcript-speaker">{entry.speakerName}</span>
                      <span className="transcript-time">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="transcript-original">{entry.originalText}</p>
                    {entry.translations && Object.entries(entry.translations).map(([lang, text]) => (
                      <p key={lang} className="transcript-translated">
                        <span className="transcript-lang-badge">{lang.toUpperCase()}</span> {text}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Live Subtitle Overlay ─────────────────────────────────────────────── */}
      {subtitle && (
        <div className="subtitle-overlay" id="subtitle-overlay" aria-live="polite">
          <div className="subtitle-speaker">{subtitle.speakerName}</div>
          <p className="subtitle-original">{subtitle.originalText}</p>
          {subtitle.translatedText && subtitle.translatedText !== subtitle.originalText && (
            <p className="subtitle-translated">
              <span className="subtitle-lang-badge">{subtitle.lang?.toUpperCase()}</span>
              {subtitle.translatedText}
            </p>
          )}
        </div>
      )}

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
