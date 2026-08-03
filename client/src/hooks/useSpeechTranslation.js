/**
 * useSpeechTranslation.js
 *
 * Real-time Speech-to-Speech Translation Hook with Voice Activity Detection (VAD).
 *
 * Architecture:
 *   Browser MediaRecorder (VAD-sliced audio chunks, 2.5s–3.5s)
 *   → POST FormData → Colab FastAPI (Whisper + NLLB + Edge TTS)
 *   → Play base64 TTS audio (with audio ducking callbacks)
 *   → Save transcript to Node.js Express (POST /api/transcripts)
 *   → Update live subtitle state
 *
 * VAD Strategy (Browser-native, no external library needed):
 *   - WebRTC hardware DSP: noiseSuppression + echoCancellation + autoGainControl
 *   - Web Audio API AnalyserNode: RMS energy monitoring at 50ms intervals
 *   - Silence triggers chunk flush after 300ms of quiet (energy < threshold)
 *   - Hard max cap of 3.5s forces flush on continuous speech
 *   - Min speech floor of 1.0s ignores micro-clicks and noise bursts
 */

import { useState, useRef, useCallback } from 'react';
import api from '../services/api';

// ── VAD Configuration ─────────────────────────────────────────────────────────
const VAD_CONFIG = {
  SILENCE_THRESHOLD: 0.015,   // RMS energy level below which audio is "silent"
  SILENCE_DURATION_MS: 300,   // ms of silence required to trigger a chunk flush
  MIN_SPEECH_MS: 1000,        // minimum recorded speech before sending (ignores noise clicks)
  MAX_CHUNK_MS: 3500,         // hard cap: force flush if speaker hasn't paused
  ANALYSIS_INTERVAL_MS: 50,   // how often to sample audio energy (ms)
};

