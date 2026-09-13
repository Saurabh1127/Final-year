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
    roomParticipants.get(roomCode).delete(socketId);
    if (roomParticipants.get(roomCode).size === 0) {
      roomParticipants.delete(roomCode);
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

/**
 * Handle an incoming audio chunk from a participant.
 * Registered in socket/index.js as:  socket.on('audio-chunk', handleAudioChunk.bind(null, io, socket))
 */
export async function handleAudioChunk(io, socket, audioBuffer, metadata) {
  const { roomCode, speakerName, mimeType = 'audio/webm;codecs=opus' } = metadata || {};
  const speakerId = socket.user?.userId;

  if (!roomCode || !speakerId || !audioBuffer) {
    socket.emit('translation-error', { message: 'Missing audio-chunk payload fields.' });
    return;
  }

  // Socket.IO delivers binary as ArrayBuffer — convert to Node.js Buffer for FormData compatibility
  const nodeBuffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

  // Skip tiny blobs (< 1000 bytes) — use byteLength, NOT .length (ArrayBuffer has no .length)
  console.log(`🎤 [Orchestrator] Received chunk from ${speakerName} in room ${roomCode} (${nodeBuffer.byteLength} bytes)`);
  if (nodeBuffer.byteLength < 1000) {
    console.log(`🔇 [Orchestrator] Chunk too small (${nodeBuffer.byteLength}b), skipping.`);
    return;
  }

  const room = roomParticipants.get(roomCode);
  if (!room || room.size === 0) {
    console.log(`⚠️ [Orchestrator] Audio chunk dropped: room ${roomCode} has no registered participants.`);
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

  if (targetLanguageSet.size === 0) return;

  const targetLanguages = [...targetLanguageSet];

  console.log(
    `🎙️ [Orchestrator] Room ${roomCode} (${room.size} participant${room.size > 1 ? 's' : ''}): ${speakerName} speaking → translating to [${targetLanguages.join(', ')}]`
  );

  let result;
  try {
    result = await processAudio({
      audioBuffer: nodeBuffer,
      fileName: 'chunk.webm',
      mimeType,
      meetingId: roomCode,
      userId: speakerId,
      speakerName,
      targetLanguages,
    });
  } catch (err) {
    console.error(`❌ [Orchestrator] AI service error: ${err.message}`);
    socket.emit('translation-error', { message: 'Translation service temporarily unavailable.' });
    return;
  }

  const { original_text, source_language, translations, audio_translations } = result;

  // Discard no-speech results or pipeline errors
  if (!original_text || original_text.trim() === '' || original_text === '[Pipeline Error]') {
    console.log('🔇 [Orchestrator] AI detected silence or empty transcription.');
    return;
  }

  console.log(`🤖 [Orchestrator] Recognized (${source_language}): "${original_text}"`);
  console.log(`🌐 [Orchestrator] Translations:`, translations);

  const timestamp = new Date();

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

  // Broadcast new-transcript to ALL participants in the room (including the speaker!)
  io.to(roomCode).emit('new-transcript', {
    speakerId,
    speakerName,
    originalText: original_text,
    sourceLanguage: source_language,
    translations,
    timestamp,
  });

  // Also send subtitle feedback to the speaker so they can see what they said
  const firstTargetLang = targetLanguages[0];
  socket.emit('speaker-subtitle', {
    speakerName: 'You',
    originalText: original_text,
    translatedText: translations?.[firstTargetLang] || original_text,
    lang: firstTargetLang,
  });

  // ── Emit translation-result per language to only the relevant receivers ──────
  for (const [lang, receiverSocketIds] of languageToReceivers.entries()) {
    const audioResult = audio_translations?.[lang];
    const translatedText = translations?.[lang] || '';

    const payload = {
      speakerId,
      speakerName,
      originalText: original_text,
      sourceLanguage: source_language,
      translatedText,
      audioBase64: audioResult?.audio_base64 || null,
      mimeType: audioResult?.mime_type || 'audio/mp3',
      lang,
      timestamp,
    };

    for (const receiverSid of receiverSocketIds) {
      io.to(receiverSid).emit('translation-result', payload);
    }
  }

  console.log(
    `✅ [Orchestrator] Sent translation to ${[...languageToReceivers.values()].flat().length} listener(s)`
  );
}
