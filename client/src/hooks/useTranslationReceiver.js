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
  const fallbackSubtitleTimeoutRef = useRef(null);   // Fallback timer if audio does not arrive

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
    const { blobUrl, speakerId, sequenceNumber, timing, speakerName, originalText, translatedText, lang } = item;

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
      // ⚡ SIMULTANEOUS: Show subtitle at the exact moment the voice begins speaking ⚡
      if (onSubtitle && (translatedText || originalText)) {
        onSubtitle({
          speakerName: speakerName || 'Speaker',
          originalText: originalText || '',
          translatedText: translatedText || originalText,
          lang,
          isPending: false,
          timing,
        }, 0); // 0 = keep alive while voice is speaking
      }

      if (timing) {
        const playTime = Date.now();
        // Measure from the moment audio was flushed/sent to the moment it starts playing
        const translationDeliveryMs = playTime - (timing.flushTime || timing.serverReceiveTime || playTime);
        const uploadMs = (timing.serverReceiveTime && timing.flushTime) ? (timing.serverReceiveTime - timing.flushTime) : 0;
        const aiMs = (timing.serverAiReturnTime && timing.serverReceiveTime) ? (timing.serverAiReturnTime - timing.serverReceiveTime) : null;
        const downloadMs = timing.serverAiReturnTime ? (playTime - timing.serverAiReturnTime) : 0;

        console.log(`⏱️ [Translation & Delivery] ${(translationDeliveryMs / 1000).toFixed(2)}s (${translationDeliveryMs}ms)`, {
          aiEngine: aiMs ? `${aiMs}ms` : 'N/A',
          networkUpload: `${uploadMs}ms`,
          networkDownloadAndInit: `${downloadMs}ms`,
          totalDelivery: `${translationDeliveryMs}ms`,
        });
      }
    };

    const onDone = () => {
      restore();
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      setIsReceiving(audioQueueRef.current.length > 0);
      URL.revokeObjectURL(blobUrl);

      // Keep subtitle visible for 2 seconds after voice ends (or until next audio item replaces it)
      if (onSubtitle && (translatedText || originalText) && audioQueueRef.current.length === 0) {
        onSubtitle({
          speakerName: speakerName || 'Speaker',
          originalText: originalText || '',
          translatedText: translatedText || originalText,
          lang,
          isPending: false,
          timing,
        }, 2000);
      }

      playNext(); // process next item in queue
    };

    audio.onended = onDone;
    audio.onerror = () => {
      console.warn('⚠️ [TranslationReceiver] TTS audio error, skipping.');
      // If audio fails, show subtitle for 4 seconds as fallback
      if (onSubtitle && (translatedText || originalText)) {
        onSubtitle({
          speakerName: speakerName || 'Speaker',
          originalText: originalText || '',
          translatedText: translatedText || originalText,
          lang,
          isPending: false,
          timing,
        }, 4000);
      }
      onDone();
    };

    audio.play().catch(() => {
      console.warn('⚠️ [TranslationReceiver] audio.play() blocked, skipping.');
      // If audio autoplay is blocked, show subtitle for 4 seconds as fallback
      if (onSubtitle && (translatedText || originalText)) {
        onSubtitle({
          speakerName: speakerName || 'Speaker',
          originalText: originalText || '',
          translatedText: translatedText || originalText,
          lang,
          isPending: false,
          timing,
        }, 4000);
      }
      onDone();
    });
  }, [duck, restore, onSubtitle, onTranscriptEntry]);

  // ── Socket.IO event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !enabled) return;

    // 'translation-pending': server started processing — signal the separate indicator only
    const handleTranslationPending = ({ speakerName }) => {
      clearTimeout(pendingTimeoutRef.current);

      // Pass isPending to onSubtitle — MeetingRoom routes this to the
      // separate translating-indicator pill, NOT the subtitle overlay.
      if (onSubtitle) {
        onSubtitle({ speakerName, isPending: true });
      }
      setIsPending(true);

      // Safety net: clear the indicator if no result arrives within 12s
      pendingTimeoutRef.current = setTimeout(() => {
        setIsPending(false);
        if (onSubtitle) onSubtitle({ speakerName: null, isPending: true });
      }, 12000);
    };

    const handleTranslationResult = (payload) => {
      clearTimeout(pendingTimeoutRef.current);
      setIsPending(false);

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

      // Fallback: If audio does NOT arrive within 4s (e.g. TTS disabled or network issue),
      // show subtitle so the user does not miss what was said.
      clearTimeout(fallbackSubtitleTimeoutRef.current);
      fallbackSubtitleTimeoutRef.current = setTimeout(() => {
        if (!isPlayingRef.current && onSubtitle) {
          onSubtitle({
            speakerName: payload.speakerName,
            originalText: payload.originalText,
            translatedText: payload.translatedText,
            lang: payload.lang,
            isPending: false,
            timing: payload.timing,
          }, 4000);
        }
      }, 4000);
    };

    const handleTranslationAudio = (audioBuffer, metadata) => {
      // Audio arrived! Cancel fallback and pending timers
      clearTimeout(fallbackSubtitleTimeoutRef.current);
      clearTimeout(pendingTimeoutRef.current);
      setIsPending(false);

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
        speakerName: metadata.speakerName,
        originalText: metadata.originalText,
        translatedText: metadata.translatedText,
        lang: metadata.lang,
        sequenceNumber,
        timing: metadata.timing
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
      clearTimeout(fallbackSubtitleTimeoutRef.current);
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
      clearTimeout(fallbackSubtitleTimeoutRef.current);
    }
  }, [enabled, restore]);

  return { isReceiving, isPending };
};

export default useTranslationReceiver;
