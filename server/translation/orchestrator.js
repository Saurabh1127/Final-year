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
 *
 * Phase 6 — Per-Speaker State & Priority Queue:
 *   - Each speaker gets a dedicated queue (max depth = SPEAKER_QUEUE_MAX_DEPTH).
 *   - When the queue is full, the OLDEST chunk is evicted (we always want the freshest speech).
 *   - Chunks older than STALE_THRESHOLD_MS are silently skipped before processing.
 *   - Only ONE AI job runs per speaker at a time (single-flight concurrency).
 *   - Other speakers are completely unaffected by any one speaker's queue depth.
 */

import { processAudio } from './aiClient.js';
import transcriptService from '../services/transcriptService.js';

// ── Phase 6 Configuration ─────────────────────────────────────────────────────

/** Maximum chunks held in a speaker's queue at any moment (4 allows natural conversational flow without drops). */
const SPEAKER_QUEUE_MAX_DEPTH = 4;

/**
 * If a chunk has been waiting in the queue longer than this (ms), drop it.
 * 8000ms (8s) gives ample time for AI processing variations without discarding valid speech.
 */
const STALE_THRESHOLD_MS = 8000;

// ── Participant Registry ──────────────────────────────────────────────────────

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
      // Clean up the speaker's queue state
      speakerQueues.delete(participant.userId);
      speakerProcessing.delete(participant.userId);
    }
    roomParticipants.get(roomCode).delete(socketId);
    if (roomParticipants.get(roomCode).size === 0) {
      roomParticipants.delete(roomCode);
      sequenceCounters.delete(roomCode);
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

// ── Phase 6: Per-Speaker Queue State ─────────────────────────────────────────

/**
 * Per-speaker chunk queue.
 * Structure: Map<speakerId, Array<{ io, socket, audioBuffer, metadata, enqueuedAt }>>
 *
 * Each speaker has their own independent queue. Chunks are processed FIFO, but the
 * queue is capped at SPEAKER_QUEUE_MAX_DEPTH — oldest chunk is dropped when full.
 */
const speakerQueues = new Map();

/**
 * Tracks whether a speaker already has an AI job running.
 * Structure: Map<speakerId, boolean>
 *
 * If true → new chunks go into the queue.
 * If false → chunk can be processed immediately (starts a new job).
 */
const speakerProcessing = new Map();

/**
 * Enqueue a new audio chunk for a speaker.
 * If the queue is already at max depth, the oldest entry is evicted to make room.
 *
 * @param {string} speakerId
 * @param {{ io, socket, audioBuffer, metadata }} entry
 */
function _enqueueChunk(speakerId, entry) {
  if (!speakerQueues.has(speakerId)) {
    speakerQueues.set(speakerId, []);
  }
  const queue = speakerQueues.get(speakerId);

  if (queue.length >= SPEAKER_QUEUE_MAX_DEPTH) {
    const dropped = queue.shift(); // Evict the oldest (head) — keep the newest
    const age = Date.now() - dropped.enqueuedAt;
    console.log(
      `⚠️  [Orchestrator] Queue full for ${entry.metadata?.speakerName} — dropped oldest chunk (was ${age}ms old)`
    );
  }

  queue.push({ ...entry, enqueuedAt: Date.now() });
  console.log(
    `📥 [Orchestrator] Queued chunk for ${entry.metadata?.speakerName} (queue depth: ${queue.length})`
  );
}

/**
 * Pull the next chunk from a speaker's queue and process it.
 * Skips stale chunks automatically. Recurses until the queue is empty.
 *
 * @param {string} speakerId
 */
function _runSpeakerQueue(speakerId) {
  const queue = speakerQueues.get(speakerId);

  if (!queue || queue.length === 0) {
    // Nothing left — mark speaker as idle
    speakerProcessing.set(speakerId, false);
    return;
  }

  const next = queue.shift();
  const age = Date.now() - next.enqueuedAt;

  if (age > STALE_THRESHOLD_MS) {
    console.log(
      `⏩ [Orchestrator] Dropped stale chunk for ${next.metadata?.speakerName} (${age}ms old — threshold ${STALE_THRESHOLD_MS}ms)`
    );
    // Chunk is too old — skip it and try the next one immediately
    _runSpeakerQueue(speakerId);
    return;
  }

  // Process this chunk; when done, _runSpeakerQueue is called again
  _processSpeakerChunk(next.io, next.socket, next.audioBuffer, next.metadata, speakerId);
}

// ── Public Audio Chunk Handler ────────────────────────────────────────────────

/**
 * Entry point called by socket/index.js on every 'audio-chunk' event.
 * Enqueues the chunk for the speaker and starts the queue runner if idle.
 */
export async function handleAudioChunk(io, socket, audioBuffer, metadata) {
  const speakerId = socket.user?.userId;
  const { roomCode, speakerName } = metadata || {};

  if (!roomCode || !speakerId || !audioBuffer) {
    socket.emit('translation-error', { message: 'Missing audio-chunk payload fields.' });
    return;
  }

  _enqueueChunk(speakerId, { io, socket, audioBuffer, metadata });

  // If the speaker is already processing a chunk, the queue runner will pick this
  // up automatically when the current job finishes. No action needed here.
  if (speakerProcessing.get(speakerId)) {
    return;
  }

  // Speaker is idle — mark as processing and kick off the queue runner
  speakerProcessing.set(speakerId, true);
  _runSpeakerQueue(speakerId);
}

// ── Core Processing Logic ─────────────────────────────────────────────────────

async function _processSpeakerChunk(io, socket, audioBuffer, metadata, speakerId) {
  const serverReceiveTime = Date.now();
  const { roomCode, speakerName, mimeType = 'audio/wav', captureStartTime, flushTime, sourceLanguage } = metadata || {};

  // Called when this job is done — triggers the next chunk in queue (if any)
  const onComplete = () => _runSpeakerQueue(speakerId);

  // Socket.IO delivers binary as ArrayBuffer — convert to Node.js Buffer for FormData compatibility
  const nodeBuffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

  // Skip tiny blobs (< 2000 bytes — likely silence or malformed chunks)
  console.log(`🎤 [Orchestrator] Processing chunk from ${speakerName} in room ${roomCode} (${nodeBuffer.byteLength} bytes)`);

  // ── Phase 7: Subtitle-First — emit "Translating..." immediately ──────────────
  // Broadcast to ALL participants in the room (except the speaker) so listeners
  // see a "Translating…" indicator the moment processing starts — well before
  // Whisper/NLLB/TTS finishes (~500–800ms later).
  io.to(roomCode).emit('translation-pending', {
    speakerId,
    speakerName,
    timestamp: Date.now(),
  });
  if (nodeBuffer.byteLength < 2000) {
    console.log(`🔇 [Orchestrator] Chunk too small (${nodeBuffer.byteLength}b < 2000), skipping.`);
    onComplete();
    return;
  }

  const room = roomParticipants.get(roomCode);
  if (!room || room.size === 0) {
    console.log(`⚠️  [Orchestrator] Audio chunk dropped: room ${roomCode} has no registered participants.`);
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
    fileName: 'chunk.wav',
    mimeType,
    meetingId: roomCode,
    userId: speakerId,
    speakerName,
    targetLanguages,
    sourceLanguage: sourceLanguage || 'auto',
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
      console.warn('⚠️  [Orchestrator] Failed to persist transcript:', saveErr.message);
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
      timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime, aiLatency: null }
    });

    // In multi-person meetings, send subtitle feedback to the speaker immediately (they receive no audio).
    // In solo test mode, the speaker receives translation-audio, so the subtitle is synchronized with the audio.
    if (!isSoloTest) {
      const firstTargetLang = targetLanguages[0];
      socket.emit('speaker-subtitle', {
        speakerName: 'You',
        originalText: original_text,
        translatedText: translations?.[firstTargetLang] || original_text,
        lang: firstTargetLang,
        timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime, aiLatency: null }
      });
    }

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
      const translatedText = textResult?.translations?.[lang] || '';
      const audioMetadata = {
        speakerId,
        speakerName: isSoloTest ? 'You' : speakerName,
        originalText: textResult?.original_text || '',
        translatedText,
        sequenceNumber,
        lang,
        mimeType: mime_type || 'audio/mp3',
        timing: { captureStartTime, flushTime, serverReceiveTime, serverAiReturnTime: Date.now() }
      };
      for (const receiverSid of receiverSocketIds) {
        io.to(receiverSid).emit('translation-audio', audioBuffer, audioMetadata);
      }
    }
  });

  emitter.on('done', (latency) => {
    console.log(`✅ [Orchestrator] Stream complete for ${speakerName}. Metrics:`, latency);
    onComplete();
  });

  emitter.on('error', (err) => {
    console.error(`❌ [Orchestrator] AI service streaming error: ${err.message}`);
    socket.emit('translation-error', { message: 'Translation service streaming interrupted.' });
    onComplete();
  });
}
