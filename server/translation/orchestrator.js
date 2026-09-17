/**
 * orchestrator.js
 *
 * Server-side Translation Orchestrator.
 *
 * Responsibilities:
 *   1. Receive 'audio-chunk' Socket.IO binary event from a speaking participant.
 *   2. Look up all other participants in the room and their targetLanguage settings.
 *   3. Compute the unique set of target languages needed (excluding the speaker's own detected language).
 *   4. Call the FastAPI AI service (Whisper + NLLB + TTS).
 *   5. Emit 'translation-result' to each participant who wants that language.
 *   6. Persist the transcript entry to MongoDB via transcriptService.
 *
 * Socket events:
 *   Client → Server:  'audio-chunk'        { roomCode, speakerName, mimeType? }  (+ binary Buffer)
 *   Server → Client:  'translation-result' { speakerId, speakerName, originalText, sourceLanguage,
 *                                            translatedText, audioBase64, mimeType, lang, timestamp }
 *   Server → Client:  'translation-error'  { message }
 */

import { processAudio } from './aiClient.js';
import transcriptService from '../services/transcriptService.js';

/**
 * In-memory room participant map.
 * Structure: Map<roomCode, Map<socketId, { userId, speakerName, targetLanguage }>>
 *
 * This is populated and maintained by meetingHandlers.js via the exported helpers below.
 */
const roomParticipants = new Map();

/**
 * Per-room, per-speaker monotonic sequence counter.
 * Structure: Map<roomCode, Map<speakerId, number>>
 * Ensures translation-result events arrive in order on the client.
 */
const sequenceCounters = new Map();

function getNextSequence(roomCode, speakerId) {
  if (!sequenceCounters.has(roomCode)) {
    sequenceCounters.set(roomCode, new Map());
  }
  const roomCounters = sequenceCounters.get(roomCode);
  const current = roomCounters.get(speakerId) || 0;
  const next = current + 1;
  roomCounters.set(speakerId, next);
  return next;
}

// ── Participant Registry (called by meetingHandlers.js) ───────────────────────

/** Register or update a participant when they join / change language. */
export function registerParticipant(roomCode, socketId, { userId, speakerName, targetLanguage }) {
  if (!roomParticipants.has(roomCode)) {
    roomParticipants.set(roomCode, new Map());
  }
  roomParticipants.get(roomCode).set(socketId, { userId, speakerName, targetLanguage });
  console.log(
    `📋 [Orchestrator] Registered ${speakerName} in room ${roomCode} (lang: ${targetLanguage})`
  );
}

/** Remove a participant when they leave or disconnect. */
export function unregisterParticipant(roomCode, socketId) {
  if (roomParticipants.has(roomCode)) {
    const participant = roomParticipants.get(roomCode).get(socketId);
    if (participant?.userId) {
      activeSpeakers.delete(participant.userId);
      pendingChunkBySpeaker.delete(participant.userId);
    }
    roomParticipants.get(roomCode).delete(socketId);
    if (roomParticipants.get(roomCode).size === 0) {
      roomParticipants.delete(roomCode);
      sequenceCounters.delete(roomCode); // Clean up sequence counters
    }
  }
}

/** Update only the targetLanguage for an existing participant. */
export function updateParticipantLanguage(roomCode, socketId, targetLanguage) {
  const room = roomParticipants.get(roomCode);
  if (room && room.has(socketId)) {
    room.get(socketId).targetLanguage = targetLanguage;
    console.log(
      `🌐 [Orchestrator] Language updated for socket ${socketId} → ${targetLanguage}`
    );
  }
}

// ── Audio Chunk Handler ───────────────────────────────────────────────────────

// Active speaker tracking to serialize processing and prevent GPU overload / out-of-order speech
const activeSpeakers = new Set();
const pendingChunkBySpeaker = new Map();

export async function handleAudioChunk(io, socket, audioBuffer, metadata) {
  const speakerId = socket.user?.userId;
  const { roomCode, speakerName } = metadata || {};

  if (!roomCode || !speakerId || !audioBuffer) {
    socket.emit('translation-error', { message: 'Missing audio-chunk payload fields.' });
    return;
  }

  // If this speaker already has an AI translation job in flight, buffer the newest chunk
  // and discard older intermediate chunks so the speaker never lags behind live conversation.
  if (activeSpeakers.has(speakerId)) {
    pendingChunkBySpeaker.set(speakerId, { io, socket, audioBuffer, metadata });
    return;
  }

  activeSpeakers.add(speakerId);
  _processSpeakerChunk(io, socket, audioBuffer, metadata, speakerId);
}

