# AUDIO_PIPELINE.md — Audio Capture, Transport & Playback

# LinguaMeet — Audio Pipeline Specification

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [AI_PIPELINE.md](file:///c:/Final%20Year/Final-year/docs/AI_PIPELINE.md), [REALTIME.md](file:///c:/Final%20Year/Final-year/docs/REALTIME.md), [TECHNICAL_SPEC.md](file:///c:/Final%20Year/Final-year/docs/TECHNICAL_SPEC.md)

---

## 1. End-to-End Audio Flow

```
Speaker's Browser                                         Listener's Browser
┌────────────────┐                                       ┌────────────────────┐
│ Mic → getUserMedia                                     │                    │
│   │                                                    │ WebRTC:            │
│   ├── WebRTC track ──── P2P ──────────────────────────>│ Original audio     │
│   │   (original audio)                                 │ → <audio> element  │
│   │                                                    │                    │
│   └── MediaStream.clone()                              │ Socket.IO:         │
│       │                                                │ translation-result │
│       ├── MediaRecorder (250ms timeslice)               │ → Audio queue      │
│       │   accumulates WebM Opus blobs                  │ → Duck original    │
│       │                                                │ → Play TTS audio   │
│       ├── VAD (Web Audio AnalyserNode)                 │ → Subtitle overlay │
│       │   RMS energy monitoring                        │                    │
│       │   silence detection → flush trigger            └────────────────────┘
│       │
│       └── Flush: emit('audio-chunk', blob)
│           → Node.js server
│           → AI service (STT → NMT → TTS)
│           → Server routes result to listeners
└────────────────┘
```

---

## 2. Audio Capture

### 2.1 Stream Acquisition

**File**: [`useAudioCapture.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useAudioCapture.js)

```javascript
// Current implementation
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  },
  video: true,
});
```

**Current problem**: `useSpeechTranslation.js` calls `getUserMedia` a **second time** for its own recording stream. This creates two independent mic captures, causing potential device contention and doubled resource usage.

**Target solution** (Phase 1): Share a single stream:
1. `useAudioCapture` acquires the stream (unchanged)
2. `useSpeechTranslation` receives the stream as a parameter
3. Uses `stream.clone()` for the MediaRecorder to avoid interference with WebRTC tracks

### 2.2 Stream Sharing Architecture

```
getUserMedia() → MediaStream
  ├── Original tracks → RTCPeerConnection (WebRTC)
  └── stream.clone() → MediaRecorder (translation chunking)
                      → AudioContext.createMediaStreamSource() (VAD analysis)
```

> [!IMPORTANT]
> `MediaStream.clone()` creates new `MediaStreamTrack` instances that reference the same underlying audio source. Stopping a cloned track does NOT stop the original. This ensures WebRTC audio continues even if translation recording is stopped.

---

## 3. Voice Activity Detection (VAD)

### 3.1 Current Implementation

**File**: [`useSpeechTranslation.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useSpeechTranslation.js)

**Algorithm**: RMS energy threshold with silence timer

```
┌─────────────────────────────────────────┐
│         VAD State Machine               │
│                                         │
│  IDLE ──(RMS > threshold)──> SPEAKING   │
│   ▲                             │       │
│   │                     (RMS < threshold │
│   │                      for 700ms)     │
│   │                             │       │
│   │                             ▼       │
│   └──(chunk ≥ 1000ms)── SILENCE_WAIT   │
│                                         │
│  At any point:                          │
│   chunk ≥ 3500ms → FORCE_FLUSH         │
└─────────────────────────────────────────┘
```

### 3.2 VAD Parameters

| Parameter | Value | Purpose |
|---|---|---|
| `SILENCE_THRESHOLD` | `0.01` | RMS energy cutoff (0-1 normalized) |
| `SILENCE_DURATION_MS` | `700` | Silence required to trigger flush |
| `MIN_CHUNK_MS` | `1000` | Minimum chunk length before flush allowed |
| `MAX_CHUNK_MS` | `3500` | Maximum chunk length (force flush) |
| `RECORDER_TIMESLICE_MS` | `250` | MediaRecorder produces a blob every 250ms |

### 3.3 RMS Calculation

