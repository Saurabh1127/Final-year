# API.md — API Reference

# LinguaMeet — API Reference

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [ARCHITECTURE.md](file:///c:/Final%20Year/Final-year/docs/ARCHITECTURE.md), [REALTIME.md](file:///c:/Final%20Year/Final-year/docs/REALTIME.md)

---

## 1. Node.js Server REST API

**Base URL**: `http://localhost:5000/api`  
**Auth**: All endpoints except register/login require `Authorization: Bearer <JWT>` header.

---

### 1.1 Health Check

#### `GET /api/health`

**Auth**: None

**Response** `200`:
```json
{
  "status": "ok",
  "service": "linguameet-server",
  "timestamp": "2026-09-11T10:30:00.000Z"
}
```

---

### 1.2 Authentication

#### `POST /api/auth/register`

**Auth**: None

**Request Body**:
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "secure123"
}
```

**Validation**:
- `name`: required, 2-50 chars
- `email`: required, valid format, unique (case-insensitive)
- `password`: required, ≥6 chars

**Response** `201`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "name": "Alice",
    "email": "alice@example.com",
    "preferredLanguage": "en"
  }
}
```

**Errors**:
| Code | Message |
|---|---|
| `400` | `Name, email, and password are required.` |
| `400` | `Password must be at least 6 characters.` |
| `409` | `An account with this email already exists.` |
| `500` | `Server error during registration.` |

---

#### `POST /api/auth/login`

**Auth**: None

**Request Body**:
```json
{
  "email": "alice@example.com",
  "password": "secure123"
}
```

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "name": "Alice",
    "email": "alice@example.com",
    "preferredLanguage": "en"
  }
}
```

**Errors**:
| Code | Message |
|---|---|
| `400` | `Email and password are required.` |
| `401` | `Invalid email or password.` |
| `500` | `Server error during login.` |

---

#### `GET /api/auth/me`

**Auth**: Required

**Response** `200`:
```json
{
  "user": {
    "id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "name": "Alice",
    "email": "alice@example.com",
    "preferredLanguage": "en"
  }
}
```

---

### 1.3 Meetings

#### `POST /api/meetings`

**Auth**: Required

**Request Body**:
```json
{
  "title": "Team Standup"
}
```
- `title` is optional; defaults to `"<user.name>'s Meeting"`

**Response** `201`:
```json
{
  "meetingId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "roomCode": "abc-defg-hij",
  "title": "Team Standup"
}
```

**Notes**:
- Room code format: `xxx-xxxx-xxx` (3-4-3 lowercase letters)
- Up to 10 retry attempts for unique code generation
- Creator is added as first participant with `isActive: false` (becomes active on Socket.IO join)

---

#### `GET /api/meetings/:roomCode`

**Auth**: Required

**Response** `200`:
```json
{
  "meetingId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "roomCode": "abc-defg-hij",
  "title": "Team Standup",
  "hostId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "status": "active",
  "participants": [
    {
      "userId": "64a1b2c3d4e5f6a7b8c9d0e1",
      "displayName": "Alice",
      "targetLanguage": "en",
      "isActive": true
    }
  ],
  "participantCount": 1
}
```

**Notes**:
- Filters out meetings with `status: "ended"`
- Returns only active participants via `getActiveParticipants()` method

**Errors**:
| Code | Message |
|---|---|
| `404` | `Meeting not found or has ended.` |

---

#### `PATCH /api/meetings/:roomCode/language`

**Auth**: Required

**Request Body**:
```json
{
  "targetLanguage": "hi"
}
```

**Response** `200`:
```json
{
  "message": "Language updated.",
  "targetLanguage": "hi"
}
```

**Errors**:
| Code | Message |
|---|---|
| `400` | `targetLanguage is required.` |
| `403` | `You are not in this meeting.` |
| `404` | `Meeting not found.` |

---

### 1.4 Transcripts

#### `POST /api/transcripts`

**Auth**: Required

**Request Body**:
```json
{
  "meetingId": "abc-defg-hij",
  "speakerId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "speakerName": "Alice",
  "sourceLanguage": "en",
  "originalText": "Hello, how are you?",
  "translations": {
    "hi": "नमस्ते, आप कैसे हैं?",
    "fr": "Bonjour, comment allez-vous ?"
  }
}
```

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e2",
    "meetingId": "abc-defg-hij",
    "speakerId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "speakerName": "Alice",
    "sourceLanguage": "en",
    "originalText": "Hello, how are you?",
    "translations": { "hi": "...", "fr": "..." },
    "timestamp": "2026-09-11T10:30:00.000Z"
  }
}
```

**Side Effect**: Broadcasts `new-transcript` Socket.IO event to the room identified by `meetingId`.

> [!WARNING]
> **Known Bug**: The broadcast emits to `io.to(meetingId)` but participants join a room named by `roomCode`. These are different values, so the broadcast never reaches any socket. This must be fixed — either the broadcast should use `roomCode` or the parameter should be changed.

---

#### `GET /api/transcripts/:meetingId`

