/**
 * useTranslationReceiver.js
 *
 * Phase 3 + Phase 7: Client-side translation result receiver.
 *
 * Listens for Socket.IO events emitted by the server orchestrator and handles:
 *   1. Audio queue management (max 100 items, oldest dropped on overflow)
 *   2. Sequential TTS audio playback via HTML Audio element
 *   3. Audio ducking of remote participant streams during TTS
 *   4. Subtitle state for the overlay
 *   5. Transcript sidebar updates for received translations
 *
 * Phase 7 additions:
 *   6. 'translation-pending' → immediately shows "Translating…" subtitle
 *      for the speaking participant, so listeners get instant visual feedback
 *      while the AI pipeline (~500–800ms) is still running.
 *   7. isPending state exposed to parent for UI indicators.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const MAX_QUEUE_SIZE = 100; // Increased to 100 for streaming TTS chunks

const useTranslationReceiver = ({
  remoteAudioRefs = [],         // refs to remote <audio>/<video> elements for ducking
  onSubtitle,                   // (subtitle) => void
  onTranscriptEntry,            // (entry) => void
  enabled = false,
}) => {
  const { socket } = useSocket();
  const audioQueueRef = useRef([]);       // Queued translation-result payloads
  const isPlayingRef = useRef(false);     // Prevent concurrent playback
  const currentAudioRef = useRef(null);   // Currently playing Audio element
  const lastPlayedSeqRef = useRef({});    // { speakerId: lastSequenceNumber } — for ordering
  const [isReceiving, setIsReceiving] = useState(false);
  const [isPending, setIsPending] = useState(false); // Phase 7: true while 'Translating...' indicator is active
  const pendingTimeoutRef = useRef(null);             // Auto-clear pending indicator if no result arrives

  // ── Audio Ducking ────────────────────────────────────────────────────────────
  const duck = useCallback(() => {
    remoteAudioRefs.forEach((ref) => {
      if (ref?.current) ref.current.volume = 0.15;
    });
  }, [remoteAudioRefs]);

  const restore = useCallback(() => {
    remoteAudioRefs.forEach((ref) => {
      if (ref?.current) ref.current.volume = 1.0;
    });
  }, [remoteAudioRefs]);

  // ── Play Next Item in Queue ───────────────────────────────────────────────────
  const playNext = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const item = audioQueueRef.current.shift();
    const { blobUrl, speakerId, sequenceNumber, timing } = item;

    // Discard stale items
    if (sequenceNumber && speakerId) {
      const lastPlayed = lastPlayedSeqRef.current[speakerId] || 0;
      if (sequenceNumber < lastPlayed) {
        console.warn(`⏭️ [TranslationReceiver] Discarding stale audio (seq ${sequenceNumber} < ${lastPlayed}) for ${speakerId}`);
        URL.revokeObjectURL(blobUrl);
        playNext();
        return;
      }
      lastPlayedSeqRef.current[speakerId] = sequenceNumber;
    }

    if (!blobUrl) {
      playNext();
      return;
    }

    isPlayingRef.current = true;
    setIsReceiving(true);

    const audio = new Audio(blobUrl);
    currentAudioRef.current = audio;

    audio.onplay = () => {
      duck();
      if (timing) {
        const playTime = Date.now();
        const ttfa = playTime - timing.captureStartTime;
        const uploadTime = timing.serverReceiveTime - timing.flushTime;
        const serverWaitTime = timing.serverAiReturnTime - timing.serverReceiveTime;
        const downloadTime = playTime - timing.serverAiReturnTime;
        console.log(`⏱️ [Latency Metrics] TTFA (End-to-End): ${ttfa}ms`, {
          captureToFlush: timing.flushTime - timing.captureStartTime,
          uploadRoundTrip: uploadTime,
          aiLatency: timing.aiLatency,
          downloadAndInit: downloadTime,
          total: ttfa
        });
      }
    };

    const onDone = () => {
      restore();
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      setIsReceiving(audioQueueRef.current.length > 0);
      URL.revokeObjectURL(blobUrl);
      playNext(); // process next item in queue
    };

    audio.onended = onDone;
    audio.onerror = () => {
      console.warn('⚠️ [TranslationReceiver] TTS audio error, skipping.');
      onDone();
    };

    audio.play().catch(() => {
      console.warn('⚠️ [TranslationReceiver] audio.play() blocked, skipping.');
      onDone();
    });
  }, [duck, restore, onSubtitle, onTranscriptEntry]);

  // ── Socket.IO event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !enabled) return;

    // Phase 7: 'translation-pending' fires the moment the server starts processing audio.
    // Show "Translating…" subtitle immediately — before Whisper/NLLB/TTS finishes.
    const handleTranslationPending = ({ speakerName }) => {
      // Clear any previous pending timeout
      clearTimeout(pendingTimeoutRef.current);

      if (onSubtitle) {
        onSubtitle({
          speakerName,
          originalText: '⏳ Translating…',
          translatedText: null,
          isPending: true,
        });
      }
      setIsPending(true);

      // Safety net: if no translation-result arrives within 12s, clear the indicator
      pendingTimeoutRef.current = setTimeout(() => {
        setIsPending(false);
      }, 12000);
    };

    const handleTranslationResult = (payload) => {
      // Phase 7: real result arrived — clear the "Translating…" indicator
      clearTimeout(pendingTimeoutRef.current);
      setIsPending(false);

      // Show subtitle immediately (Subtitle-first delivery)
      if (onSubtitle) {
        onSubtitle({
          speakerName: payload.speakerName,
          originalText: payload.originalText,
          translatedText: payload.translatedText,
          lang: payload.lang,
          isPending: false,
        });
      }

      // Add to transcript sidebar immediately
      if (onTranscriptEntry) {
        onTranscriptEntry({
          speakerId: payload.speakerId,
          speakerName: payload.speakerName,
          originalText: payload.originalText,
          sourceLanguage: payload.sourceLanguage,
          translations: { [payload.lang]: payload.translatedText },
          timestamp: payload.timestamp,
        });
      }
    };

    const handleTranslationAudio = (audioBuffer, metadata) => {
      const { speakerId, sequenceNumber, mimeType } = metadata;

      // Drop oldest if queue is full
      if (audioQueueRef.current.length >= MAX_QUEUE_SIZE) {
        audioQueueRef.current.shift();
        console.warn('⚠️ [TranslationReceiver] Queue overflow — oldest item dropped.');
      }

      // Create a Blob URL from the binary ArrayBuffer
      const blob = new Blob([audioBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      audioQueueRef.current.push({
        blobUrl,
        speakerId,
        sequenceNumber,
        timing: metadata.timing // timing can be passed here if orchestrator includes it
      });

      playNext();
    };

    socket.on('translation-pending', handleTranslationPending);
    socket.on('translation-result', handleTranslationResult);
    socket.on('translation-audio', handleTranslationAudio);

    return () => {
      socket.off('translation-pending', handleTranslationPending);
      socket.off('translation-result', handleTranslationResult);
      socket.off('translation-audio', handleTranslationAudio);
      clearTimeout(pendingTimeoutRef.current);
    };
  }, [socket, enabled, playNext, onSubtitle, onTranscriptEntry]);

  // ── Cleanup on disable / unmount ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      audioQueueRef.current = [];
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
      }
      isPlayingRef.current = false;
      restore();
      setIsReceiving(false);
      setIsPending(false);
      clearTimeout(pendingTimeoutRef.current);
    }
  }, [enabled, restore]);

  return { isReceiving, isPending };
};

export default useTranslationReceiver;