```javascript
// From Web Audio AnalyserNode
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

let sum = 0;
for (let i = 0; i < dataArray.length; i++) {
  const normalized = dataArray[i] / 255;
  sum += normalized * normalized;
}
const rms = Math.sqrt(sum / dataArray.length);
// rms ranges from 0 (silence) to ~0.3-0.5 (loud speech)
```

### 3.4 Known VAD Issues

1. **`isFlushingRef` gate drops audio**: If a flush is in progress (network call pending) and the max chunk timer fires, the chunk is silently dropped. This means audio can be lost during slow network conditions.

2. **Threshold is fixed**: `SILENCE_THRESHOLD = 0.01` may be too low for noisy environments or too high for quiet speakers. No adaptive thresholding.

3. **No noise gate**: Background noise (fan, typing) above 0.01 RMS keeps the recorder active indefinitely until `MAX_CHUNK_MS` forces a flush.

### 3.5 Planned VAD Improvements

| Change | Phase | Rationale |
|---|---|---|
| Reduce `MAX_CHUNK_MS` from 3500 to 2500 | Phase 1 | Faster turnaround, smaller chunks |
| Add concurrent flush support (don't gate on `isFlushingRef`) | Phase 1 | Prevent audio loss during slow flushes |
| Adaptive threshold based on ambient noise | Post-MVP | Better accuracy in varied environments |

---

## 4. Audio Recording

### 4.1 MediaRecorder Configuration

```javascript
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/mp4';  // Safari fallback

const recorder = new MediaRecorder(clonedStream, {
  mimeType: mimeType,
  audioBitsPerSecond: 128000,  // 128 kbps
});

recorder.start(250);  // Produce blob every 250ms
```

### 4.2 Chunk Accumulation

```
Time: 0ms    250ms   500ms   750ms   1000ms  1250ms  ...
      │       │       │       │        │       │
      ▼       ▼       ▼       ▼        ▼       ▼
    blob_0  blob_1  blob_2  blob_3   blob_4  blob_5  ...
      │       │       │       │        │       │
      └───────┴───────┴───────┴────────┴───────┘
                        │
                   VAD detects silence (after blob_5)
                   chunk duration ≥ MIN_CHUNK_MS
                        │
                        ▼
              Flush: Blob([blob_0...blob_5], {type: mimeType})
              → Single WebM file (~15-50 KB for 1-2.5s audio)
```

### 4.3 Audio Size Estimates

| Duration | Encoding | Bitrate | Size |
|---|---|---|---|
| 1.0s | WebM Opus | 128 kbps | ~16 KB |
| 2.0s | WebM Opus | 128 kbps | ~32 KB |
| 3.5s | WebM Opus | 128 kbps | ~56 KB |

### 4.4 Browser Compatibility

| Browser | MediaRecorder MIME | Notes |
|---|---|---|
| Chrome 49+ | `audio/webm;codecs=opus` | Primary target |
| Firefox 29+ | `audio/webm;codecs=opus` | Works |
| Edge 79+ | `audio/webm;codecs=opus` | Works |
| Safari 14.5+ | `audio/mp4` | **No WebM support**. Must detect and use MP4. Whisper handles both. |

> [!WARNING]
> The current implementation hardcodes `audio/webm;codecs=opus` without runtime detection. Safari users will get a `NotSupportedError` from MediaRecorder. Phase 1 adds MIME type detection.

---

## 5. Audio Transport

### 5.1 Current: HTTP POST to AI Service (Direct)

```
Client → HTTP POST multipart/form-data → AI Service (Ngrok)
         ↑ Contains audio file + metadata fields
         └─ Response: JSON with translations + base64 audio
```

**Problems**:
- Bypasses server (no orchestration, no deduplication)
- Exposes AI service URL to client
- Per-request connection overhead
- Ngrok adds 200-500ms latency

### 5.2 Target: Socket.IO Binary to Server

```
Client → socket.emit('audio-chunk', blob, metadata) → Node.js Server
         Server → HTTP POST multipart → AI Service
         Server → socket.emit('translation-result') → Target Clients
```

**Advantages**:
- Reuses existing Socket.IO connection
- Server controls routing and deduplication
- AI service URL is server-side only
- No per-request connection overhead

### 5.3 Socket.IO Binary Transport

Socket.IO 4.x supports binary payloads natively. When a `Buffer` or `Blob` is included in an emit, Socket.IO:
1. Extracts binary data from the payload
2. Sends binary as separate WebSocket frames
3. Reassembles on the receiving end

```javascript
// Client (sender)
socket.emit('audio-chunk', audioBlob, {
  roomCode: 'abc-defg-hij',
  userId: 'user123',
  speakerName: 'Alice',
  sequenceNumber: 42,
  timestamp: Date.now()
});

// Server (receiver)
socket.on('audio-chunk', (audioBuffer, metadata) => {
  // audioBuffer is a Node.js Buffer
  // metadata is the JSON object
});
```

**Payload size limit**: Socket.IO `maxHttpBufferSize` defaults to 1 MB. Audio chunks are 15-56 KB. Safe.

---

## 6. Audio Playback

### 6.1 TTS Audio Format

| Source | Format | MIME Type |
|---|---|---|
| Edge TTS | MP3 | `audio/mp3` |
| gTTS | MP3 | `audio/mp3` |
| Sarvam AI | WAV | `audio/wav` |

### 6.2 Playback Mechanism

```javascript
// Current implementation (in useSpeechTranslation.js)
const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
audio.volume = 1.0;
audio.play();
```

### 6.3 Target Playback Queue (TO BE BUILT)

**File**: `useTranslationReceiver.js` (to be created in Phase 3)

```
Queue Behavior:
  - Max queue size: 3 audio items
  - On overflow: drop oldest, keep newest
  - Play sequentially (one at a time)
  - On play start: duck remote audio to 20%
  - On play end: restore remote audio to 100%
  - Show subtitle overlay during playback (4s auto-fade)

State:
  queue: AudioItem[]        // { audioBase64, mimeType, text, speakerName, lang }
  isPlaying: boolean
  currentSubtitle: object | null
```

### 6.4 Audio Ducking

When translated TTS audio plays, the original WebRTC audio from the speaker should be reduced in volume to avoid confusion.

```
Normal state:
  Remote audio volume: 100%
  TTS audio: not playing

During TTS playback:
  Remote audio volume: 20% (ducked)
  TTS audio: 100%

After TTS ends:
  Remote audio volume: 100% (restored)
```

**Implementation**: Modify the `volume` property on the `<audio>` or `<video>` element for the speaking participant's remote stream.

> [!NOTE]
> Audio ducking targets are determined by the `speakerId` in the `translation-result` event. Only the remote stream from that specific speaker is ducked, not all remote streams.

---

## 7. Audio Quality Considerations

### 7.1 Capture Quality

| Parameter | Value | Rationale |
|---|---|---|
| Sample rate | 16000 Hz (target) | Whisper optimal input rate |
| Channels | 1 (mono) | Speech is mono; stereo doubles size |
| Codec | Opus | Excellent speech compression |
| Noise suppression | Enabled | Reduces background noise for better STT |
| Echo cancellation | Enabled | Prevents feedback loops |
| Auto gain control | Enabled | Normalizes volume across speakers |

### 7.2 TTS Output Quality

| Engine | Sample Rate | Quality | Latency |
|---|---|---|---|
| Edge Neural TTS | 24000 Hz | Studio-grade | 0.3-1.5s |
| gTTS | 22050 Hz | Acceptable | 0.5-2s |
| Sarvam AI | 22050 Hz | Good (Indian langs) | 0.5-2s |

### 7.3 Audio Codec Chain

```
Mic (48kHz PCM) → Browser resample (16kHz) → Opus encode → WebM container
    → Network → Whisper (16kHz input) → NLLB (text) → Edge TTS → MP3 (24kHz)
    → Base64 → Network → Browser → Audio element → Speaker
```

---

## 8. Known Resource Leaks

| # | Leak | File | Impact | Fix |
|---|---|---|---|---|
| 1 | `AudioContext` created on every stream change | `useAudioVolume.js` | Chrome limits ~6 AudioContexts per page | Use singleton or close previous |
| 2 | MediaRecorder stream not always cleaned up on rapid start/stop | `useSpeechTranslation.js` | Mic stays active after leaving meeting | Add cleanup in `useEffect` return |
| 3 | Cloned streams not explicitly stopped on unmount | — | Mic indicator stays on | Stop cloned tracks in cleanup |
