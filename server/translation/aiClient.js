/**
 * aiClient.js
 *
 * Phase 8 — Persistent WebSocket Connection to AI Service.
 *
 * Key change from Phase 1:
 *   - A single WebSocket connection is opened to the FastAPI AI service on startup.
 *   - All audio chunk requests are MULTIPLEXED over this one connection using jobIds.
 *   - Eliminates ~80–200ms of TCP + TLS + ngrok handshake overhead per utterance.
 *   - Auto-reconnects with exponential backoff if the connection drops.
 *   - Falls back to a fresh one-shot WebSocket if the persistent connection is
 *     unavailable (e.g. during reconnect), so no request is ever hard-failed.
 *
 * Public API (unchanged — orchestrator.js needs ZERO changes):
 *   processAudio({ audioBuffer, fileName, mimeType, meetingId, userId, speakerName, targetLanguages })
 *   → EventEmitter  (emits: 'text', 'audio_chunk', 'done', 'error')
 *
 *   checkHealth()
 *   → Promise<boolean>
 */

import axios from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ── Configuration ─────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS  = 1_000;   // Initial reconnect delay
const RECONNECT_MAX_MS   = 30_000;  // Maximum reconnect delay cap

// ── Error Type ────────────────────────────────────────────────────────────────

class AIServiceError extends Error {
  constructor(message, type, statusCode) {
    super(message);
    this.name = 'AIServiceError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

// ── Persistent Connection Manager ─────────────────────────────────────────────

/**
 * PersistentAIConnection
 *
 * Manages a single long-lived WebSocket to the FastAPI AI service.
 * Multiple in-flight jobs are multiplexed over this connection using job_id tags.
 *
 * State machine:
 *   DISCONNECTED → connecting → CONNECTED → (stays open) → DISCONNECTED → reconnecting…
 */
class PersistentAIConnection {
  constructor() {
    this._ws = null;
    this._connected = false;
    this._reconnectDelay = RECONNECT_BASE_MS;
    this._reconnectTimer = null;
    this._destroyed = false;

    /**
     * Pending jobs map.
     * Structure: Map<jobId: string, EventEmitter>
     * Each EventEmitter is the one returned to the caller of processAudio().
     */
    this._jobs = new Map();

    this._connect();
  }

  get isReady() {
    return this._connected && this._ws?.readyState === WebSocket.OPEN;
  }

  _getWsUrl() {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    return aiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/process-audio';
  }

  _connect() {
    if (this._destroyed) return;

    const url = this._getWsUrl();
    console.log(`🔌 [AIClient] Connecting persistent WebSocket → ${url}`);

    try {
      this._ws = new WebSocket(url);
    } catch (err) {
      console.error(`❌ [AIClient] Failed to create WebSocket: ${err.message}`);
      this._scheduleReconnect();
      return;
    }

    this._ws.on('open', () => {
      console.log(`✅ [AIClient] Persistent WebSocket connected. Reusing for all future requests.`);
      this._connected = true;
      this._reconnectDelay = RECONNECT_BASE_MS; // Reset backoff on successful connect
    });

    this._ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.warn('⚠️  [AIClient] Received non-JSON message on persistent WS, ignoring.');
        return;
      }

      const { job_id: jobId, ...rest } = msg;

      if (!jobId) {
        // Shouldn't happen with Phase 8 FastAPI, but be safe
        console.warn('⚠️  [AIClient] Received message without job_id — cannot route.');
        return;
      }

      const emitter = this._jobs.get(jobId);
      if (!emitter) {
        // Job may have already timed out or been cleaned up
        return;
      }

      this._routeMessage(emitter, jobId, rest);
    });

    this._ws.on('error', (err) => {
      console.error(`❌ [AIClient] Persistent WebSocket error: ${err.message}`);
      // Individual job errors are handled in _ws.on('close')
    });

    this._ws.on('close', (code, reason) => {
      console.warn(`⚠️  [AIClient] Persistent WebSocket closed (code ${code}). Reconnecting…`);
      this._connected = false;
      this._ws = null;

      // Fail all pending jobs that were in flight
      for (const [jobId, emitter] of this._jobs.entries()) {
        emitter.emit('error', new AIServiceError(
          'AI service connection dropped mid-request. Falling back to one-shot.',
          'connection_dropped',
          503
        ));
        this._jobs.delete(jobId);
      }

      this._scheduleReconnect();
    });
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return;

