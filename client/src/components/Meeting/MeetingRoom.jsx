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
import PipelineInspectorModal from './PipelineInspectorModal';
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
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [subtitle, setSubtitle] = useState(null);        // { speakerName, originalText, translatedText, lang }
  const [translatingFor, setTranslatingFor] = useState(null); // speakerName while AI is processing
  const [transcriptLog, setTranscriptLog] = useState([]); // Live sidebar entries
  const [showTranscript, setShowTranscript] = useState(false);
  const subtitleTimeoutRef = useRef(null);

  // ── Diagnostics Inspector state ───────────────────────────────────────────
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState(null);
  const [latestDiagnostics, setLatestDiagnostics] = useState(null);

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

  // ── Subtitle callback: duration=0 means keep until explicitly replaced/cleared ──
  const handleSubtitle = useCallback((sub, duration = 4000) => {
    if (!sub) {
      // Explicit clear
      setSubtitle(null);
      clearTimeout(subtitleTimeoutRef.current);
      return;
    }
    if (sub.isPending) {
      // 'Translating...' — update the separate indicator, do NOT touch the current subtitle
      setTranslatingFor(sub.speakerName || null);
      return;
    }
    // Real subtitle — clear the translating indicator and show subtitle
    setTranslatingFor(null);
    if (sub?.timing) {
      const now = Date.now();
      const latencyMs = now - (sub.timing.flushTime || sub.timing.serverReceiveTime || now);
      const serverMs = (sub.timing.serverAiReturnTime && sub.timing.serverReceiveTime)
        ? (sub.timing.serverAiReturnTime - sub.timing.serverReceiveTime)
        : null;
      sub.displayLatency = (latencyMs / 1000).toFixed(2) + 's';
      console.log(`⏱️ [Translation & Delivery] ${sub.displayLatency}${serverMs ? ` | AI Engine: ${(serverMs / 1000).toFixed(2)}s` : ''}`);
    }
    if (sub?.diagnostics) {
      setLatestDiagnostics(sub);
    }
    setSubtitle(sub);
    clearTimeout(subtitleTimeoutRef.current);
    if (duration > 0) {
      subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), duration);
    }
  }, []);

  // ── Transcript callback: prepend to sidebar log ──────────────────────────────
  const handleTranscriptEntry = useCallback((entry) => {
    setTranscriptLog((prev) => [entry, ...prev].slice(0, 200)); // keep last 200 entries
    if (entry?.diagnostics) {
      setLatestDiagnostics(entry);
    }
  }, []);

  // ── Socket.IO: receive transcripts from meeting ──────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleNewTranscript = (entry) => {
      handleTranscriptEntry(entry);
    };
    const handleSpeakerSubtitle = (sub) => {
      handleSubtitle(sub);
      if (sub?.diagnostics) {
        setLatestDiagnostics(sub);
      }
    };
    const handleTranslationDiagnostics = (diagEvent) => {
      if (diagEvent?.diagnostics) {
        setLatestDiagnostics(prev => ({
          ...(prev || {}),
          ...diagEvent
        }));
      }
    };

    socket.on('new-transcript', handleNewTranscript);
    socket.on('speaker-subtitle', handleSpeakerSubtitle);
    socket.on('translation-diagnostics', handleTranslationDiagnostics);

    return () => {
      socket.off('new-transcript', handleNewTranscript);
      socket.off('speaker-subtitle', handleSpeakerSubtitle);
      socket.off('translation-diagnostics', handleTranslationDiagnostics);
    };
  }, [socket, handleTranscriptEntry, handleSubtitle]);

  // ── Speech Translation hook — sends audio-chunk to server via Socket.IO ─────
  const { isTranslating, error: translationError, startTranslation, stopTranslation } = useSpeechTranslation({
    stream: localStream,           // Pass the existing stream — no double getUserMedia
    roomCode,
    userId: user?.id,
    speakerName: displayName,
    sourceLanguage,
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
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#090a0f] text-slate-100 font-sans">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="z-30 w-full shrink-0 p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="bg-black/70 backdrop-blur-xl px-3.5 py-2 rounded-2xl flex items-center gap-3 border border-white/10 shadow-lg shrink-0">
            <h2 className="text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[200px]">{meeting.title}</h2>

            {/* Room code + Copy Link */}
            <span
              className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-200 cursor-pointer flex items-center gap-1.5 transition select-none"
              onClick={handleCopyLink}
              title="Click to copy meeting link"
              id="btn-copy-link"
            >
              {roomCode}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </span>
            {copyToast && (
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-fade-in flex items-center gap-1" id="copy-toast">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied!</span>
              </span>
            )}

            {/* Participant Count */}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#00d4b2]/15 text-[#00d4b2] border border-[#00d4b2]/30 flex items-center gap-1.5" id="participant-count">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{participantCount}</span>
            </span>

            {/* Network Indicator */}
            <span className="flex items-center gap-1.5 text-[11px]" id="network-indicator">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'}`}></span>
              {connected ? '' : <span className="text-rose-400 hidden sm:inline">Reconnecting…</span>}
            </span>
          </div>

          {/* Translation & Diagnostics Toggles */}
          <div className="flex items-center gap-2 flex-wrap bg-black/60 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl border border-white/10 shadow-lg">
            <LanguageSelector
              currentLanguage={sourceLanguage}
              onChange={setSourceLanguage}
              disabled={isTranslating}
              label="Speaking:"
              includeAuto={true}
            />
            <LanguageSelector
              currentLanguage={targetLanguage}
              onChange={handleLanguageChange}
              disabled={isTranslating}
              label="To:"
            />
            <button
              id="btn-toggle-translation"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                translationEnabled 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30' 
                  : 'bg-[#00d4b2] hover:bg-[#33e0c4] text-slate-950 shadow-[#00d4b2]/20'
              }`}
              onClick={() => setTranslationEnabled(prev => !prev)}
              title={translationEnabled ? 'Stop live translation' : 'Start live AI translation'}
            >
              {isTranslating ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Sending…</span>
                </>
              ) : isPending ? (
                <>
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Translating…</span>
                </>
              ) : isReceiving ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <span>Playing…</span>
                </>
              ) : translationEnabled ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>Translate</span>
                </>
              )}
            </button>
            <button
              id="btn-toggle-transcript"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white whitespace-nowrap shrink-0 flex items-center gap-1.5"
              onClick={() => setShowTranscript(prev => !prev)}
              title="Toggle transcript sidebar"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Transcript {transcriptLog.length > 0 ? `(${transcriptLog.length})` : ''}</span>
            </button>
            <button
              id="btn-toggle-diagnostics"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5"
              onClick={() => {
                setSelectedDiagnostics(latestDiagnostics || {
                  speakerName: displayName,
                  originalText: 'No utterances analyzed yet.',
                  diagnostics: {
                    status: 'healthy',
                    primary_remedy: 'Speak into your microphone with live translation enabled to see stage-by-stage diagnostics.',
                    warnings: [],
                    stt: {},
                    nmt: {},
                    tts: {},
                    vad: {}
                  }
                });
                setShowDiagnosticsModal(true);
              }}
              title="Inspect Translation Pipeline Diagnostics"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="hidden sm:inline">Diagnostics</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Meeting Content ────────────────────────────────────────── */}
      <div className="flex-1 flex pb-24 px-3 sm:px-6 overflow-hidden relative">
        <ParticipantGrid 
          participants={participants} 
          remoteStreams={remoteStreams} 
          localParticipant={localParticipant}
          localStream={localStream}
          onRename={handleRename}
        />

        {/* Live Transcript Sidebar */}
        {showTranscript && (
          <aside className="w-80 sm:w-96 bg-[#0e1017]/95 border-l border-white/10 backdrop-blur-2xl flex flex-col fixed right-0 top-0 bottom-0 z-40 shadow-2xl animate-fade-in" id="transcript-sidebar">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00d4b2]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Live Meeting Transcript</span>
              </h3>
              <button
                className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white flex items-center justify-center transition"
                onClick={() => setShowTranscript(false)}
                aria-label="Close transcript"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {transcriptLog.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Transcript will appear here as participants speak…</p>
              ) : (
                transcriptLog.map((entry, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-bold text-[#00d4b2]">{entry.speakerName}</span>
                      <div className="flex items-center gap-2">
                        {entry.diagnostics && (
                          <button
                            type="button"
                            className="text-xs opacity-70 hover:opacity-100 transition p-1 text-slate-400 hover:text-[#00d4b2]"
                            onClick={() => {
                              setSelectedDiagnostics(entry);
                              setShowDiagnosticsModal(true);
                            }}
                            title="Inspect pipeline diagnostics"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-[11px] text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 mb-1">{entry.originalText}</p>
                    {entry.translations && Object.entries(entry.translations).map(([lang, text]) => (
                      <p key={lang} className="text-xs text-slate-400 pl-2 border-l border-white/10 mt-1">
                        <span className="font-mono text-[10px] text-[#38bdf8] uppercase font-bold mr-1">[{lang}]</span> {text}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Translating Indicator ────────────────────────────────────────── */}
      {translatingFor && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#00d4b2]/15 border border-[#00d4b2]/30 text-[#00d4b2] text-xs font-semibold backdrop-blur-md flex items-center gap-2 animate-pulse shadow-lg" id="translating-indicator" aria-live="polite">
          <span className="w-2 h-2 rounded-full bg-[#00d4b2]" />
          <span>{translatingFor} is translating…</span>
        </div>
      )}

      {/* ── Subtitle Overlay ────────────────────────────────────────────── */}
      {subtitle && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] px-5 py-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 shadow-2xl text-center pointer-events-auto animate-fade-in"
          id="subtitle-overlay"
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#00d4b2]">{subtitle.speakerName}</span>
            {subtitle.isSelf ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                You (Spoken)
              </span>
            ) : subtitle.lang && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00d4b2]/20 text-[#00d4b2] font-bold uppercase border border-[#00d4b2]/30">
                {subtitle.lang} Subtitle
              </span>
            )}
            {subtitle.displayLatency && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#00d4b2]">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>{subtitle.displayLatency}</span>
              </span>
            )}
            {subtitle.diagnostics && (
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white transition ml-1 flex items-center gap-1"
                onClick={() => {
                  setSelectedDiagnostics(subtitle);
                  setShowDiagnosticsModal(true);
                }}
                title="Inspect translation pipeline diagnostics"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>Inspect</span>
              </button>
            )}
          </div>
          {subtitle.isSelf ? (
            <p className="text-sm sm:text-base font-medium text-slate-200">
              "{subtitle.originalText}"
            </p>
          ) : (
            <>
              {subtitle.originalText && subtitle.originalText !== subtitle.translatedText && (
                <p className="text-xs text-slate-400 mb-0.5 italic">
                  "{subtitle.originalText}"
                </p>
              )}
              <p className="text-sm sm:text-base font-semibold text-white">
                {subtitle.translatedText || subtitle.originalText}
              </p>
            </>
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

      {/* ── Leave / End Meeting Confirmation Modal ─────────────────────── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" id="leave-modal">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-[#0e1017] border border-white/10 shadow-2xl text-slate-100 mx-auto">
            <h3 className="text-lg font-bold text-white mb-2">{isHost ? 'Leave or End Meeting?' : 'Leave this meeting?'}</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              {isHost
                ? 'As host, you can leave the meeting or end it for all participants.'
                : "You'll be redirected to the meeting summary page."}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
              <button
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 transition shrink-0"
                onClick={handleLeaveCancel}
                id="btn-leave-cancel"
              >
                Cancel
              </button>
              <button
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white transition shrink-0"
                onClick={handleLeaveConfirm}
                id="btn-leave-confirm"
              >
                Leave Meeting
              </button>
              {isHost && (
                <button
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30 transition shrink-0"
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

      {/* ── Translation Pipeline Diagnostics Inspector Modal ───────────── */}
      <PipelineInspectorModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        data={selectedDiagnostics}
      />
    </div>
  );
};

export default MeetingRoom;
