/**
 * aiClient.js
 *
 * WebSocket client wrapper for the FastAPI AI microservice.
 * Connects to the streaming endpoint to receive TTS chunks in real-time.
 */

import axios from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

const REQUEST_TIMEOUT_MS = 30_000;

class AIServiceError extends Error {
  constructor(message, type, statusCode) {
    super(message);
    this.name = 'AIServiceError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

/**
 * Send an audio buffer to the AI service for Speech-to-Speech Translation via WebSockets.
 * Returns an EventEmitter that emits: 'text', 'audio_chunk', 'done', 'error'.
 */
export function processAudio({
  audioBuffer,
  fileName = 'chunk.webm',
  mimeType = 'audio/webm;codecs=opus',
  meetingId,
  userId,
  speakerName,
  targetLanguages = [],
}) {
  const emitter = new EventEmitter();
  
  let isFinished = false;
  const finish = (latency) => {
    if (isFinished) return;
    isFinished = true;
    clearTimeout(timeoutId);
    emitter.emit('done', latency || { total_seconds: 0 });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };

  // Use a timeout to abort if the connection hangs
  const timeoutId = setTimeout(() => {
    if (!isFinished) {
      isFinished = true;
      emitter.emit('error', new AIServiceError('WebSocket connection timed out', 'service_down', 504));
      if (ws) ws.close();
    }
  }, REQUEST_TIMEOUT_MS);

  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const wsUrl = aiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/process-audio';
  
  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    clearTimeout(timeoutId);
    setTimeout(() => emitter.emit('error', new AIServiceError('Failed to initialize WebSocket', 'service_down', 500)), 0);
    return emitter;
  }

  ws.on('open', () => {
    // Send the JSON payload
    const payload = {
      audio_base64: audioBuffer.toString('base64'),
      meeting_id: meetingId,
      user_id: userId,
      speaker_name: speakerName,
      source_language: "auto",
      target_languages: targetLanguages,
      include_audio: true,
      mime_type: mimeType
    };
    ws.send(JSON.stringify(payload));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.error) {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timeoutId);
          emitter.emit('error', new AIServiceError(msg.error, 'unknown', 500));
          ws.close();
        }
        return;
      }

      if (msg.type === 'text') {
        emitter.emit('text', msg);
      } else if (msg.type === 'audio_chunk') {
        emitter.emit('audio_chunk', msg);
      } else if (msg.type === 'done') {
        finish(msg.latency);
      } else if (msg.original_text !== undefined) {
        // Fallback for legacy format or silence response
        emitter.emit('text', msg);
        finish(msg.latency);
      }
    } catch (err) {
      console.warn('⚠️ [AIClient] Error parsing WS message:', err);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeoutId);
    if (!isFinished) {
      isFinished = true;
      emitter.emit('error', new AIServiceError(`WebSocket error: ${err.message}`, 'service_down', 500));
    }
  });

  ws.on('close', () => {
    clearTimeout(timeoutId);
    if (!isFinished) {
      finish();
    }
  });

  return emitter;
}

/**
 * Ping the AI service health endpoint.
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const res = await axios.get(`${aiUrl}/health`, { timeout: 5000 });
    return res.status === 200;
  } catch {
    return false;
  }
}
