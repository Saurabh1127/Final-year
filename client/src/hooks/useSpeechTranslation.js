/**
 * useSpeechTranslation.js
 *
 * Phase 9 — AudioWorklet Capture (replaces MediaRecorder)
 *
 * Key changes from Phase 1:
 *   - MediaRecorder → AudioWorkletNode + AudioCaptureProcessor
 *   - WebM/Opus chunks → raw WAV bytes (PCM Int16, 48 kHz mono)
 *   - VAD now runs every ~20ms (per worklet frame) instead of every 250ms timeslice
 *   - No more stop/start cycle per utterance — capture is continuous
 *   - No WebM EBML container overhead — the server receives a self-contained WAV
 *
 * What is unchanged:
 *   - VAD algorithm (RMS energy threshold, silence timer, max chunk timer)
 *   - Socket.IO transport event name ('audio-chunk') and metadata shape
 *   - Audio ducking logic
 *   - Hook API (startTranslation, stopTranslation, etc.)
 *
 * Server impact: NONE — the server/orchestrator still receives an ArrayBuffer
 *   via 'audio-chunk'. The FastAPI stt.py handles WAV natively via the Phase 5
 *   in-memory ffmpeg pipe (ffmpeg decodes WAV just as well as WebM).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import workletUrl from '../workers/audio-processor.worklet.js?url';

// ── VAD configuration (identical values to Phase 1) ──────────────────────────
const VAD_CONFIG = {
  SILENCE_THRESHOLD:  0.01,   // RMS energy cutoff
  SILENCE_DURATION_MS: 400,   // ms of consecutive silence before flush
  MIN_SPEECH_MS:       500,   // minimum speech duration before flush allowed
  MAX_CHUNK_MS:       2500,   // hard cap — flush even during continuous speech
  FRAME_MS:             20,   // worklet frame size (must match FRAME_SAMPLES / sampleRate)
};

// ── WAV helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal 44-byte WAV header for PCM Int16 mono audio.
 * @param {number} numSamples  Total number of Int16 samples
 * @param {number} sampleRate  e.g. 48000
 */
function buildWavHeader(numSamples, sampleRate) {
  const byteRate   = sampleRate * 2; // 1 channel × 2 bytes per sample
  const dataSize   = numSamples * 2;
  const buffer     = new ArrayBuffer(44);
  const view       = new DataView(buffer);
  const writeStr   = (offset, str) => [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + dataSize, true);   // file size − 8
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);              // PCM chunk size
  view.setUint16(20,  1, true);              // PCM format
  view.setUint16(22,  1, true);              // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate,   true);
  view.setUint16(32,  2, true);              // block align
  view.setUint16(34, 16, true);              // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  return buffer;
}

/**
 * Convert a Float32Array of PCM samples to Int16 (WAV standard).
 * Clamps to [-1, 1] to prevent wrapping.
 */
function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return int16;
}

/**
 * Encode accumulated Float32 samples into a self-contained WAV ArrayBuffer.
 * @param {Float32Array[]} frameList  Array of Float32Array frames from the worklet
 * @param {number}         sampleRate AudioContext sample rate (e.g. 48000)
 */
