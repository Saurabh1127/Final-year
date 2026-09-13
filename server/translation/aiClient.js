/**
 * aiClient.js
 *
 * HTTP client wrapper for the FastAPI AI microservice.
 * Handles multipart form POSTs with timeout, 1 retry on 5xx, and structured errors.
 */

import axios from 'axios';
import FormData from 'form-data';

const REQUEST_TIMEOUT_MS = 15_000; // 15s — enforced low-latency pipeline

class AIServiceError extends Error {
  constructor(message, type, statusCode) {
    super(message);
    this.name = 'AIServiceError';
    this.type = type;       // 'service_down' | 'bad_audio' | 'rate_limit' | 'unknown'
    this.statusCode = statusCode;
  }
}

/**
 * Send an audio buffer to the AI service for Speech-to-Speech Translation.
 *
 * @param {Buffer} audioBuffer   - Raw audio bytes (WebM/Opus)
 * @param {string} fileName      - Filename hint for the form field (e.g. 'chunk.webm')
 * @param {string} mimeType      - MIME type of audio buffer
 * @param {string} meetingId
 * @param {string} userId
 * @param {string} speakerName
 * @param {string[]} targetLanguages - NLLB language codes (e.g. ['hi', 'en'])
 * @returns {Promise<Object>}    - { original_text, source_language, translations, audio_translations, latency }
 */
export async function processAudio({
  audioBuffer,
  fileName = 'chunk.webm',
  mimeType = 'audio/webm;codecs=opus',
  meetingId,
  userId,
  speakerName,
  targetLanguages = [],
}) {
  // Build a FRESH FormData for each attempt — streams are consumed after one POST,
  // so reusing the same FormData on retry would send an empty body.
  const buildForm = () => {
    const form = new FormData();
    form.append('audio', audioBuffer, { filename: fileName, contentType: mimeType });
    form.append('meeting_id', meetingId);
    form.append('user_id', userId);
    form.append('speaker_name', speakerName);
    form.append('target_languages', JSON.stringify(targetLanguages));
    form.append('include_audio', 'true');
    form.append('mime_type', mimeType);
    return form;
  };

  const makeRequest = async () => {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const form = buildForm();
    const response = await axios.post(
      `${aiUrl}/api/process-audio`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: REQUEST_TIMEOUT_MS,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return response.data;
  };

  try {
    return await makeRequest();
  } catch (err) {
    // One retry on 5xx or network timeouts
    if (!err.response || err.response.status >= 500) {
      console.warn('⚠️ [AIClient] First attempt failed, retrying once…', err.message);
      try {
        return await makeRequest();
      } catch (retryErr) {
        console.error('🔥 [AIClient] Full Retry Error:', retryErr.message);
        const status = retryErr.response?.status;
        const type = !retryErr.response ? 'service_down' : status >= 500 ? 'service_down' : 'unknown';
        throw new AIServiceError(
          `AI service unavailable after retry: ${retryErr.message}`,
          type,
          status
        );
      }
    }

    const status = err.response?.status;
    let type = 'unknown';
    if (status === 400) type = 'bad_audio';
    if (status === 429) type = 'rate_limit';
    if (status >= 500) type = 'service_down';

    throw new AIServiceError(
      `AI service error (${status}): ${err.response?.data?.detail || err.message}`,
      type,
      status
    );
  }
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
