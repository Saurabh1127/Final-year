/**
 * useTranslationReceiver.js
 *
 * Phase 3: Client-side translation result receiver.
 *
 * Listens for 'translation-result' Socket.IO events (emitted by the server orchestrator)
 * and handles:
 *   1. Audio queue management (max 3 items, oldest dropped on overflow)
 *   2. Sequential TTS audio playback via HTML Audio element
 *   3. Audio ducking of remote participant streams during TTS
 *   4. Subtitle state for the overlay
 *   5. Transcript sidebar updates for received translations
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const MAX_QUEUE_SIZE = 3;

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
    const { audioBase64, mimeType, speakerName, originalText, translatedText, lang, timestamp, speakerId, sequenceNumber } = item;

    // Discard stale items: if we've already played a higher sequence for this speaker, skip
    if (sequenceNumber && speakerId) {
      const lastPlayed = lastPlayedSeqRef.current[speakerId] || 0;
      if (sequenceNumber < lastPlayed) {
        console.warn(`⏭️ [TranslationReceiver] Discarding stale item (seq ${sequenceNumber} < ${lastPlayed}) for ${speakerId}`);
        playNext(); // Try the next item
        return;
      }
      lastPlayedSeqRef.current[speakerId] = sequenceNumber;
    }

    // Show subtitle first (regardless of whether audio plays)
    if (onSubtitle) {
      onSubtitle({ speakerName, originalText, translatedText, lang });
    }

    // Add to transcript sidebar
    if (onTranscriptEntry) {
      onTranscriptEntry({
        speakerId: item.speakerId,
        speakerName,
        originalText,
        sourceLanguage: item.sourceLanguage,
        translations: { [lang]: translatedText },
        timestamp,
      });
    }

    if (!audioBase64) {
      // No audio — just show subtitle, then process next
      playNext();
      return;
    }

    isPlayingRef.current = true;
    setIsReceiving(true);

    const audio = new Audio(`data:${mimeType || 'audio/mp3'};base64,${audioBase64}`);
    currentAudioRef.current = audio;

    audio.onplay = () => duck();

    const onDone = () => {
      restore();
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      setIsReceiving(audioQueueRef.current.length > 0);
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

  // ── Socket.IO event: translation-result ──────────────────────────────────────
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleTranslationResult = (payload) => {
      // Drop oldest if queue is full — avoid pile-up during fast speech
      if (audioQueueRef.current.length >= MAX_QUEUE_SIZE) {
        audioQueueRef.current.shift();
        console.warn('⚠️ [TranslationReceiver] Queue overflow — oldest item dropped.');
      }
      audioQueueRef.current.push(payload);
      playNext();
    };

    socket.on('translation-result', handleTranslationResult);

    return () => {
      socket.off('translation-result', handleTranslationResult);
    };
  }, [socket, enabled, playNext]);

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
    }
  }, [enabled, restore]);

  return { isReceiving };
};

export default useTranslationReceiver;
