/**
 * useSpeechTranslation.js
 *
 * Phase 1 + Phase 2 refactor:
 *   - No longer calls getUserMedia internally (eliminates double mic permission prompt).
 *   - Accepts the existing localStream from useAudioCapture via the `stream` prop.
 *   - Uses MediaStream.clone() so WebRTC track and VAD/recording don't interfere.
 *   - Emits audio chunks to the Node.js server via Socket.IO ('audio-chunk') — NOT directly to Colab.
 *   - Server orchestrator handles AI service dispatch and broadcasts 'translation-result'.
 *
 * VAD Strategy (browser-native, no external library):
 *   - WebRTC hardware DSP constraints applied at capture time in useAudioCapture.
 *   - Web Audio API AnalyserNode: RMS energy monitoring at 50ms intervals.
 *   - Silence (< threshold) for >= 300ms flushes the current chunk.
 *   - Hard cap of 2.5s forces a flush on continuous speech (reduced from 3.5s for lower latency).
 *   - Minimum of 1.0s speech floor ignores micro-clicks and noise bursts.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

// ── VAD Configuration ──────────────────────────────────────────────────────────
const VAD_CONFIG = {
  SILENCE_THRESHOLD: 0.015,   // RMS energy below which audio is "silent"
  SILENCE_DURATION_MS: 300,   // ms of silence before triggering a chunk flush
  MIN_SPEECH_MS: 1000,        // minimum speech duration before we bother sending
  MAX_CHUNK_MS: 2500,         // hard cap: force flush if speaker hasn't paused (reduced from 3.5s)
  ANALYSIS_INTERVAL_MS: 50,   // how often to sample audio energy
};

const useSpeechTranslation = ({
  stream,                       // MediaStream from useAudioCapture (localStream)
  roomCode,
  userId,
  speakerName,
  isMuted = false,
  remoteAudioRefs = [],         // Array of refs to remote <audio>/<video> elements for ducking
  onSubtitle,                   // (subtitle) => void — for subtitle overlay
  onTranscriptEntry,            // (entry) => void — for live sidebar (own speech)
  enabled = false,
}) => {
  const { socket } = useSocket();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const clonedStreamRef = useRef(null);   // cloned stream for VAD/recording (separate from WebRTC)
  const chunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const speechStartTimeRef = useRef(null);
  const maxChunkTimerRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const translationStreamRef = useRef(null);
  const isFlushingRef = useRef(false);

  // ── Audio Ducking ────────────────────────────────────────────────────────────
  const duckRemoteAudio = useCallback(() => {
    remoteAudioRefs.forEach((ref) => {
      if (ref?.current) ref.current.volume = 0.1;
    });
  }, [remoteAudioRefs]);

  const restoreRemoteAudio = useCallback(() => {
    remoteAudioRefs.forEach((ref) => {
      if (ref?.current) ref.current.volume = 1.0;
    });
  }, [remoteAudioRefs]);

  // ── TTS Playback (for own language preview, if server sends it back) ─────────
  const playTTSAudio = useCallback(
    (audioBase64, mimeType = 'audio/mp3') => {
      return new Promise((resolve) => {
        if (translationStreamRef.current) {
          translationStreamRef.current.pause();
          translationStreamRef.current.src = '';
        }

        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        translationStreamRef.current = audio;

        audio.onplay = () => duckRemoteAudio();
        audio.onended = () => { restoreRemoteAudio(); resolve(); };
        audio.onerror = () => { restoreRemoteAudio(); resolve(); };
        audio.play().catch(() => { restoreRemoteAudio(); resolve(); });
      });
    },
    [duckRemoteAudio, restoreRemoteAudio]
  );

  // ── Flush chunk: emit via Socket.IO to server orchestrator ───────────────────
  const flushChunk = useCallback(() => {
    if (isFlushingRef.current || chunksRef.current.length === 0 || !socket?.connected) return;
    if (isMuted) {
      // Don't send if the user is muted
      chunksRef.current = [];
      return;
    }

    isFlushingRef.current = true;

    const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
    chunksRef.current = [];

    // Discard tiny blobs — almost certainly silence or noise (< 4KB)
    if (blob.size < 4096) {
      isFlushingRef.current = false;
      return;
    }

    // Convert Blob to ArrayBuffer for Socket.IO binary transport
    blob.arrayBuffer().then((buffer) => {
      socket.emit('audio-chunk', buffer, {
        roomCode,
        speakerName,
        mimeType: 'audio/webm;codecs=opus',
      });
      console.log(`📤 [Speech] Emitted audio-chunk (${(blob.size / 1024).toFixed(1)}KB) for room ${roomCode}`);
    }).catch((err) => {
      console.warn('⚠️ [Speech] Failed to convert blob to ArrayBuffer:', err.message);
    }).finally(() => {
      isFlushingRef.current = false;
    });
  }, [socket, roomCode, speakerName, isMuted]);

  // ── VAD: Watch Audio Energy via AnalyserNode ──────────────────────────────────
  const startVAD = useCallback(
    (vadStream) => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(vadStream);
      sourceNodeRef.current.connect(analyserRef.current);

      const dataArray = new Float32Array(analyserRef.current.fftSize);
      let silenceDuration = 0;

      vadIntervalRef.current = setInterval(() => {
        analyserRef.current.getFloatTimeDomainData(dataArray);

        const rms = Math.sqrt(
          dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
        );
        const isSpeaking = rms > VAD_CONFIG.SILENCE_THRESHOLD;

        if (isSpeaking) {
          silenceDuration = 0;
          clearTimeout(silenceTimerRef.current);

          if (!speechStartTimeRef.current) {
            speechStartTimeRef.current = Date.now();
            maxChunkTimerRef.current = setTimeout(() => {
              if (chunksRef.current.length > 0) flushChunk();
            }, VAD_CONFIG.MAX_CHUNK_MS);
          }
        } else {
          silenceDuration += VAD_CONFIG.ANALYSIS_INTERVAL_MS;

          if (
            silenceDuration >= VAD_CONFIG.SILENCE_DURATION_MS &&
            speechStartTimeRef.current &&
            Date.now() - speechStartTimeRef.current >= VAD_CONFIG.MIN_SPEECH_MS
          ) {
            clearTimeout(maxChunkTimerRef.current);
            speechStartTimeRef.current = null;
            silenceDuration = 0;
            flushChunk();
          }
        }
      }, VAD_CONFIG.ANALYSIS_INTERVAL_MS);
    },
    [flushChunk]
  );

  // ── Start Recording (using cloned stream, not WebRTC stream directly) ─────────
  const startTranslation = useCallback(() => {
    if (isTranslating || !stream) return;

    try {
      // Clone the stream — MediaRecorder consuming it won't disturb the WebRTC peer connection
      const cloned = stream.clone();
      clonedStreamRef.current = cloned;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(cloned, {
        mimeType,
        audioBitsPerSecond: 32000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Collect data every 250ms (fine-grained VAD slice building)
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      startVAD(cloned);
      setIsTranslating(true);
      setError(null);
      console.log('🎙️ [Speech] Started VAD on cloned stream (no double mic prompt).');
    } catch (err) {
      console.error('❌ [Speech] Failed to start:', err.message);
      setError('Could not start translation recording.');
    }
  }, [isTranslating, stream, startVAD]);

  // ── Stop Recording ────────────────────────────────────────────────────────────
  const stopTranslation = useCallback(() => {
    if (!isTranslating) return;

    clearInterval(vadIntervalRef.current);
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxChunkTimerRef.current);
    speechStartTimeRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop cloned stream tracks (does NOT affect the WebRTC stream)
    if (clonedStreamRef.current) {
      clonedStreamRef.current.getTracks().forEach((t) => t.stop());
      clonedStreamRef.current = null;
    }

    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();

    if (translationStreamRef.current) {
      translationStreamRef.current.pause();
      translationStreamRef.current.src = '';
    }

    restoreRemoteAudio();
    chunksRef.current = [];
    setIsTranslating(false);
    console.log('🛑 [Speech] Stopped.');
  }, [isTranslating, restoreRemoteAudio]);

  // ── Restart when stream changes (e.g. tab re-focus) ──────────────────────────
  useEffect(() => {
    if (isTranslating && stream) {
      // If stream reference changed (e.g. device switch), restart with new stream
      stopTranslation();
      setTimeout(() => startTranslation(), 100);
    }
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isTranslating,
    error,
    startTranslation,
    stopTranslation,
    playTTSAudio,       // exported so useTranslationReceiver can use same ducking logic
    duckRemoteAudio,
    restoreRemoteAudio,
  };
};

export default useSpeechTranslation;