**Auth**: Required

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "meetingId": "abc-defg-hij",
      "speakerId": "...",
      "speakerName": "Alice",
      "sourceLanguage": "en",
      "originalText": "Hello, how are you?",
      "translations": { "hi": "..." },
      "timestamp": "2026-09-11T10:30:00.000Z"
    }
  ]
}
```

---

### 1.5 Meeting Summary

#### `POST /api/meetings/:meetingId/summarize`

**Auth**: Required

**Notes**: Despite the parameter name `:meetingId`, the code looks up the meeting by `roomCode`. The client must pass the `roomCode` value as this parameter.

**Request Body**: None (uses stored transcripts)

**Process**:
1. Fetches all transcripts for the meeting
2. Formats into speaker dialogue log
3. Calls Gemini 1.5 Flash API with structured prompt
4. Parses JSON response
5. Saves summary to Meeting document
6. Sets meeting status to `"ended"`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "executiveSummary": "The team discussed...",
    "keyTopics": ["Project timeline", "Budget review", "Next steps"],
    "actionItems": ["Alice to prepare report by Friday", "Bob to schedule follow-up"]
  }
}
```

**Errors**:
| Code | Message |
|---|---|
| `404` | `No transcript entries found for this meeting.` |
| `500` | `Failed to generate meeting summary.` |

---

#### `GET /api/meetings/:meetingId/summary`

**Auth**: Required

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "executiveSummary": "...",
    "keyTopics": ["..."],
    "actionItems": ["..."],
    "generatedAt": "2026-09-11T10:45:00.000Z"
  }
}
```

---

### 1.6 TURN Credentials (TO BE ADDED — Phase 0)

#### `GET /api/turn-credentials`

**Auth**: Required

**Response** `200`:
```json
{
  "iceServers": [
    {
      "urls": "stun:stun.metered.ca:3478"
    },
    {
      "urls": "turn:relay.metered.ca:443",
      "username": "...",
      "credential": "..."
    }
  ]
}
```

**Notes**: Proxies to `https://linguameet.metered.live/api/v1/turn/credentials?apiKey=<METERED_API_KEY>`. This keeps the Metered API key server-side.

---

## 2. AI Service REST API

**Base URL**: `http://localhost:8000` (or Ngrok URL)  
**Auth**: None (internal service)

---

### 2.1 Health Check

#### `GET /health`

**Response** `200`:
```json
{
  "status": "ok",
  "service": "linguameet-ai-service",
  "whisper_model": "small",
  "nllb_model": "facebook/nllb-200-distilled-600M",
  "tts_engine": "edge_tts",
  "device": "cuda",
  "voice_retention_active": false,
  "timestamp": 1726056123.456
}
```

---

### 2.2 Supported Languages

#### `GET /api/languages`

**Response** `200`:
```json
{
  "languages": {
    "en": "English",
    "hi": "Hindi",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "pt": "Portuguese",
    "ru": "Russian",
    "it": "Italian"
  }
}
```

---

### 2.3 Process Audio (Primary Pipeline)

#### `POST /api/process-audio`

**Content-Type**: `multipart/form-data`

**Form Fields**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `audio` | File | Yes | — | Audio file (WAV, WebM, MP3, OGG, M4A) |
| `meeting_id` | String | Yes | — | Meeting identifier |
| `user_id` | String | Yes | — | Speaker identifier |
| `speaker_name` | String | No | `"Anonymous"` | Speaker display name |
| `source_language` | String | No | `null` (auto-detect) | ISO 639-1 code or `"auto"` |
| `target_languages` | String (JSON array) | No | `'["en"]'` | JSON array of target lang codes |
| `include_audio` | String | No | `"true"` | `"true"` to include TTS audio |

**Response** `200`:
```json
{
  "original_text": "Hello, how are you?",
  "source_language": "en",
  "translations": {
    "hi": "नमस्ते, आप कैसे हैं?"
  },
  "audio_translations": {
    "hi": {
      "audio_base64": "<base64>",
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

**Error Response** (pipeline failure):
```json
{
  "error": "Error description",
  "original_text": "[Pipeline Error]",
  "source_language": "unknown",
  "translations": {},
  "audio_translations": {},
  "speaker_id": "user123",
  "meeting_id": "abc-defg-hij",
  "timestamp": 1726056123.456,
  "latency": { "asr_seconds": 0, "nmt_seconds": 0, "tts_seconds": 0, "total_seconds": 0 }
}
```

---

### 2.4 WebSocket Process Audio (Exists, Currently Unused)

#### `WS /ws/process-audio`

**Client sends** (JSON text frame):
```json
{
  "audio_base64": "<base64 encoded audio>",
  "meeting_id": "abc-defg-hij",
  "user_id": "user123",
  "source_language": "auto",
  "target_languages": ["hi", "fr"],
  "include_audio": true
}
```

**Server responds** (JSON text frame): Same format as REST `POST /api/process-audio` response.

> [!NOTE]
> This endpoint exists in the codebase but is **never called by the client**. All audio processing currently uses the HTTP POST endpoint. The WebSocket endpoint may be useful for lower-latency streaming in a future optimization phase.

---

### 2.5 Demo Dashboard

#### `GET /demo`

**Response**: `text/html` — standalone interactive test page for the S2ST pipeline.

---

## 3. Planned API Additions (Not Yet Implemented)

### 3.1 Server: Language List Proxy

#### `GET /api/languages`

Proxies `GET /api/languages` from the AI service and caches the result. Required because the target architecture routes all AI service communication through the Node.js server.

### 3.2 Server: AI Service Health Proxy

#### `GET /api/ai-health`

Proxies `GET /health` from the AI service. Exposes AI service availability to clients without exposing the AI service URL.

### 3.3 Server: Update User Language

#### `PATCH /api/auth/language`

Updates the authenticated user's `preferredLanguage` field. Used when a user changes their language in the meeting room and wants it persisted to their profile.
