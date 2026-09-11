# TECHNICAL_SPEC.md — Technical Specification

# LinguaMeet — Technical Specification

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [ARCHITECTURE.md](file:///c:/Final%20Year/Final-year/docs/ARCHITECTURE.md), [API.md](file:///c:/Final%20Year/Final-year/docs/API.md), [DATABASE.md](file:///c:/Final%20Year/Final-year/docs/DATABASE.md)

---

## 1. System Requirements

### 1.1 Client Requirements

| Requirement | Specification |
|---|---|
| Browser | Chrome 80+, Firefox 70+, Edge 80+, Safari 14+ |
| APIs required | WebRTC, MediaRecorder, Web Audio API, getUserMedia |
| Network | WebSocket support, UDP for WebRTC media |
| Bandwidth | ≥1 Mbps upload/download per participant |
| Audio input | Microphone with echo cancellation support |

### 1.2 Server Requirements

| Requirement | Specification |
|---|---|
| Runtime | Node.js 20+ |
| Memory | ≥512 MB |
| Network | Ports 5000 (HTTP + WebSocket) |
| Database | MongoDB 7.x (Atlas or self-hosted) |
| Environment | `.env` with `MONGO_URI`, `JWT_SECRET`, `AI_SERVICE_URL`, `GEMINI_API_KEY`, `METERED_API_KEY` |

### 1.3 AI Service Requirements

| Requirement | Specification |
|---|---|
| Runtime | Python 3.10+ |
| GPU (recommended) | NVIDIA T4 (16GB VRAM) or better |
| VRAM usage | Whisper-small: ~1GB, NLLB-600M: ~2.5GB, Total: ~4GB |
| CPU fallback | Possible but latency 5-15x slower |
| Network | Port 8000, outbound HTTPS for Edge TTS |
| Environment | `.env` with `WHISPER_MODEL`, `NLLB_MODEL`, `USE_SARVAM`, `SARVAM_API_KEY` |

---

## 2. Client Technical Specification

### 2.1 React Application Structure

```
client/
├── index.html                    # Vite entry point
├── vite.config.js                # Vite configuration
├── package.json                  # Dependencies
├── .env                          # VITE_API_URL, VITE_AI_SERVICE_URL
└── src/
    ├── main.jsx                  # React DOM root
    ├── App.jsx                   # Router + context providers
    ├── index.css                 # Global design system (CSS variables)
    ├── context/
    │   ├── AuthContext.jsx       # JWT auth state + localStorage
    │   └── SocketContext.jsx     # Socket.IO connection management
    ├── hooks/
    │   ├── useAudioCapture.js    # getUserMedia for mic + camera
    │   ├── useWebRTC.js          # Mesh peer connections
    │   ├── useAudioVolume.js     # RMS volume monitoring (active speaker)
    │   └── useSpeechTranslation.js  # VAD + audio chunking + AI service call
    ├── pages/
    │   ├── Login.jsx + Login.css
    │   ├── Register.jsx + Register.css
    │   ├── Home.jsx + Home.css
    │   ├── Meeting.jsx + Meeting.css
    │   └── MeetingSummary.jsx + MeetingSummary.css
    └── components/
        ├── Layout/
        │   ├── Navbar.jsx + Navbar.css
        │   └── ProtectedRoute.jsx
        └── Meeting/
            ├── MeetingRoom.jsx   # Main meeting orchestrator
            └── ControlBar.jsx    # Mic/cam/leave/translate controls
```

### 2.2 State Management

LinguaMeet uses React Context for global state and hook-local state for component-scoped concerns. No external state management library is used.

| Context | Provider Location | State |
|---|---|---|
| `AuthContext` | `App.jsx` | `{ user, token, isAuthenticated, loading }` |
| `SocketContext` | `App.jsx` (inside AuthContext) | `{ socket, isConnected }` |

| Hook | State (local) | Refs |
|---|---|---|
| `useAudioCapture` | `localStream`, `isMuted`, `isVideoOff` | `streamRef` |
| `useWebRTC` | `remoteStreams` (Map), `participants` | `peersRef` (Map of RTCPeerConnection), `pendingCandidatesRef` |
| `useAudioVolume` | — | `analyserRef`, `audioContextRef` |
| `useSpeechTranslation` | `isTranslating`, `translationError` | `mediaRecorderRef`, `chunksRef`, `silenceTimerRef`, `maxChunkTimerRef`, `isFlushingRef` |

### 2.3 Voice Activity Detection (VAD) — Current Implementation

File: [`useSpeechTranslation.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useSpeechTranslation.js)

```
Constants:
  SILENCE_THRESHOLD = 0.01        # RMS energy threshold (0-1 range)
  SILENCE_DURATION_MS = 700       # ms of silence before triggering flush
  MIN_CHUNK_MS = 1000             # minimum chunk length
  MAX_CHUNK_MS = 3500             # maximum chunk length (force flush)
  RECORDER_TIMESLICE_MS = 250     # MediaRecorder chunk interval

Algorithm:
  1. Create AudioContext + AnalyserNode from mic stream
  2. Every animation frame, compute RMS from frequency data
  3. If RMS < SILENCE_THRESHOLD:
     - Start silence timer (SILENCE_DURATION_MS)
     - If timer expires AND chunk >= MIN_CHUNK_MS → flush
  4. If RMS >= SILENCE_THRESHOLD:
     - Reset silence timer
     - Mark speaking start time
  5. If chunk duration >= MAX_CHUNK_MS → force flush regardless
  6. On flush:
     - Stop MediaRecorder → collect blob from accumulated chunks
     - Send to AI service via HTTP POST (currently) or Socket.IO (target)
     - Restart MediaRecorder for next chunk
```

### 2.4 WebRTC Mesh — Current Implementation

File: [`useWebRTC.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useWebRTC.js)

```
Connection flow:
  1. On 'participant-joined' Socket.IO event:
     - Create new RTCPeerConnection with TURN config
     - Add local tracks (audio + video) to connection
     - Create offer → set local description → emit via Socket.IO
  2. On 'webrtc-offer' received:
     - Create RTCPeerConnection
     - Set remote description (offer)
     - Add local tracks
     - Create answer → set local description → emit via Socket.IO
  3. On 'webrtc-answer' received:
     - Set remote description (answer)
  4. On 'webrtc-ice-candidate' received:
     - Add ICE candidate (queue if connection not ready)
  5. On 'track' event:
     - Add remote stream to remoteStreams map
     - Render in participant tile

TURN Configuration:
  - Provider: Metered (metered.ca)
  - Fetch: GET https://linguameet.metered.live/api/v1/turn/credentials?apiKey=<KEY>
  - Returns: Array of { urls, username, credential } TURN/STUN servers
  - BUG: API key is currently hardcoded in client-side code
```

### 2.5 Audio Capture Constraints

File: [`useAudioCapture.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useAudioCapture.js)

```javascript
// Current constraints
{
  audio: {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  },
  video: true
}

// Target constraints (with explicit sample rate for Whisper)
{
  audio: {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 16000,    // Whisper optimal
  },
  video: true
}
```

### 2.6 Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WebRTC | ✅ 56+ | ✅ 44+ | ✅ 11+ | ✅ 15+ |
| MediaRecorder (WebM/Opus) | ✅ 49+ | ✅ 29+ | ❌ MP4/AAC only | ✅ 79+ |
| Web Audio API | ✅ 35+ | ✅ 25+ | ✅ 14.1+ | ✅ 79+ |
| getUserMedia | ✅ 53+ | ✅ 36+ | ✅ 11+ | ✅ 12+ |

> [!WARNING]
> **Safari does not support WebM MediaRecorder output.** Safari produces `audio/mp4` instead of `audio/webm;codecs=opus`. The AI service (Whisper) handles both formats, but the client must detect the supported MIME type at runtime. This is currently not implemented.

---

## 3. Server Technical Specification

### 3.1 Express Application Setup

File: [`server.js`](file:///c:/Final%20Year/Final-year/server/server.js)

- HTTP server created from Express app
- Socket.IO attached to HTTP server
- CORS configured with `origin: true` (wildcard — **must be restricted**)
- JSON body parser with 10MB limit
- MongoDB connection via Mongoose on startup
- Process crash handlers for `uncaughtException` and `unhandledRejection`
- `io` instance attached to `app` via `app.set('io', io)` for route access

### 3.2 Authentication Flow

```
Register:
  POST /api/auth/register { name, email, password }
  → Validate inputs (name, email format, password ≥6 chars)
  → Check email uniqueness
  → Hash password (bcrypt, 10 salt rounds)
  → Create User document
  → Generate JWT (7-day expiry, payload: { userId })
  → Return { token, user: { id, name, email, preferredLanguage } }

Login:
  POST /api/auth/login { email, password }
  → Find user by email (include password field)
  → Compare password with bcrypt
  → Generate JWT
  → Return { token, user }

Auth Middleware:
  Extract token from Authorization: Bearer <token>
  → jwt.verify(token, JWT_SECRET)
  → Attach req.user (full User document) and req.userId
  → Applied to all protected routes
```

### 3.3 Socket.IO Connection Lifecycle

File: [`socket/index.js`](file:///c:/Final%20Year/Final-year/server/socket/index.js)

```
Connection:
  1. Client connects with { auth: { token: <JWT> } }
  2. Middleware verifies JWT → attaches socket.user = decoded payload
  3. 'connection' event fires → register meetingHandlers + signalingHandlers

Join Meeting:
  1. Client emits 'join-meeting' { roomCode, userId, displayName, targetLanguage }
  2. Server: socket.join(roomCode)
  3. Server: attach socket.roomCode, socket.userId, socket.displayName
  4. Server: update Meeting document (add/update participant, set isActive=true, set socketId)
  5. Server: emit 'participant-joined' to room (excluding sender)
  6. Server: emit 'existing-participants' to the joining socket

Leave / Disconnect:
  1. On disconnect: find Meeting by socket.roomCode
  2. Set participant.isActive = false, participant.socketId = null
  3. await meeting.save() — RACE CONDITION with concurrent join save
  4. Emit 'participant-left' to remaining room members
```

### 3.4 Translation Orchestrator (TO BE BUILT)

> [!NOTE]
> This component does not exist in the current codebase. It is the primary new module required for the product to function.

```
Location: server/translation/orchestrator.js

Responsibilities:
  1. Listen for 'audio-chunk' Socket.IO events
  2. Resolve room participants and their targetLanguage values
  3. Determine unique target languages (excluding speaker's detected language)
  4. Forward audio to AI service via HTTP POST
  5. Parse AI service response
  6. Route translation results to correct listeners via Socket.IO
  7. Save transcript to MongoDB
  8. Handle errors gracefully (AI service down, timeout, empty transcription)

Dependencies:
  - server/translation/aiClient.js (HTTP wrapper for AI service)
  - Socket.IO room membership
  - Meeting model (for participant language lookup)
  - Transcript model (for persistence)
```

---

## 4. AI Service Technical Specification

### 4.1 FastAPI Application

File: [`main.py`](file:///c:/Final%20Year/Final-year/ai-service/app/main.py)

- FastAPI with lifespan manager (model preloading)
- CORS wildcard (`allow_origins=["*"]`)
- Auto-detects CUDA GPU availability
- Models loaded lazily on first request

### 4.2 Pipeline Engine

File: [`pipeline.py`](file:///c:/Final%20Year/Final-year/ai-service/app/pipeline.py)

```python
class SpeechToSpeechEngine:
    def process(
        audio_bytes: bytes,
        target_languages: list[str] = ["en"],
        source_language: str | None = None,
        user_id: str = "unknown",
        speaker_name: str = "Anonymous",
        meeting_id: str = "unknown",
        include_audio: bool = True,
    ) -> dict:
        # Step 1: Whisper STT → { text, language }
        # Step 2: NLLB NMT → { lang: translated_text }
        # Step 3: Edge TTS / gTTS → { lang: { audio_base64, mime_type, engine } }
        # Returns combined result with latency metrics
```

### 4.3 Response Format

```json
{
  "original_text": "Hello, how are you?",
  "source_language": "en",
  "translations": {
    "hi": "नमस्ते, आप कैसे हैं?",
    "fr": "Bonjour, comment allez-vous ?"
  },
  "audio_translations": {
    "hi": {
      "audio_base64": "<base64 MP3 data>",
      "mime_type": "audio/mp3",
      "engine": "edge_tts"
    },
    "fr": {
      "audio_base64": "<base64 MP3 data>",
      "mime_type": "audio/mp3",
      "engine": "edge_tts"
    }
  },
  "speaker_id": "user123",
  "speaker_name": "Alice",
  "meeting_id": "abc-defg-hij",
  "timestamp": 1726056123.456,
  "latency": {
    "asr_seconds": 0.52,
    "nmt_seconds": 0.18,
    "tts_seconds": 0.91,
    "total_seconds": 1.61
  },
  "voice_retention": {
    "enabled": false,
    "engine": "xtts_v2",
    "status": "skeleton"
  }
}
```

---

## 5. Latency Budget

| Stage | Component | Min | Typical | Max | Notes |
|---|---|---|---|---|---|
| 1 | VAD accumulation | 1.0s | 2.0s | 3.5s | Silence detection + max chunk timer |
| 2 | Client → Server | 10ms | 50ms | 200ms | Socket.IO event |
| 3 | Server → AI Service | 10ms | 100ms | 500ms | HTTP POST via Ngrok or direct |
| 4 | Whisper STT | 0.3s | 0.5s | 0.8s | GPU (small model, 2.5s audio) |
| 5 | NLLB NMT | 0.1s | 0.2s | 0.4s | GPU (600M model) |
| 6 | Edge TTS | 0.3s | 0.8s | 1.5s | External API call |
| 7 | AI → Server → Client | 20ms | 150ms | 500ms | Response transit |
| **Total** | | **1.75s** | **3.8s** | **7.4s** | |

**Target**: ≤4s for P80, ≤6s for P95  
**Current estimate**: 4-8s (Ngrok adds latency)

---

## 6. Error Handling Strategy

| Error | Detection | Response | Recovery |
|---|---|---|---|
| Mic permission denied | `getUserMedia` rejection | Show error, allow join as viewer | Manual: user grants permission |
| Mic disconnected | `track.onended` event | Stop translation, show warning | Auto: detect new device |
| Socket.IO disconnect | `disconnect` event | Show reconnecting indicator | Auto: exponential backoff reconnect |
| WebRTC peer failure | `iceconnectionstatechange = 'failed'` | ICE restart attempt | Auto: 1 retry, then remove peer |
| AI service unreachable | HTTP timeout (15s) or error | Show "Translation unavailable" | Auto: retry after 30s, circuit breaker after 3 fails |
| STT returns empty | Empty `original_text` in response | Skip translation, no subtitle | Auto: next chunk |
| TTS fails | Exception in `synthesize_speech` | Show text-only subtitle | Auto: gTTS fallback already implemented |
| Translation timeout (>10s) | Server-side timer | Drop chunk, log | Auto: process next chunk |
| Audio queue overflow (>3) | Queue length check | Drop oldest, play newest | Auto: continuous |

---

## 7. Configuration Reference

### 7.1 Client Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5000` | Node.js server base URL |
| `VITE_AI_SERVICE_URL` | Yes | — | AI service base URL (Ngrok for Colab) |

### 7.2 Server Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP server port |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `AI_SERVICE_URL` | Yes | — | AI service base URL |
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `METERED_API_KEY` | Yes (Phase 0) | — | Metered TURN API key (TO BE MOVED from client) |

### 7.3 AI Service Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `WHISPER_MODEL` | No | `small` | Whisper model size (`small`, `medium`, `large-v3`) |
| `NLLB_MODEL` | No | `facebook/nllb-200-distilled-600M` | NLLB model identifier |
| `USE_SARVAM` | No | `false` | Enable Sarvam AI TTS for Indian languages |
| `SARVAM_API_KEY` | If USE_SARVAM | — | Sarvam AI API key |
| `USE_XTTS` | No | `false` | Enable XTTS-v2 voice cloning (non-functional) |
