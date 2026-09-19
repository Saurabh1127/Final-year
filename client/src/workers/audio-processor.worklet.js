/**
 * audio-processor.worklet.js
 *
 * Phase 9 — AudioWorklet Capture
 *
 * Runs inside the browser's dedicated Audio Worklet thread (separate from JS main thread).
 * Receives 128-sample Float32 batches from the Web Audio render quantum, accumulates them
 * into ~20ms frames, and posts them to the main thread for VAD + transmission.
 *
 * Why 20ms frames?
 *   - 128 samples @ 48kHz = ~2.67ms per quantum — too small to VAD reliably.
 *   - Accumulating to ~20ms gives RMS energy a meaningful window without adding perceptible lag.
 *   - 20ms * 48 samples/ms = 960 samples per frame.
 */

const FRAME_SAMPLES = 960; // ~20ms at 48kHz (adjust at runtime if sampleRate differs)

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(FRAME_SAMPLES * 4); // ring buffer (4 frames headroom)
    this._writePos = 0;
    this._active = true;

    // Allow the main thread to shut us down cleanly
    this.port.onmessage = (e) => {
      if (e.data?.type === 'stop') this._active = false;
    };
  }

  process(inputs /*, outputs, parameters */) {
    if (!this._active) return false; // returning false disconnects + garbage-collects the node

    const channelData = inputs[0]?.[0]; // mono channel (channel 0)
    if (!channelData) return true;

    // Accumulate incoming 128-sample quantum into our buffer
    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._writePos++] = channelData[i];

      if (this._writePos >= FRAME_SAMPLES) {
        // One full ~20ms frame ready — copy and post to main thread
        const frame = this._buffer.slice(0, FRAME_SAMPLES);
        // Transfer ownership (zero-copy) of the underlying ArrayBuffer
        this.port.postMessage({ type: 'frame', samples: frame }, [frame.buffer]);

        // Reset write position (simple circular reset — no overlap needed here)
        this._writePos = 0;
      }
    }

    return true; // keep node alive
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
