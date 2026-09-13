/**
 * Direct diagnostic test: Sends a test audio to the AI service and prints the full response.
 * Run: node test_ai_service.js
 */
import axios from 'axios';
import FormData from 'form-data';
import { Buffer } from 'buffer';

const AI_URL = process.env.AI_SERVICE_URL || 'https://e288-34-143-232-189.ngrok-free.app';

// Generate a simple WAV file with a 440Hz tone (beep) - 1 second
function generateTestWav() {
  const sampleRate = 16000;
  const duration = 1; // seconds
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4;
  buffer.writeUInt16LE(2, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 * 32767;
    buffer.writeInt16LE(Math.round(sample), offset);
    offset += 2;
  }

  return buffer;
}

async function testAIService() {
  console.log(`\n🔬 Testing AI service at: ${AI_URL}\n`);

  // 1. Health check
  try {
    const health = await axios.get(`${AI_URL}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      timeout: 10000,
    });
    console.log('✅ Health check:', JSON.stringify(health.data, null, 2));
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
    return;
  }

  // 2. Send test audio (WAV tone)
  console.log('\n📤 Sending test WAV audio (1s 440Hz tone)...');
  const wavBuffer = generateTestWav();
  
  const form = new FormData();
  form.append('audio', wavBuffer, { filename: 'test.wav', contentType: 'audio/wav' });
  form.append('meeting_id', 'test-diagnostic');
  form.append('user_id', 'test-user');
  form.append('speaker_name', 'Diagnostic');
  form.append('target_languages', JSON.stringify(['hi']));
  form.append('include_audio', 'false');
  form.append('mime_type', 'audio/wav');

  try {
    const start = Date.now();
    const res = await axios.post(`${AI_URL}/api/process-audio`, form, {
      headers: {
        ...form.getHeaders(),
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const elapsed = Date.now() - start;
    console.log(`\n✅ Response received in ${elapsed}ms:`);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Process audio failed:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testAIService();
