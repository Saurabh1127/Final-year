import { useState, useEffect, useRef, useCallback } from 'react';
import useSpeechTranslation from './useSpeechTranslation';
import useTranslationReceiver from './useTranslationReceiver';

/**
 * useMeetingTranslation
 * Orchestrates neural speech translation, subtitle timing, live transcript logs,
 * incoming TTS playback, and AI diagnostic telemetry for the meeting room.
 */
export function useMeetingTranslation({
  socket,
  roomCode,
  user,
  displayName,
  localStream,
  hasJoinedLobby,
  isMuted,
  sourceLanguage,
  remoteVideoRefs,
}) {
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [subtitle, setSubtitle] = useState(null);
  const [translatingFor, setTranslatingFor] = useState(null);
  const [transcriptLog, setTranscriptLog] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState(null);
  const [latestDiagnostics, setLatestDiagnostics] = useState(null);

  const subtitleTimeoutRef = useRef(null);

  // Subtitle handler with timing and auto-dismissal
  const handleSubtitle = useCallback((sub, duration = 4000) => {
    if (!sub) {
      setSubtitle(null);
      clearTimeout(subtitleTimeoutRef.current);
      return;
    }
    if (sub.isPending) {
      setTranslatingFor(sub.speakerName || null);
      return;
    }
    setTranslatingFor(null);
    if (sub?.timing) {
      const now = Date.now();
      const latencyMs = now - (sub.timing.flushTime || sub.timing.serverReceiveTime || now);
      sub.displayLatency = (latencyMs / 1000).toFixed(2) + 's';
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

  // Transcript entry handler
  const handleTranscriptEntry = useCallback((entry) => {
    setTranscriptLog((prev) => [entry, ...prev].slice(0, 200));
    if (entry?.diagnostics) {
      setLatestDiagnostics(entry);
    }
  }, []);

  // Socket listeners for server broadcast subtitles and transcripts
  useEffect(() => {
    if (!socket) return;
    const onNewTranscript = (entry) => handleTranscriptEntry(entry);
    const onSpeakerSubtitle = (sub) => {
      handleSubtitle(sub);
      if (sub?.diagnostics) setLatestDiagnostics(sub);
    };
    const onTranslationDiag = (diagEvent) => {
      if (diagEvent?.diagnostics) {
        setLatestDiagnostics((prev) => ({ ...prev, ...diagEvent }));
      }
    };

    socket.on('new-transcript', onNewTranscript);
    socket.on('speaker-subtitle', onSpeakerSubtitle);
    socket.on('translation-diagnostics', onTranslationDiag);

    return () => {
      socket.off('new-transcript', onNewTranscript);
      socket.off('speaker-subtitle', onSpeakerSubtitle);
      socket.off('translation-diagnostics', onTranslationDiag);
    };
  }, [socket, handleTranscriptEntry, handleSubtitle]);

  // Speech Translation hook (sends local audio chunks to server)
  const { isTranslating, startTranslation, stopTranslation } = useSpeechTranslation({
    stream: localStream,
    roomCode,
    userId: user?.id,
    speakerName: displayName,
    sourceLanguage,
    isMuted,
    remoteAudioRefs: remoteVideoRefs?.current || [],
    onSubtitle: handleSubtitle,
    onTranscriptEntry: handleTranscriptEntry,
    enabled: translationEnabled,
  });

  // Translation Receiver hook (plays synthesized TTS from remote peers)
  const { isReceiving, isPending } = useTranslationReceiver({
    remoteAudioRefs: remoteVideoRefs?.current || [],
    onSubtitle: handleSubtitle,
    onTranscriptEntry: handleTranscriptEntry,
    enabled: translationEnabled,
  });

  // Start/stop translation when toggle or lobby state changes
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    translationEnabled,
    setTranslationEnabled,
    isTranslating,
    isPending,
    isReceiving,
    subtitle,
    translatingFor,
    transcriptLog,
    showTranscript,
    setShowTranscript,
    showDiagnosticsModal,
    setShowDiagnosticsModal,
    selectedDiagnostics,
    setSelectedDiagnostics,
    latestDiagnostics,
  };
}

export default useMeetingTranslation;
