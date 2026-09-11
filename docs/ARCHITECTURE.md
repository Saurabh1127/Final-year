# ARCHITECTURE.md — System Architecture

# LinguaMeet — System Architecture Document

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [PRD.md](file:///c:/Final%20Year/Final-year/docs/PRD.md), [TECHNICAL_SPEC.md](file:///c:/Final%20Year/Final-year/docs/TECHNICAL_SPEC.md), [AI_PIPELINE.md](file:///c:/Final%20Year/Final-year/docs/AI_PIPELINE.md)

---

## 1. Architecture Overview

LinguaMeet is a three-tier distributed system using a cascaded AI pipeline for speech-to-speech translation:

```
┌───────────────────────────────────────┐
│         Tier 1: Client                │
│    React 19 SPA (Vite 8, browser)     │
│   • WebRTC peer connections           │
│   • Socket.IO for signaling + data    │
│   • VAD + audio chunking              │
│   • Translation playback + subtitles  │
└──────────────┬────────────────────────┘
               │ Socket.IO (WSS)
               │ WebRTC (DTLS/SRTP)
┌──────────────▼────────────────────────┐
│         Tier 2: Application Server    │
│    Node.js 20+ / Express 4 (:5000)    │
│   • REST API (auth, meetings, etc.)   │
│   • Socket.IO server (signaling)      │
│   • Translation orchestrator (NEW)    │
│   • MongoDB via Mongoose              │
└──────────────┬────────────────────────┘
               │ HTTP (REST)
┌──────────────▼────────────────────────┐
│         Tier 3: AI Service            │
│    Python / FastAPI (:8000)           │
│   • Whisper (STT)                     │
│   • NLLB-200 (NMT)                   │
│   • Edge TTS / gTTS (TTS)            │
│   • Runs on Colab GPU or dedicated    │
└───────────────────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│         Data Store                    │
│    MongoDB Atlas (cloud)              │
│   • Users, Meetings, Transcripts      │
└───────────────────────────────────────┘
```

---

## 2. Current Architecture (As-Built)

### 2.1 Data Flow — Current (Broken Translation)

```
Speaker A's Browser:
  Mic → [useAudioCapture] → WebRTC track → Peer B hears ORIGINAL audio
  Mic → [useSpeechTranslation] → SEPARATE getUserMedia → MediaRecorder
       → VAD (Web Audio RMS) → flush as WebM blob
       → HTTP POST to Colab AI Service (Ngrok tunnel)
       → Receives translated text + TTS audio (base64)
       → Plays TTS audio LOCALLY on Speaker A's browser   ← BUG: only A hears it
       → Saves transcript via POST /api/transcripts
       → Transcript broadcast via Socket.IO to room       ← BUG: wrong room name
```

**Critical flaws:**
1. Translated audio never reaches other participants
2. Dual mic capture (two independent `getUserMedia` calls)
3. Transcript broadcast uses `meetingId` (MongoDB ObjectId) as room name, but participants join room named by `roomCode`

### 2.2 Data Flow — Target (Distributed Translation)

```
Speaker A's Browser:
  Mic → [useAudioCapture] → single stream
       ├── WebRTC track → Peer B hears ORIGINAL audio
       └── [useSpeechTranslation] → MediaStream.clone()
           → MediaRecorder → VAD → flush as WebM blob
           → Socket.IO emit('audio-chunk') to Node.js server

Node.js Server (Translation Orchestrator):
  Receives 'audio-chunk' from Speaker A
  → Looks up room participants and their targetLanguage values
  → Computes unique target languages (excluding A's detected language)
  → HTTP POST to AI Service with audio + all target languages
  → Receives { translations, audio_translations } for all target langs
  → For each target language:
      → Emits 'translation-result' to participants wanting that language
  → Saves transcript to MongoDB
  → Broadcasts 'new-transcript' to room (via roomCode)

Listener B's Browser:
  [useTranslationReceiver] listens for 'translation-result'
  → Queues translated audio (max 3, drop oldest)
  → Ducks remote audio to 20%
  → Plays TTS via Audio element
  → Shows subtitle overlay (4s auto-fade)
```

---

## 3. Component Architecture

### 3.1 Client Components

```
App.jsx
├── AuthContext (JWT state + localStorage)
├── SocketContext (Socket.IO connection)
├── ProtectedRoute (auth guard)
│
├── LoginPage / RegisterPage
├── HomePage (create/join meeting)
│
├── MeetingRoom.jsx (main meeting page)
│   ├── useAudioCapture      — single mic+camera stream
│   ├── useWebRTC             — mesh peer connections
│   ├── useAudioVolume        — active speaker detection
│   ├── useSpeechTranslation  — VAD, chunking, emit to server (TO BE REFACTORED)
│   ├── useTranslationReceiver — receive + play translated audio (TO BE CREATED)
│   ├── LanguageSelector      — target language dropdown (TO BE CREATED)
│   ├── ControlBar            — mic/cam/leave/translate toggles
│   ├── ParticipantTile       — video tile per participant
│   ├── SubtitleOverlay       — floating translated text
│   └── TranscriptSidebar     — scrollable conversation log
│
└── MeetingSummary.jsx (post-meeting AI summary)
```

### 3.2 Server Components

```
server.js (Express + HTTP server)
├── Middleware
│   ├── cors
│   ├── express.json (10mb limit)
│   ├── helmet (TO BE ADDED)
│   └── express-rate-limit (TO BE ADDED)
│
├── Routes
│   ├── /api/auth           — register, login, me
│   ├── /api/meetings       — CRUD + language update
│   ├── /api/transcripts    — save + fetch transcripts
│   ├── /api/meetings/:id/summarize — Gemini Flash summary
│   ├── /api/meetings/:id/summary   — fetch cached summary
│   ├── /api/turn-credentials       — proxy Metered TURN (TO BE ADDED)
│   └── /api/health         — server health check
│
├── Socket.IO
│   ├── Auth middleware (JWT verification)
│   ├── meetingHandlers     — join/leave room, media toggles
│   ├── signalingHandlers   — WebRTC offer/answer/ICE
│   └── translationOrchestrator (TO BE CREATED)
│       ├── Receives 'audio-chunk' events
│       ├── Calls AI service
│       ├── Routes 'translation-result' events
│       └── Saves transcripts
│
├── Models (Mongoose)
│   ├── User       — name, email, password, preferredLanguage
│   ├── Meeting    — roomCode, title, hostId, status, participants[], summary
│   └── Transcript — meetingId, speakerId, speakerName, sourceLanguage, originalText, translations
│
└── Config
    └── db.js — MongoDB connection via MONGO_URI env var
```

### 3.3 AI Service Components

```
FastAPI app (main.py)
├── Lifespan manager (model preloading)
├── CORS middleware (allow_origins=["*"])
│
├── Endpoints
│   ├── GET  /health              — service health + model info
│   ├── GET  /api/languages       — supported language list
│   ├── POST /api/process-audio   — full S2ST pipeline (primary)
│   ├── WS   /ws/process-audio    — WebSocket S2ST (exists, unused by client)
│   └── GET  /demo                — interactive test dashboard (HTML)
│
├── Pipeline (pipeline.py)
│   └── SpeechToSpeechEngine.process()
│       ├── Step 1: transcribe_audio() — Whisper STT
│       ├── Step 2: translate_to_multiple() — NLLB NMT
│       └── Step 3: synthesize_speech() — Edge TTS / gTTS
│
├── Modules
│   ├── stt.py              — Whisper model loading + transcription
│   ├── translator.py       — NLLB model loading + batch translation
│   ├── tts.py              — Edge TTS + gTTS + Sarvam AI synthesis
│   ├── voice_retention.py  — XTTS-v2 skeleton (non-functional)
│   ├── language_detect.py  — language code utilities
│   └── schemas.py          — Pydantic response models
│
└── Config
    └── .env — WHISPER_MODEL, NLLB_MODEL, USE_SARVAM, USE_XTTS, SARVAM_API_KEY
```

---

## 4. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Client** | React | 19.x | UI framework |
| | Vite | 8.x | Build tool + dev server |
| | react-router-dom | 7.x | Client-side routing |
| | socket.io-client | 4.7.x | Real-time communication |
| | Web Audio API | Browser native | VAD, volume analysis |
| | MediaRecorder API | Browser native | Audio chunk recording |
| | WebRTC | Browser native | Peer-to-peer media |
| **Server** | Node.js | 20+ | Runtime |
| | Express | 4.x | HTTP framework |
| | Socket.IO | 4.7.5 | WebSocket server |
| | Mongoose | 8.x | MongoDB ODM |
| | jsonwebtoken | 9.x | JWT auth |
| | bcryptjs | 2.x | Password hashing |
| | axios | 1.x | HTTP client (Gemini API) |
| **AI Service** | Python | 3.10+ | Runtime |
| | FastAPI | 0.100+ | HTTP/WS framework |
| | openai-whisper | latest | Speech-to-text |
| | transformers | 4.x | NLLB translation model |
| | edge-tts | latest | Text-to-speech (primary) |
| | gTTS | latest | Text-to-speech (fallback) |
| | torch | 2.x | GPU compute |
| | pyngrok | latest | Colab tunnel |
| **Database** | MongoDB Atlas | 7.x | Document store |
| **Infrastructure** | Metered TURN | SaaS | NAT traversal for WebRTC |
| | Google Colab | - | GPU compute (dev/demo) |
| | Ngrok | - | Tunnel to Colab |

---

## 5. Communication Protocols

### 5.1 Client ↔ Server

| Protocol | Transport | Purpose | Auth |
|---|---|---|---|
| REST API | HTTP/HTTPS | Auth, meetings, transcripts, summary | JWT Bearer token |
| Socket.IO | WebSocket (WS/WSS) | Signaling, audio chunks, translation results, transcript broadcast | JWT in `handshake.auth.token` |
| WebRTC | DTLS/SRTP (P2P) | Audio + video media streams | TURN credentials |

### 5.2 Server ↔ AI Service

| Protocol | Transport | Purpose | Auth |
|---|---|---|---|
| REST API | HTTP POST multipart | Audio processing pipeline | None (internal network / Ngrok) |

### 5.3 Server ↔ External APIs

| Protocol | Transport | Purpose | Auth |
|---|---|---|---|
| REST API | HTTPS | Gemini 1.5 Flash summarization | API key in query param |
| REST API | HTTPS | Metered TURN credential fetch | API key in URL |

---

## 6. Deployment Architecture

### 6.1 Development (Current)

```
Developer Machine:
  ├── npm run dev (client :5173)
  ├── npm run dev (server :5000)
  └── MongoDB Atlas (cloud)

Google Colab (separate):
  ├── AI service (uvicorn :8000)
  └── Ngrok tunnel → public URL

Client .env: VITE_AI_SERVICE_URL = <ngrok-url>
Server .env: AI_SERVICE_URL = <ngrok-url>
```

### 6.2 Production (Target)

```
Cloud Platform (e.g., Railway, Render):
  ├── Client (static build, CDN)
  ├── Server (:5000, PM2 managed)
  └── MongoDB Atlas (dedicated tier)

GPU Provider (e.g., RunPod):
  └── AI Service (:8000, persistent pod)
      ├── Whisper model (GPU)
      ├── NLLB model (GPU)
      └── Edge TTS (network calls)
```

---

## 7. Scalability Tiers

| Tier | Meetings | Participants | Infrastructure |
|---|---|---|---|
| **MVP** | 1-2 | ≤5 per room | Single Node.js, Colab GPU, MongoDB Atlas M0 |
| **Small Prod** | 10-50 | ≤5 per room | 2-4 Node.js + Redis, 1-2 GPU servers, Atlas M10 |
| **Medium Prod** | 100+ | ≤25 per room (SFU) | K8s cluster, GPU autoscale, SFU (mediasoup), Atlas M30+ |

### 7.1 Scaling Constraints

- **WebRTC mesh**: Hard limit at ~5 participants (N×(N-1)/2 connections)
- **GPU inference**: Single model instance handles 1 request at a time
- **Socket.IO**: Single process handles ~10K concurrent connections
- **Edge TTS**: External API, rate limits unknown (no documented SLA)

---

## 8. Key Architectural Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|---|---|---|
| AD-1 | **Cascaded STT→NMT→TTS** pipeline | Best quality-to-cost ratio; each stage uses best-in-class open-source model; all components are free | Direct S2ST (SeamlessM4T) — rejected: worse voice quality, higher GPU requirements, less language support |
| AD-2 | **Server-side translation orchestration** | Enables deduplication (translate once per unique language), centralized routing, and keeps API keys server-side | Client-side orchestration (current) — rejected: exposes AI service URL, no deduplication, no routing control |
| AD-3 | **WebRTC mesh for media** | Lowest latency for ≤5 participants; already implemented; no server-side media processing needed | SFU — deferred to V2 for >5 participants |
| AD-4 | **Socket.IO for translation data** | Reliable delivery, room-based broadcasting, binary frame support, auth middleware; connection already established for signaling | WebRTC data channels — rejected: translation data arrives seconds later (not real-time), no room broadcast |
| AD-5 | **Listener-centric translation model** | Each listener controls their own language; speaker doesn't hear their own translation; natural UX | Speaker-centric — rejected: speaker shouldn't hear themselves translated |
| AD-6 | **Edge TTS as primary TTS** | Free, studio-grade neural voices, streaming support, no API key required | gTTS — kept as fallback (lower quality); Sarvam AI — optional for Indian languages |
| AD-7 | **MongoDB** for persistence | Already implemented, works well for meetings/transcripts/users; flexible schema | PostgreSQL — considered for V2 scale; Redis — not needed for MVP |

> [!NOTE]
> Decision AD-1 through AD-5 are **ASSUMPTIONS** based on the implementation plan recommendations. They are not confirmed product decisions. See [PRD.md §4](file:///c:/Final%20Year/Final-year/docs/PRD.md) for the full list of open decisions.