function encodeWav(frameList, sampleRate) {
  // Concatenate all frames into one contiguous Float32Array
  const totalSamples = frameList.reduce((n, f) => n + f.length, 0);
  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (const frame of frameList) {
    merged.set(frame, offset);
    offset += frame.length;
  }

  const int16     = float32ToInt16(merged);
  const wavHeader = buildWavHeader(int16.length, sampleRate);
  const wavBytes  = new Uint8Array(wavHeader.byteLength + int16.buffer.byteLength);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(new Uint8Array(int16.buffer), wavHeader.byteLength);
  return wavBytes.buffer; // ArrayBuffer ready for Socket.IO binary transport
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const useSpeechTranslation = ({
  stream,                         // MediaStream from useAudioCapture (localStream)
  roomCode,
  userId,
  speakerName,
  isMuted          = false,
  remoteAudioRefs  = [],          // refs to remote <audio>/<video> elements for ducking
  onSubtitle,
  onTranscriptEntry,
  enabled          = false,
}) => {
  const { socket } = useSocket();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error,         setError]         = useState(null);

  // AudioWorklet refs
  const audioContextRef   = useRef(null);
  const workletNodeRef    = useRef(null);
  const sourceNodeRef     = useRef(null);
  const clonedStreamRef   = useRef(null);

  // VAD state (all in refs to avoid stale closures inside the onmessage handler)
  const framesRef          = useRef([]);       // accumulated Float32Array frames
  const speechStartRef     = useRef(null);     // Date.now() when speech began
  const silenceMsRef       = useRef(0);        // consecutive silence milliseconds
  const maxChunkTimerRef   = useRef(null);
  const chunkStartTimeRef  = useRef(null);

  // TTS / ducking
  const translationStreamRef = useRef(null);

  // ── Audio Ducking ──────────────────────────────────────────────────────────
  const duckRemoteAudio = useCallback(() => {
    remoteAudioRefs.forEach((ref) => { if (ref?.current) ref.current.volume = 0.1; });
  }, [remoteAudioRefs]);

  const restoreRemoteAudio = useCallback(() => {
    remoteAudioRefs.forEach((ref) => { if (ref?.current) ref.current.volume = 1.0; });
  }, [remoteAudioRefs]);

  // ── TTS Playback (for own language preview) ────────────────────────────────
  const playTTSAudio = useCallback(
    (audioBase64, mimeType = 'audio/mp3') =>
      new Promise((resolve) => {
        if (translationStreamRef.current) {
          translationStreamRef.current.pause();
          translationStreamRef.current.src = '';
        }
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        translationStreamRef.current = audio;
        audio.onplay   = () => duckRemoteAudio();
        audio.onended  = () => { restoreRemoteAudio(); resolve(); };
        audio.onerror  = () => { restoreRemoteAudio(); resolve(); };
        audio.play().catch(() => { restoreRemoteAudio(); resolve(); });
      }),
    [duckRemoteAudio, restoreRemoteAudio]
  );

  // ── Flush: encode accumulated PCM frames as WAV and emit via socket ────────
  const flushChunk = useCallback(() => {
    clearTimeout(maxChunkTimerRef.current);
    speechStartRef.current   = null;
    silenceMsRef.current     = 0;

    const frames = framesRef.current;
    framesRef.current = [];

    if (!socket?.connected || frames.length === 0) return;

    const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
    const wavBuffer  = encodeWav(frames, sampleRate);

    // Reject tiny blobs — almost certainly silence
    if (wavBuffer.byteLength < 2000) return;

    const flushTime = Date.now();
    socket.emit('audio-chunk', wavBuffer, {
      roomCode,
      speakerName,
      mimeType:         'audio/wav',
      captureStartTime: chunkStartTimeRef.current ?? flushTime,
      flushTime,
    });
    console.log(
      `📤 [Speech] Emitted audio-chunk (WAV, ${(wavBuffer.byteLength / 1024).toFixed(1)}KB) for room ${roomCode}`
    );
  }, [socket, roomCode, speakerName]);

  // ── VAD: called for every ~20ms worklet frame ──────────────────────────────
  const processFrame = useCallback(
    (samples /* Float32Array */) => {
      // Accumulate frame
      framesRef.current.push(samples);

      // Compute RMS energy for this frame
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms        = Math.sqrt(sum / samples.length);
      const isSpeaking = rms > VAD_CONFIG.SILENCE_THRESHOLD;

      if (isSpeaking) {
        silenceMsRef.current = 0;

        if (!speechStartRef.current) {
          speechStartRef.current    = Date.now();
          chunkStartTimeRef.current = Date.now();
          console.log('🎤 [VAD] Speech START');

          // Hard cap: flush even if the speaker never pauses
          maxChunkTimerRef.current = setTimeout(() => {
            if (framesRef.current.length > 0) {
              console.log('⏱️ [VAD] Max chunk reached — force flushing');
              flushChunk();
            }
          }, VAD_CONFIG.MAX_CHUNK_MS);
        }
      } else {
        silenceMsRef.current += VAD_CONFIG.FRAME_MS;

        if (
          silenceMsRef.current >= VAD_CONFIG.SILENCE_DURATION_MS &&
          speechStartRef.current &&
          Date.now() - speechStartRef.current >= VAD_CONFIG.MIN_SPEECH_MS
        ) {
          console.log('🔇 [VAD] Silence detected — flushing chunk');
          flushChunk();
        } else if (!speechStartRef.current && framesRef.current.length > 150) {
          // Bounded silence cycling: drop accumulated silence frames (keeps memory flat)
          // 150 frames × 20ms = 3 seconds of silence buffer cap
          framesRef.current = framesRef.current.slice(-50); // keep last 1s as context
        }
      }
    },
    [flushChunk]
  );

  // ── Start Translation ──────────────────────────────────────────────────────
  const startTranslation = useCallback(async () => {
    if (isTranslating || !stream) return;

    if (!window.AudioWorklet) {
      const msg = 'AudioWorklet is not supported in this browser. Use Chrome 66+ or Firefox 76+.';
      console.error('❌ [Speech]', msg);
      setError(msg);
      return;
    }

    try {
      // Clone the stream so the AudioWorklet capture doesn't disturb the WebRTC track
      const cloned = stream.clone();
      clonedStreamRef.current = cloned;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = ctx;

      // AudioContext may start suspended due to browser autoplay policy
      if (ctx.state === 'suspended') await ctx.resume();

      // Load and register the worklet module (Vite resolves ?url to the correct path)
      await ctx.audioWorklet.addModule(workletUrl);

      const workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor');
      workletNodeRef.current = workletNode;

      // Every ~20ms frame from the processor thread arrives here
      workletNode.port.onmessage = (e) => {
        if (e.data?.type === 'frame') {
          processFrame(e.data.samples);
        }
      };

      // Connect: cloned mic → worklet (no output needed — we just tap the data)
      const source = ctx.createMediaStreamSource(cloned);
      sourceNodeRef.current = source;
      source.connect(workletNode);
      // workletNode intentionally NOT connected to ctx.destination (prevents mic loopback)

      // Reset VAD state
      framesRef.current        = [];
      speechStartRef.current   = null;
      silenceMsRef.current     = 0;

      setIsTranslating(true);
      setError(null);
      console.log('🎙️ [Speech] Started AudioWorklet capture on cloned stream.');
    } catch (err) {
      console.error('❌ [Speech] Failed to start AudioWorklet:', err);
      setError('Could not start translation recording.');
    }
  }, [isTranslating, stream, processFrame]);

  // ── Stop Translation ───────────────────────────────────────────────────────
  const stopTranslation = useCallback(() => {
    if (!isTranslating) return;

    clearTimeout(maxChunkTimerRef.current);
    speechStartRef.current = null;
    framesRef.current      = [];

    // Signal the worklet to stop (returns false from process() — self-cleans)
    workletNodeRef.current?.port.postMessage({ type: 'stop' });
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;

    // Stop cloned stream tracks (does NOT stop the original WebRTC stream)
    clonedStreamRef.current?.getTracks().forEach((t) => t.stop());
    clonedStreamRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    translationStreamRef.current?.pause();
    if (translationStreamRef.current) translationStreamRef.current.src = '';

    restoreRemoteAudio();
    setIsTranslating(false);
    console.log('🛑 [Speech] Stopped.');
  }, [isTranslating, restoreRemoteAudio]);

  // ── Restart when stream changes (e.g. device switch) ──────────────────────
  useEffect(() => {
    if (isTranslating && stream) {
      stopTranslation();
      setTimeout(() => startTranslation(), 100);
    }
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isTranslating,
    error,
    startTranslation,
    stopTranslation,
    playTTSAudio,
    duckRemoteAudio,
    restoreRemoteAudio,
  };
};

export default useSpeechTranslation;