async function _processSpeakerChunk(io, socket, audioBuffer, metadata, speakerId) {
  const serverReceiveTime = Date.now();
  const { roomCode, speakerName, mimeType = 'audio/webm;codecs=opus', captureStartTime, flushTime } = metadata || {};

  const onComplete = () => {
    if (pendingChunkBySpeaker.has(speakerId)) {
      const next = pendingChunkBySpeaker.get(speakerId);
      pendingChunkBySpeaker.delete(speakerId);
      _processSpeakerChunk(next.io, next.socket, next.audioBuffer, next.metadata, speakerId);
    } else {
      activeSpeakers.delete(speakerId);
    }
  };

  // Socket.IO delivers binary as ArrayBuffer — convert to Node.js Buffer for FormData compatibility
  const nodeBuffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

  // Skip tiny blobs (< 2000 bytes)
  console.log(`🎤 [Orchestrator] Received chunk from ${speakerName} in room ${roomCode} (${nodeBuffer.byteLength} bytes)`);
  if (nodeBuffer.byteLength < 2000) {
    console.log(`🔇 [Orchestrator] Chunk too small (${nodeBuffer.byteLength}b < 2000), skipping.`);
    onComplete();
    return;
  }

  const room = roomParticipants.get(roomCode);
  if (!room || room.size === 0) {
    console.log(`⚠️ [Orchestrator] Audio chunk dropped: room ${roomCode} has no registered participants.`);
    onComplete();
    return;
  }

  const isSoloTest = room.size === 1;

  // Collect unique target languages needed by participants in the room
  const targetLanguageSet = new Set();
  const languageToReceivers = new Map(); // lang → [ socketId ]

  for (const [sid, participant] of room.entries()) {
    // In multi-person meetings, don't send TTS audio back to the speaker (prevents audio echo/feedback)
    // BUT in solo test mode (1 person in room), send it to the speaker so they can hear & verify translation!
    if (!isSoloTest && sid === socket.id) continue;
    const lang = participant.targetLanguage || (isSoloTest ? 'hi' : 'en');
    targetLanguageSet.add(lang);
    if (!languageToReceivers.has(lang)) languageToReceivers.set(lang, []);
    languageToReceivers.get(lang).push(sid);
  }

  if (targetLanguageSet.size === 0) {
    onComplete();
    return;
  }

  const targetLanguages = [...targetLanguageSet];

  const emitter = processAudio({
    audioBuffer: nodeBuffer,
    fileName: 'chunk.webm',
    mimeType,
    meetingId: roomCode,
    userId: speakerId,
    speakerName,
    targetLanguages,
  });

  const timestamp = new Date();
  const sequenceNumber = getNextSequence(roomCode, speakerId);
  let textResult = null;

  emitter.on('text', async (msg) => {
    const { original_text, source_language, translations } = msg;
    textResult = msg;
    
    // Discard no-speech results
    if (!original_text || original_text.trim() === '' || original_text === '[Pipeline Error]') {
      console.log('🔇 [Orchestrator] AI detected silence or empty transcription.');
      return;
    }

    console.log(`🤖 [Orchestrator] Recognized (${source_language}): "${original_text}"`);
    console.log(`🌐 [Orchestrator] Translations:`, translations);

    const serverAiReturnTime = Date.now();

    // ── Persist transcript entry to MongoDB ─────────────────────────────────────
    try {
      await transcriptService.saveTranscript({
        meetingId: roomCode,
        speakerId,
        speakerName,
        sourceLanguage: source_language,
        originalText: original_text,
        translations,
      });
    } catch (saveErr) {
      console.warn('⚠️ [Orchestrator] Failed to persist transcript:', saveErr.message);
    }

    // Broadcast new-transcript to ALL participants
    io.to(roomCode).emit('new-transcript', {
      speakerId,
      speakerName,
      originalText: original_text,
      sourceLanguage: source_language,
      translations,
      timestamp,
      sequenceNumber,
      timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime, aiLatency: null } // Latency comes in 'done'
    });

    // Also send subtitle feedback to the speaker
    const firstTargetLang = targetLanguages[0];
    socket.emit('speaker-subtitle', {
      speakerName: 'You',
      originalText: original_text,
      translatedText: translations?.[firstTargetLang] || original_text,
      lang: firstTargetLang,
      timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime, aiLatency: null }
    });

    // ── Emit translation-result (Text) per language ──────
    for (const [lang, receiverSocketIds] of languageToReceivers.entries()) {
      const translatedText = translations?.[lang] || '';
      const textPayload = {
        speakerId,
        speakerName,
        originalText: original_text,
        sourceLanguage: source_language,
        translatedText,
        lang,
        timestamp,
        sequenceNumber,
        timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime, aiLatency: null }
      };

      for (const receiverSid of receiverSocketIds) {
        io.to(receiverSid).emit('translation-result', textPayload);
      }
    }
  });

  emitter.on('audio_chunk', (msg) => {
    const { lang, mime_type, audio_base64 } = msg;
    
    // Only send if receivers exist for this lang
    const receiverSocketIds = languageToReceivers.get(lang);
    if (!receiverSocketIds || receiverSocketIds.length === 0) return;

    if (audio_base64) {
      const audioBuffer = Buffer.from(audio_base64, 'base64');
      const audioMetadata = {
        speakerId,
        sequenceNumber,
        lang,
        mimeType: mime_type || 'audio/mp3',
      };
      for (const receiverSid of receiverSocketIds) {
        io.to(receiverSid).emit('translation-audio', audioBuffer, audioMetadata);
      }
    }
  });

  emitter.on('done', (latency) => {
    console.log(`✅ [Orchestrator] Stream complete. Metrics:`, latency);
    onComplete();
  });

  emitter.on('error', (err) => {
    console.error(`❌ [Orchestrator] AI service streaming error: ${err.message}`);
    socket.emit('translation-error', { message: 'Translation service streaming interrupted.' });
    onComplete();
  });
}