    console.log(`🔄 [AIClient] Reconnecting in ${this._reconnectDelay}ms…`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      // Exponential backoff capped at RECONNECT_MAX_MS
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS);
      this._connect();
    }, this._reconnectDelay);
  }

  /**
   * Send a new job on the persistent connection.
   * Returns true if sent successfully, false if not connected (caller should fallback).
   */
  send(jobId, payload) {
    if (!this.isReady) return false;
    try {
      this._ws.send(JSON.stringify({ job_id: jobId, ...payload }));
      return true;
    } catch (err) {
      console.error(`❌ [AIClient] Send failed for job ${jobId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Register an emitter for a job, so incoming messages can be routed to it.
   */
  registerJob(jobId, emitter) {
    this._jobs.set(jobId, emitter);
  }

  /**
   * Remove a job from the pending map (on completion or error).
   */
  removeJob(jobId) {
    this._jobs.delete(jobId);
  }

  /**
   * Route an incoming WebSocket message to the correct job's EventEmitter.
   */
  _routeMessage(emitter, jobId, msg) {
    if (msg.error) {
      emitter.emit('error', new AIServiceError(msg.error, 'unknown', 500));
      this._jobs.delete(jobId);
      return;
    }

    if (msg.type === 'text') {
      emitter.emit('text', msg);
    } else if (msg.type === 'audio_chunk') {
      emitter.emit('audio_chunk', msg);
    } else if (msg.type === 'done') {
      emitter.emit('done', msg.latency || { total_seconds: 0 });
      this._jobs.delete(jobId);
    } else if (msg.original_text !== undefined) {
      // Fallback for legacy format
      emitter.emit('text', msg);
      emitter.emit('done', msg.latency || { total_seconds: 0 });
      this._jobs.delete(jobId);
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}

// ── Module-level singleton — created once when Node.js server starts ──────────
const _persistentConnection = new PersistentAIConnection();

// ── Fallback: One-Shot WebSocket (Phase 1 behaviour) ─────────────────────────

/**
 * Send a request via a fresh WebSocket connection.
 * Used as a fallback when the persistent connection is unavailable.
 */
function _sendOneShotWebSocket(payload, emitter) {
  console.warn('⚡ [AIClient] Persistent connection unavailable — using one-shot WebSocket fallback.');

  let isFinished = false;
  const finish = (latency) => {
    if (isFinished) return;
    isFinished = true;
    clearTimeout(timeoutId);
    emitter.emit('done', latency || { total_seconds: 0 });
    if (ws?.readyState === WebSocket.OPEN) ws.close();
  };

  const timeoutId = setTimeout(() => {
    if (!isFinished) {
      isFinished = true;
      emitter.emit('error', new AIServiceError('One-shot WebSocket timed out', 'service_down', 504));
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
    setTimeout(() => emitter.emit('error', new AIServiceError('Failed to initialize fallback WebSocket', 'service_down', 500)), 0);
    return;
  }

  ws.on('open', () => {
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
        emitter.emit('text', msg);
        finish(msg.latency);
      }
    } catch (err) {
      console.warn('⚠️  [AIClient] Error parsing fallback WS message:', err);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeoutId);
    if (!isFinished) {
      isFinished = true;
      emitter.emit('error', new AIServiceError(`Fallback WebSocket error: ${err.message}`, 'service_down', 500));
    }
  });

  ws.on('close', () => {
    clearTimeout(timeoutId);
    if (!isFinished) finish();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an audio buffer to the AI service for Speech-to-Speech Translation.
 *
 * Uses the persistent WebSocket connection (Phase 8).
 * Falls back to a one-shot WebSocket if the persistent connection is unavailable.
 *
 * Returns an EventEmitter that emits: 'text', 'audio_chunk', 'done', 'error'.
 * (API is identical to Phase 1 — orchestrator.js needs no changes.)
 */
export function processAudio({
  audioBuffer,
  fileName = 'chunk.wav',
  mimeType = 'audio/wav',
  meetingId,
  userId,
  speakerName,
  targetLanguages = [],
  sourceLanguage = 'auto',
}) {
  const emitter = new EventEmitter();
  const jobId = randomUUID();

  const payload = {
    audio_base64: audioBuffer.toString('base64'),
    meeting_id: meetingId,
    user_id: userId,
    speaker_name: speakerName,
    source_language: sourceLanguage || 'auto',
    target_languages: targetLanguages,
    include_audio: true,
    mime_type: mimeType,
  };

  // ── Attempt to use persistent connection ────────────────────────────────────
  if (_persistentConnection.isReady) {
    console.log(`📤 [AIClient] Sending job ${jobId.slice(0, 8)} on persistent connection.`);

    // Set up timeout for this specific job
    const timeoutId = setTimeout(() => {
      if (_persistentConnection._jobs.has(jobId)) {
        _persistentConnection.removeJob(jobId);
        emitter.emit('error', new AIServiceError(
          `Job ${jobId.slice(0, 8)} timed out after ${REQUEST_TIMEOUT_MS}ms`,
          'timeout',
          504
        ));
      }
    }, REQUEST_TIMEOUT_MS);

    // Wrap the emitter to clear the timeout on completion/error
    const originalEmit = emitter.emit.bind(emitter);
    emitter.emit = (event, ...args) => {
      if (event === 'done' || event === 'error') {
        clearTimeout(timeoutId);
      }
      return originalEmit(event, ...args);
    };

    _persistentConnection.registerJob(jobId, emitter);
    const sent = _persistentConnection.send(jobId, payload);

    if (!sent) {
      // Connection became unavailable between isReady check and send — fall back
      _persistentConnection.removeJob(jobId);
      clearTimeout(timeoutId);
      _sendOneShotWebSocket(payload, emitter);
    }

    return emitter;
  }

  // ── Persistent connection unavailable — use one-shot fallback ───────────────
  _sendOneShotWebSocket(payload, emitter);
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
