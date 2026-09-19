import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import useSpeechTranslation from '../../hooks/useSpeechTranslation';
import useTranslationReceiver from '../../hooks/useTranslationReceiver';
import ParticipantGrid from './ParticipantGrid';
import ControlBar from './ControlBar';
import LanguageSelector from './LanguageSelector';
import PreJoinScreen from './PreJoinScreen';
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

  // ── Pre-join lobby state ──────────────────────────────────────────────────
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);

  // ── Local display name (supports rename) ─────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.name || 'Guest');

  // ── Host status ──────────────────────────────────────────────────────────
  const isHost = Boolean(
    meeting && user && (
      (meeting.hostId?._id ? meeting.hostId._id.toString() : meeting.hostId?.toString()) === user?.id?.toString()
    )
  );

  // ── Translation feature states ──────────────────────────────────────────────
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(user?.preferredLanguage || 'hi');
  const [subtitle, setSubtitle] = useState(null);        // { speakerName, originalText, translatedText, lang }
  const [transcriptLog, setTranscriptLog] = useState([]); // Live sidebar entries
  const [showTranscript, setShowTranscript] = useState(false);
  const subtitleTimeoutRef = useRef(null);

  // ── Copy-link toast state ─────────────────────────────────────────────────
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimeout = useRef(null);

  // ── Leave confirmation modal ──────────────────────────────────────────────
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Remote <video> elements tracked by WebRTC for audio ducking
  const remoteVideoRefs = useRef([]);                    // populated via ParticipantGrid refs

  const echoAudioRef = useRef(null);
  const joinedRef = useRef(false);

  // Audio/Video capture
  const { localStream, startCapture, stopCapture, isMuted, toggleMute, isVideoOff, toggleVideo, error: mediaError } = useAudioCapture();
  
  // WebRTC — only pass localStream once it's ready AND user has joined from lobby
  const { remoteStreams, removePeerConnection } = useWebRTC(
    hasJoinedLobby ? localStream : null,
    user?.id
  );

  // ── Subtitle callback: show with configurable duration (0 = keep alive until cleared) ──
  const handleSubtitle = useCallback((sub, duration = 4000) => {
    if (sub?.timing) {
      const now = Date.now();
      // Only measure from when speech was sent (flushTime) to when it was translated and reached the user
      const latencyMs = now - (sub.timing.flushTime || sub.timing.serverReceiveTime || now);
      const serverMs = (sub.timing.serverAiReturnTime && sub.timing.serverReceiveTime)
        ? (sub.timing.serverAiReturnTime - sub.timing.serverReceiveTime)
        : null;
      sub.displayLatency = (latencyMs / 1000).toFixed(2) + 's';
      console.log(`⏱️ [Translation & Delivery] ${sub.displayLatency}${serverMs ? ` | AI Engine: ${(serverMs / 1000).toFixed(2)}s` : ''}`);
    }
    setSubtitle(sub);
    clearTimeout(subtitleTimeoutRef.current);
    if (sub && duration > 0) {
      subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), duration);
    }
  }, []);

  // ── Transcript callback: prepend to sidebar log ──────────────────────────────
  const handleTranscriptEntry = useCallback((entry) => {
    setTranscriptLog((prev) => [entry, ...prev].slice(0, 200)); // keep last 200 entries
  }, []);

  // ── Socket.IO: receive transcripts from meeting ──────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleNewTranscript = (entry) => {
      handleTranscriptEntry(entry);
    };
    const handleSpeakerSubtitle = (sub) => {
      handleSubtitle(sub);
    };

    socket.on('new-transcript', handleNewTranscript);
    socket.on('speaker-subtitle', handleSpeakerSubtitle);

    return () => {
      socket.off('new-transcript', handleNewTranscript);
      socket.off('speaker-subtitle', handleSpeakerSubtitle);
    };
  }, [socket, handleTranscriptEntry, handleSubtitle]);

  // ── Speech Translation hook — sends audio-chunk to server via Socket.IO ─────
  const { isTranslating, error: translationError, startTranslation, stopTranslation } = useSpeechTranslation({
    stream: localStream,           // Pass the existing stream — no double getUserMedia
    roomCode,
    userId: user?.id,
    speakerName: displayName,
    isMuted,
    remoteAudioRefs: remoteVideoRefs.current,
    onSubtitle: handleSubtitle,
    onTranscriptEntry: handleTranscriptEntry,
    enabled: translationEnabled,
  });

  // ── Translation Receiver hook — plays incoming TTS from server ─────────────────────
  const { isReceiving, isPending } = useTranslationReceiver({
    remoteAudioRefs: remoteVideoRefs.current,
    onSubtitle: handleSubtitle,
    onTranscriptEntry: handleTranscriptEntry,
    enabled: translationEnabled,
  });

  // Start/stop translation when toggle changes (only when stream is ready)
  useEffect(() => {
    if (!localStream || !hasJoinedLobby) return;
    if (translationEnabled) {
      startTranslation();
    } else {
      stopTranslation();
    }
  }, [translationEnabled, localStream, hasJoinedLobby]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranslation();
      clearTimeout(subtitleTimeoutRef.current);
      clearTimeout(copyToastTimeout.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page Visibility (Tab Switching) Recovery (from upstream) ──────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👀 [Meeting] Tab became visible. Checking connection...');
        if (socket && !socket.connected) {
          console.log('🔄 [Meeting] Socket disconnected in background. Forcing reconnect...');
          socket.connect();
        } else if (socket && connected) {
          // Send a status update to ensure the server knows we're active
          socket.emit('toggle-media', { roomCode, userId: user?.id, isMuted, isVideoOff });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [socket, connected, roomCode, user, isMuted, isVideoOff]);

  // Echo test
  useEffect(() => {
    if (echoAudioRef.current && localStream && isEchoTestActive) {
      echoAudioRef.current.srcObject = localStream;
    }
    if (echoAudioRef.current && !isEchoTestActive) {
      echoAudioRef.current.srcObject = null;
    }
    return () => {
      if (echoAudioRef.current) {
        echoAudioRef.current.srcObject = null;
      }
    };
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

  // 2. Join the socket room ONLY after user has left the lobby
  useEffect(() => {
    if (!meeting || !socket || !connected || !localStream || joinedRef.current || !hasJoinedLobby) return;

    console.log('🚀 [Meeting] Joining room:', roomCode);
    socket.emit('join-meeting', {
      roomCode,
      userId: user.id,
      displayName: displayName,
      targetLanguage: targetLanguage || 'hi',
      isMuted,
      isVideoOff
    });
    joinedRef.current = true;
    setJoinedRoom(true);
  }, [meeting, socket, connected, localStream, roomCode, user, targetLanguage, isMuted, isVideoOff, hasJoinedLobby, displayName]);

  // 2b. Re-join room after socket reconnects (e.g. server restart)
  // IMPORTANT: use refs for all values read inside handleReconnect so this
  // effect only runs once (on mount). Putting state like isMuted/isVideoOff
  // in the dep array causes the listener to be torn down + re-created on every
  // mute toggle, which sometimes fires 'connect' twice and causes a disconnect loop.
  const reconnectValuesRef = useRef({ roomCode, user, displayName, targetLanguage, isMuted, isVideoOff });
  useEffect(() => {
    reconnectValuesRef.current = { roomCode, user, displayName, targetLanguage, isMuted, isVideoOff };
  }, [roomCode, user, displayName, targetLanguage, isMuted, isVideoOff]);

  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      if (!meeting || !localStream) return;
      const { roomCode: rc, user: u, displayName: dn, targetLanguage: tl, isMuted: im, isVideoOff: iv } = reconnectValuesRef.current;
      console.log('🔄 [Meeting] Socket reconnected — re-joining room:', rc);
      joinedRef.current = false;
      socket.emit('join-meeting', {
        roomCode: rc,
        userId: u.id,
        displayName: dn,
        targetLanguage: tl || 'hi',
        isMuted: im,
        isVideoOff: iv,
      });
      joinedRef.current = true;
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanguageChange = (newLang) => {
    setTargetLanguage(newLang);
    if (socket && connected && joinedRef.current) {
      socket.emit('update-language', { roomCode, targetLanguage: newLang });
    }
  };

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
      console.log('✅ [Meeting] Joined, existing participants:', initialParticipants?.length || 0);
      const myId = user?.id?.toString();
      const uniqueMap = new Map();
      for (const p of initialParticipants || []) {
        const pid = p.userId?.toString();
        // Never include self, and deduplicate remote participants by userId
        if (pid && pid !== myId && !uniqueMap.has(pid)) {
          uniqueMap.set(pid, p);
        }
      }
      setParticipants(Array.from(uniqueMap.values()));
    };

    const handleParticipantJoined = (newParticipant) => {
      const myId = user?.id?.toString();
      const newId = newParticipant?.userId?.toString();
      // NEVER add self to remote participants list
      if (!newId || newId === myId) {
        console.log('👤 [Meeting] Ignored self in participant-joined:', newParticipant?.displayName);
        return;
      }
      console.log('👤 [Meeting] Participant joined:', newParticipant.displayName);
      setParticipants(prev => {
        const filtered = prev.filter(p => p.userId?.toString() !== newId);
        return [...filtered, newParticipant];
      });
    };

    const handleParticipantLeft = ({ userId: leftUserId }) => {
      const leftId = leftUserId?.toString();
      console.log('👤 [Meeting] Participant left:', leftId);
      setParticipants(prev => prev.filter(p => p.userId?.toString() !== leftId));
      if (leftId) {
        removePeerConnection(leftId);
      }
    };

    const handleMediaChanged = ({ userId: changedUserId, isMuted: m, isVideoOff: v }) => {
      const targetId = changedUserId?.toString();
      setParticipants(prev => prev.map(p =>
        p.userId?.toString() === targetId ? { ...p, isMuted: m, isVideoOff: v } : p
      ));
    };

    // ── Handle remote participant rename ────────────────────────────────────
    const handleParticipantRenamed = ({ userId: renamedUserId, newDisplayName }) => {
      const targetId = renamedUserId?.toString();
      console.log(`✏️ [Meeting] ${targetId} renamed to "${newDisplayName}"`);
      setParticipants(prev => prev.map(p =>
        p.userId?.toString() === targetId ? { ...p, displayName: newDisplayName } : p
      ));
    };

    // ── Host ended meeting for everyone ─────────────────────────────────────
    const handleMeetingEnded = ({ message }) => {
      console.log('🛑 [Meeting] Meeting ended by host:', message);
      stopCapture();
      alert(message || 'The host has ended the meeting for all participants.');
      navigate(`/summary/${roomCode}`);
    };

    // ── Session replaced by another tab / window ───────────────────────────
    const handleSessionReplaced = ({ message }) => {
      console.warn('⚠️ [Meeting] Session replaced:', message);
      stopCapture();
      alert(message || 'You have joined this meeting from another tab or window.');
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

  // ── Feature: Copy meeting link ────────────────────────────────────────────
  const handleCopyLink = () => {
    const url = `${window.location.origin}/meeting/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      clearTimeout(copyToastTimeout.current);
      copyToastTimeout.current = setTimeout(() => setCopyToast(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopyToast(true);
      clearTimeout(copyToastTimeout.current);
      copyToastTimeout.current = setTimeout(() => setCopyToast(false), 2000);
    });
  };

  // ── Feature: End call with confirmation ───────────────────────────────────
  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const handleLeaveConfirm = () => {
    setShowLeaveModal(false);
    stopCapture();
    navigate(`/summary/${roomCode}`);
  };

  const handleEndMeetingForAll = () => {
    setShowLeaveModal(false);
    if (socket && connected) {
      console.log('👑 [Meeting] Host ending meeting for all:', roomCode);
      socket.emit('end-meeting', { roomCode });
    }
    stopCapture();
    navigate(`/summary/${roomCode}`);
  };

  const handleLeaveCancel = () => {
    setShowLeaveModal(false);
  };

  // ── Feature: Rename self ──────────────────────────────────────────────────
  const handleRename = (newName) => {
    setDisplayName(newName);
    if (socket && connected && joinedRef.current) {
      socket.emit('rename-participant', { roomCode, userId: user?.id, newDisplayName: newName });
    }
  };

  // ── Error states ──────────────────────────────────────────────────────────
  if (error || mediaError) {
    return (
      <div className="meeting-error">
        <div className="alert alert-error">{error || mediaError}</div>
        <button className="btn btn-primary" onClick={() => { stopCapture(); navigate('/'); }}>Return to Home</button>
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

  // ── Pre-join lobby ────────────────────────────────────────────────────────
  if (!hasJoinedLobby) {
    return (
      <PreJoinScreen
        roomCode={roomCode}
        userName={displayName}
        localStream={localStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
        onJoin={() => setHasJoinedLobby(true)}
      />
    );
  }

  // ── Main meeting room ─────────────────────────────────────────────────────
  const localParticipant = {
    userId: user.id,
    displayName: displayName,
    targetLanguage: targetLanguage || 'hi',
    isMuted,
    isVideoOff
  };

  const participantCount = 1 + participants.length; // self + remotes

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <div className="meeting-info">
          <h2>{meeting.title}</h2>

          {/* ── Room code + Copy Link ─────────────────────────────────────── */}
          <span
            className="meeting-code-badge meeting-code-copyable"
            onClick={handleCopyLink}
            title="Click to copy meeting link"
            id="btn-copy-link"
          >
            {roomCode}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginLeft: '6px', verticalAlign: 'middle' }}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </span>
          {copyToast && (
            <span className="copy-toast animate-fade-in" id="copy-toast">✓ Copied!</span>
          )}

          {/* ── Participant Count ─────────────────────────────────────────── */}
          <span className="participant-count-badge" id="participant-count">
            👥 {participantCount}
          </span>

          {/* ── Network Indicator ─────────────────────────────────────────── */}
          <span className={`network-indicator ${connected ? 'network-good' : 'network-bad'}`} id="network-indicator">
            <span className="network-dot"></span>
            {connected ? '' : 'Reconnecting…'}
          </span>
        </div>

        {/* Translation & Transcript Toggles */}
        <div className="meeting-header-actions">
          <LanguageSelector
            currentLanguage={targetLanguage}
            onChange={handleLanguageChange}
            disabled={isTranslating}
          />
          <button
            id="btn-toggle-translation"
            className={`btn btn-sm ${translationEnabled ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setTranslationEnabled(prev => !prev)}
            title={translationEnabled ? 'Stop live translation' : 'Start live AI translation'}
          >
          {isTranslating ? '🔴 Sending...' : isPending ? '⏳ Translating...' : isReceiving ? '🔊 Playing...' : translationEnabled ? '⏹ Stop Translation' : '🌐 Start Translation'}
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
          onRename={handleRename}
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
        <div
          className={`subtitle-overlay${subtitle.isPending ? ' subtitle-overlay--pending' : ''}`}
          id="subtitle-overlay"
          aria-live="polite"
        >
          <div className="subtitle-speaker">
            <span>{subtitle.speakerName}</span>
            {subtitle.displayLatency && !subtitle.isPending && (
              <span className="subtitle-latency-badge">⚡ {subtitle.displayLatency}</span>
            )}
            {subtitle.isPending && (
              <span className="subtitle-pending-badge">⏳ Processing…</span>
            )}
          </div>
          <p className={`subtitle-original${subtitle.isPending ? ' subtitle-original--pending' : ''}`}>
            {subtitle.originalText}
          </p>
          {!subtitle.isPending && subtitle.translatedText && subtitle.translatedText !== subtitle.originalText && (
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
        onLeave={handleLeaveClick} 
        isHost={isHost}
      />

      {/* ── Leave / End Meeting Confirmation Modal ────────────────────────────── */}
      {showLeaveModal && (
        <div className="leave-modal-overlay" id="leave-modal">
          <div className="leave-modal animate-fade-in">
            <h3>{isHost ? 'Leave or End Meeting?' : 'Leave this meeting?'}</h3>
            <p>
              {isHost
                ? 'As host, you can leave the meeting or end it for all participants.'
                : "You'll be redirected to the meeting summary page."}
            </p>
            <div className="leave-modal-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={handleLeaveCancel}
                id="btn-leave-cancel"
              >
                Cancel
              </button>
              <button
                className="btn btn-outline"
                onClick={handleLeaveConfirm}
                id="btn-leave-confirm"
              >
                Leave Meeting
              </button>
              {isHost && (
                <button
                  className="btn btn-danger"
                  onClick={handleEndMeetingForAll}
                  id="btn-end-meeting-all"
                >
                  End Meeting for All
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
