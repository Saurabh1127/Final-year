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

const VAD_CONFIG = {
  SILENCE_THRESHOLD: 0.01,    // Increased from 0.003 to ignore fan noise
  SILENCE_DURATION_MS: 400,   // Increased from 300 to wait longer before flushing
  MIN_SPEECH_MS: 500,         // Increased from 300 to ignore short clicks
  MAX_CHUNK_MS: 2500,         // Increased from 1000 to give Whisper more context
  ANALYSIS_INTERVAL_MS: 50,
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
  const timesliceIntervalRef = useRef(null);
  const translationStreamRef = useRef(null);
  const isFlushingRef = useRef(false);
  const chunkStartTimeRef = useRef(null);

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

  // ── Helper: create and start a fresh MediaRecorder ─────────────────────────
  const startNewRecorder = useCallback(() => {
    const cloned = clonedStreamRef.current;
    if (!cloned) return;

    chunkStartTimeRef.current = Date.now();
    const recorder = new MediaRecorder(cloned);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        // Pre-roll pruning: when user is not speaking, keep at most 2 slices (~500ms pre-roll)
        // to prevent accumulating massive megabyte-sized buffers of dead silence
        if (!speechStartTimeRef.current && chunksRef.current.length > 2) {
          chunksRef.current.shift();
        }
      }
    };
    try {
      recorder.start(250);
    } catch {
      recorder.start();
      timesliceIntervalRef.current = setInterval(() => {
        if (recorder.state === 'recording') recorder.requestData();
      }, 250);
    }
    mediaRecorderRef.current = recorder;
  }, []);

  // ── Flush chunk: STOP recorder (finalises WebM headers), send, then RESTART ──
  // WebM is a container format — it needs EBML/Segment/Track headers at the start.
  // MediaRecorder only writes these headers when recording begins. If we just
  // clear the chunk array without stopping, subsequent blobs are header-less and
  // FFmpeg on the server rejects them with "EBML header parsing failed".
  // By stopping + restarting, every flushed blob is a valid, self-contained WebM.
  const flushChunk = useCallback(() => {
    clearTimeout(maxChunkTimerRef.current);
    speechStartTimeRef.current = null;
    if (!socket?.connected) return;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    if (chunksRef.current.length === 0) return;

    const currentMimeType = recorder.mimeType || 'audio/webm';
    const flushTime = Date.now();

    // Stop fires a final 'dataavailable' event, then 'stop' event.
    // The 'onstop' handler collects all chunks (including the final one),
    // creates a complete WebM blob, sends it, then restarts recording.
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: currentMimeType });
      chunksRef.current = [];

      // Restart recording immediately to capture the next utterance
      startNewRecorder();

      // Discard tiny blobs (< 1KB) — probably just silence
      if (blob.size < 1000) {
        return;
      }

      // Convert Blob to ArrayBuffer for Socket.IO binary transport
      blob.arrayBuffer().then((buffer) => {
        socket.emit('audio-chunk', buffer, {
          roomCode,
          speakerName,
          mimeType: currentMimeType,
          captureStartTime: chunkStartTimeRef.current || flushTime,
          flushTime: flushTime,
        });
        console.log(`📤 [Speech] Emitted audio-chunk (${(blob.size / 1024).toFixed(1)}KB) for room ${roomCode}`);
      }).catch((err) => {
        console.warn('⚠️ [Speech] Failed to convert blob to ArrayBuffer:', err.message);
      });
    };

    recorder.stop();
  }, [socket, roomCode, speakerName, startNewRecorder]);

  // ── VAD: Watch Audio Energy via AnalyserNode ──────────────────────────────────
  const startVAD = useCallback(
    (vadStream) => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      audioContextRef.current = new AudioContext();
      
      // Fix for iOS Safari & Chrome autoplay policy: AudioContext starts suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

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
          console.debug(`🔊 [VAD] Speaking detected (RMS: ${rms.toFixed(4)})`);

          if (!speechStartTimeRef.current) {
            speechStartTimeRef.current = Date.now();
            console.log('🎤 [VAD] Speech START');
            maxChunkTimerRef.current = setTimeout(() => {
              speechStartTimeRef.current = null;
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
            console.log('🔇 [VAD] Silence detected — flushing chunk');
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

      // Start the first MediaRecorder session (with fresh WebM headers)
      startNewRecorder();

      startVAD(cloned);
      setIsTranslating(true);
      setError(null);
      console.log('🎙️ [Speech] Started VAD on cloned stream (no double mic prompt).');
    } catch (err) {
      console.error('❌ [Speech] Failed to start:', err.message);
      setError('Could not start translation recording.');
    }
  }, [isTranslating, stream, startVAD, startNewRecorder]);

  // ── Stop Recording ────────────────────────────────────────────────────────────
  const stopTranslation = useCallback(() => {
    if (!isTranslating) return;

    clearInterval(vadIntervalRef.current);
    clearInterval(timesliceIntervalRef.current);
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