const useSpeechTranslation = ({
  meetingId,
  userId,
  speakerName,
  targetLanguages = ['en'],
  remoteAudioRefs = [],         // Array of refs to remote <audio>/<video> elements for ducking
  onSubtitle,                   // (subtitle: { speakerName, originalText, translatedText, lang }) => void
  onTranscriptEntry,            // (entry) => void — for live sidebar
  enabled = false,
}) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  // Refs (not state — to avoid stale closure issues in recorder callbacks)
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const chunksRef = useRef([]);            // accumulated MediaRecorder chunks
  const silenceTimerRef = useRef(null);
  const speechStartTimeRef = useRef(null);
  const maxChunkTimerRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const translationStreamRef = useRef(null); // active audio element for TTS playback
  const isFlushingRef = useRef(false);      // prevent concurrent flushes

  // ── Audio Ducking Helpers ────────────────────────────────────────────────────
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

  // ── TTS Playback ─────────────────────────────────────────────────────────────
  const playTTSAudio = useCallback(
    (audioBase64, mimeType = 'audio/mp3') => {
      return new Promise((resolve) => {
        // Stop any currently playing TTS
        if (translationStreamRef.current) {
          translationStreamRef.current.pause();
          translationStreamRef.current.src = '';
        }

        const audio = new Audio(
          `data:${mimeType};base64,${audioBase64}`
        );
        translationStreamRef.current = audio;

        audio.onplay = () => duckRemoteAudio();
        audio.onended = () => {
          restoreRemoteAudio();
          resolve();
        };
        audio.onerror = () => {
          restoreRemoteAudio();
          resolve();
        };

        audio.play().catch(() => {
          restoreRemoteAudio();
          resolve();
        });
      });
    },
    [duckRemoteAudio, restoreRemoteAudio]
  );

  // ── Send Audio Chunk to FastAPI ───────────────────────────────────────────────
  const flushChunk = useCallback(async () => {
    if (isFlushingRef.current || chunksRef.current.length === 0) return;
    isFlushingRef.current = true;

    const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
    chunksRef.current = [];

    // Discard tiny blobs (< 4KB) — almost certainly silence or noise
    if (blob.size < 4096) {
      isFlushingRef.current = false;
      return;
    }

    const formData = new FormData();
    formData.append('audio', blob, 'chunk.webm');
    formData.append('meeting_id', meetingId);
    formData.append('user_id', userId);
    formData.append('speaker_name', speakerName);
    formData.append('target_languages', JSON.stringify(targetLanguages));
    formData.append('include_audio', 'true');

    try {
      const aiServiceUrl = import.meta.env.VITE_AI_SERVICE_URL;
      if (!aiServiceUrl) throw new Error('VITE_AI_SERVICE_URL is not configured.');

      const response = await fetch(`${aiServiceUrl}/api/process-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`FastAPI returned ${response.status}`);

      const data = await response.json();

      // Guard: no transcript if nothing was transcribed / no_speech
      if (!data.original_text || data.original_text.trim() === '') {
        isFlushingRef.current = false;
        return;
      }

      const { original_text, source_language, translations, audio_translations } = data;

      // ── Persist transcript entry to Node.js backend ─────────────────────────
      try {
        await api.post('/transcripts', {
          meetingId,
          speakerId: userId,
          speakerName,
          sourceLanguage: source_language,
          originalText: original_text,
          translations,
        });
      } catch (saveErr) {
        console.warn('⚠️ [Speech] Failed to persist transcript:', saveErr.message);
      }

      // ── Update live transcript sidebar state ─────────────────────────────────
      if (onTranscriptEntry) {
        onTranscriptEntry({
          speakerId: userId,
          speakerName,
          originalText: original_text,
          sourceLanguage: source_language,
          translations,
          timestamp: new Date(),
        });
      }

      // ── Play TTS audio + show subtitles for each target language ─────────────
      for (const lang of targetLanguages) {
        const audioResult = audio_translations?.[lang];
        const translatedText = translations?.[lang] || '';

        // Show subtitle overlay
        if (onSubtitle) {
          onSubtitle({
            speakerName,
            originalText: original_text,
            translatedText,
            lang,
          });
        }

        // Play translated TTS audio (with ducking)
        if (audioResult?.audio_base64) {
          await playTTSAudio(audioResult.audio_base64, audioResult.mime_type);
        }
      }
    } catch (err) {
      console.error('❌ [Speech] Translation pipeline error:', err.message);
      setError(err.message);
    } finally {
      isFlushingRef.current = false;
    }
  }, [
    meetingId, userId, speakerName, targetLanguages,
    playTTSAudio, onSubtitle, onTranscriptEntry,
  ]);

  // ── VAD: Watch Audio Energy via Web Audio AnalyserNode ────────────────────────
  const startVAD = useCallback(
    (stream) => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current.connect(analyserRef.current);

      const dataArray = new Float32Array(analyserRef.current.fftSize);
      let silenceDuration = 0;

      vadIntervalRef.current = setInterval(() => {
        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Calculate RMS energy
        const rms = Math.sqrt(
          dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
        );

        const isSpeaking = rms > VAD_CONFIG.SILENCE_THRESHOLD;

        if (isSpeaking) {
          silenceDuration = 0;
          clearTimeout(silenceTimerRef.current);

          // Start tracking speech start time (for min speech duration check)
          if (!speechStartTimeRef.current) {
            speechStartTimeRef.current = Date.now();
            // Set max chunk hard cap
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
            // Speaker paused — flush the accumulated audio chunk
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

  // ── Start Recording ───────────────────────────────────────────────────────────
  const startTranslation = useCallback(async () => {
    if (isTranslating) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,   // Browser hardware: filter fans, AC, hiss
          echoCancellation: true,   // Prevent speaker audio re-entering mic
          autoGainControl: true,    // Normalize speaker volume
          channelCount: 1,
          sampleRate: 16000,        // Whisper optimal sample rate
        },
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
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

      startVAD(stream);
      setIsTranslating(true);
      setError(null);
      console.log('🎙️ [SpeechTranslation] Started with VAD + noise suppression.');
    } catch (err) {
      console.error('❌ [SpeechTranslation] Failed to start:', err.message);
      setError('Could not access microphone for translation.');
    }
  }, [isTranslating, startVAD]);

  // ── Stop Recording ────────────────────────────────────────────────────────────
  const stopTranslation = useCallback(() => {
    if (!isTranslating) return;

    clearInterval(vadIntervalRef.current);
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxChunkTimerRef.current);
    speechStartTimeRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
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
    console.log('🛑 [SpeechTranslation] Stopped.');
  }, [isTranslating, restoreRemoteAudio]);

  return {
    isTranslating,
    error,
    startTranslation,
    stopTranslation,
  };
};

export default useSpeechTranslation;
