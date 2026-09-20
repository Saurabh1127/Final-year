# REALTIME.md — Real-Time Communication Protocol

# SAMVADA — Real-Time Communication Specification

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Protocols**: Socket.IO 4.7.5, WebRTC (browser native)  
**Cross-references**: [API.md](file:///c:/Final%20Year/Final-year/docs/API.md), [AUDIO_PIPELINE.md](file:///c:/Final%20Year/Final-year/docs/AUDIO_PIPELINE.md)

---

## 1. Protocol Roles

| Protocol | Role | Data Type | Latency |
|---|---|---|---|
| **WebRTC** | Peer-to-peer audio + video media | RTP/SRTP streams | <100ms |
| **Socket.IO** | Signaling, audio chunks, translation results, transcripts | JSON + binary frames | <200ms |
| **HTTP REST** | Auth, CRUD, file uploads, AI pipeline | JSON + multipart | Variable |

---

## 2. Socket.IO Events — Current Implementation

### 2.1 Connection

**Client connects**:
```javascript
const socket = io(serverUrl, {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling'],
});
```

**Server middleware** (file: [`socket/index.js`](file:///c:/Final%20Year/Final-year/server/socket/index.js)):
- Extracts `socket.handshake.auth.token`
- Verifies JWT → attaches `socket.user = decoded` (contains `userId`)
- Rejects connection on missing or invalid token

---

### 2.2 Meeting Events

Source: [`socket/meetingHandlers.js`](file:///c:/Final%20Year/Final-year/server/socket/meetingHandlers.js)

#### `join-meeting` (Client → Server)

**Payload**:
```json
{
  "roomCode": "abc-defg-hij",
  "userId": "64a1b2c3...",
  "displayName": "Alice",
  "targetLanguage": "en"
}
```

**Server behavior**:
1. `socket.join(roomCode)` — joins Socket.IO room
2. Stores `socket.roomCode`, `socket.userId`, `socket.displayName` on socket object
3. Finds Meeting by `roomCode`, updates participant (add or update):
   - Sets `isActive: true`, `socketId: socket.id`
   - If meeting status is `'waiting'`, changes to `'active'`
4. Emits `participant-joined` to room (excluding sender)
5. Emits `existing-participants` to the joining socket only

#### `participant-joined` (Server → Client, room broadcast)

**Payload**:
```json
{
  "userId": "64a1b2c3...",
  "displayName": "Alice",
  "socketId": "socket-id-123",
  "targetLanguage": "en"
}
```

#### `existing-participants` (Server → Client, direct to joiner)

**Payload**:
```json
{
  "participants": [
    {
      "userId": "64a1b2c3...",
      "displayName": "Bob",
      "socketId": "socket-id-456",
      "targetLanguage": "hi"
    }
  ]
}
```

#### `leave-meeting` (Client → Server)

**Payload**:
```json
{
  "roomCode": "abc-defg-hij"
}
```

**Server behavior**:
1. Marks participant as `isActive: false`, clears `socketId`
2. `socket.leave(roomCode)`
3. Emits `participant-left` to remaining room members

#### `participant-left` (Server → Client, room broadcast)

**Payload**:
```json
{
  "userId": "64a1b2c3...",
  "socketId": "socket-id-123"
}
```

#### `toggle-media` (Client → Server)

**Payload**:
```json
{
  "type": "audio",
  "enabled": false
}
```

**Server behavior**: Broadcasts to room as `media-toggled`.

#### `media-toggled` (Server → Client, room broadcast)

**Payload**:
```json
{
  "userId": "64a1b2c3...",
  "type": "audio",
  "enabled": false
}
```

---

### 2.3 WebRTC Signaling Events

Source: [`socket/signalingHandlers.js`](file:///c:/Final%20Year/Final-year/server/socket/signalingHandlers.js)

All signaling events are relayed peer-to-peer via Socket.IO. The server does not inspect or modify the SDP/ICE payloads.

#### `webrtc-offer` (Client → Server → Target Client)

**Payload**:
```json
{
  "targetSocketId": "socket-id-456",
  "sdp": { "type": "offer", "sdp": "v=0..." }
}
```

**Server behavior**: Forwards to `targetSocketId` with sender's `socket.id` as `fromSocketId`.

#### `webrtc-answer` (Client → Server → Target Client)

**Payload**:
```json
{
  "targetSocketId": "socket-id-123",
  "sdp": { "type": "answer", "sdp": "v=0..." }
}
```

#### `webrtc-ice-candidate` (Client → Server → Target Client)

**Payload**:
```json
{
  "targetSocketId": "socket-id-456",
  "candidate": { "candidate": "...", "sdpMLineIndex": 0, "sdpMid": "0" }
}
```

---

### 2.4 Transcript Events

#### `new-transcript` (Server → Client, room broadcast)

**Source**: [`transcriptRoutes.js`](file:///c:/Final%20Year/Final-year/server/routes/transcriptRoutes.js)

**Payload**:
```json
{
  "_id": "64a1b2c3...",
  "meetingId": "abc-defg-hij",
  "speakerId": "64a1b2c3...",
  "speakerName": "Alice",
  "sourceLanguage": "en",
  "originalText": "Hello, how are you?",
  "translations": { "hi": "नमस्ते, आप कैसे हैं?" },
  "timestamp": "2026-09-11T10:30:00.000Z"
}
```

> [!WARNING]
> **Known Bug**: This event is emitted to `io.to(meetingId)` where `meetingId` is the value from the POST body. Participants join rooms using `roomCode`. If these values differ (which they do — one is a MongoDB ObjectId, the other is a room code string), the broadcast never reaches any socket.

---

### 2.5 Disconnect Handling

**Source**: [`socket/index.js`](file:///c:/Final%20Year/Final-year/server/socket/index.js)

On socket disconnect:
1. Check if `socket.roomCode` and `socket.userId` exist
2. Find Meeting by `socket.roomCode`
3. Find participant by `userId`, set `isActive = false`, `socketId = null`
4. `await meeting.save()` — **race condition risk** with concurrent `join-meeting` save
5. Emit `participant-left` to remaining room members

---

## 3. Socket.IO Events — Planned (Translation System)

### 3.1 Audio Chunk Upload

#### `audio-chunk` (Client → Server) — TO BE IMPLEMENTED

**Payload**: Socket.IO binary event

```javascript
socket.emit('audio-chunk', audioBlob, {
  roomCode: 'abc-defg-hij',
  userId: '64a1b2c3...',
  speakerName: 'Alice',
  sequenceNumber: 42,
  timestamp: 1726056123456
});
```

**Server behavior**:
1. Translation orchestrator receives the audio blob + metadata
2. Looks up room participants and their `targetLanguage` values
3. Computes unique target languages (excluding detected source language)
4. Calls AI service `POST /api/process-audio`
5. Routes results via `translation-result` events
6. Saves transcript to MongoDB

---

### 3.2 Translation Result Delivery

#### `translation-result` (Server → Client, targeted) — TO BE IMPLEMENTED

**Payload**:
```json
{
  "speakerId": "64a1b2c3...",
  "speakerName": "Alice",
  "originalText": "Hello, how are you?",
  "sourceLanguage": "en",
  "translatedText": "नमस्ते, आप कैसे हैं?",
  "targetLanguage": "hi",
  "audioBase64": "<base64 MP3>",
  "mimeType": "audio/mp3",
  "timestamp": 1726056123456,
  "latency": {
    "asr_seconds": 0.52,
    "nmt_seconds": 0.18,
    "tts_seconds": 0.91,
    "total_seconds": 1.61
  }
}
```

**Routing logic**: Emitted only to sockets whose participant `targetLanguage` matches the translation language. If multiple participants want the same language, the same event is broadcast to all of them.

---

### 3.3 Language Update

#### `update-language` (Client → Server) — TO BE IMPLEMENTED

**Payload**:
```json
{
  "roomCode": "abc-defg-hij",
  "targetLanguage": "fr"
}
```

**Server behavior**:
1. Update participant's `targetLanguage` in Meeting document
2. Re-compute translation routing table
3. Emit `language-updated` to room (so UI can update language badges)

#### `language-updated` (Server → Client, room broadcast) — TO BE IMPLEMENTED

**Payload**:
```json
{
  "userId": "64a1b2c3...",
  "targetLanguage": "fr"
}
```

---

### 3.4 AI Service Status

#### `ai-service-status` (Server → Client, room broadcast) — TO BE IMPLEMENTED

**Payload**:
```json
{
  "available": true,
  "lastChecked": 1726056123456
}
```

Emitted periodically (every 30s) based on health check polling of the AI service `/health` endpoint.

---

## 4. WebRTC Specification

### 4.1 Connection Topology

**Current**: Full mesh (every participant connects to every other participant)  
**Scaling limit**: ~5 participants (10 peer connections)  
**Target (V2)**: SFU (mediasoup or LiveKit) for >5 participants

### 4.2 ICE Configuration

```javascript
{
  iceServers: [
    { urls: 'stun:stun.metered.ca:3478' },
    { urls: 'stun:stun.metered.ca:3478' },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: '<dynamic>',
      credential: '<dynamic>'
    },
    {
      urls: 'turn:global.relay.metered.ca:443?transport=tcp',
      username: '<dynamic>',
      credential: '<dynamic>'
    }
  ]
}
```

### 4.3 Media Tracks

| Track | Codec | Direction |
|---|---|---|
| Audio | Opus (browser default) | Send + Receive |
| Video | VP8/VP9/H.264 (browser negotiated) | Send + Receive |

### 4.4 Connection State Machine

```
new → checking → connected → disconnected → failed
                     ↑                          │
                     └── ICE restart ←──────────┘
```

ICE restart is attempted on `failed` state. If restart fails, the peer connection is closed and the participant tile shows a "disconnected" state.

---

## 5. Socket.IO Configuration

### 5.1 Server Configuration

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: true,         // MUST BE RESTRICTED in production
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // TO BE ADDED:
  // maxHttpBufferSize: 1e6,   // 1MB for audio blob transport
  // pingTimeout: 30000,       // 30s ping timeout
  // pingInterval: 25000,      // 25s ping interval
});
```

### 5.2 Client Configuration

```javascript
const socket = io(serverUrl, {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling'],
  reconnection: true,           // Auto-reconnect (default)
  reconnectionAttempts: 10,     // Max retry attempts
  reconnectionDelay: 1000,      // Initial delay 1s
  reconnectionDelayMax: 5000,   // Max delay 5s
});
```

---

## 6. Event Flow Diagrams

### 6.1 Meeting Join Flow

```
Client A                Server              Client B (existing)
   │                       │                       │
   │── join-meeting ──────>│                       │
   │                       │── participant-joined →│
   │<── existing-          │                       │
   │    participants ──────│                       │
   │                       │                       │
   │── webrtc-offer ──────>│── webrtc-offer ──────>│
   │                       │<── webrtc-answer ─────│
   │<── webrtc-answer ─────│                       │
   │── webrtc-ice ────────>│── webrtc-ice ────────>│
   │<── webrtc-ice ────────│<── webrtc-ice ────────│
   │                       │                       │
   │  ←─── P2P media (WebRTC) ──────────────────→ │
```

### 6.2 Translation Flow (Target Architecture)

```
Speaker A              Server              Listener B (wants Hindi)
   │                       │                       │
   │── audio-chunk ──────>│                       │
   │   (WebM blob)         │                       │
   │                       │── POST /api/process-audio ──> AI Service
   │                       │<── { translations, audio_translations } ──
   │                       │                       │
   │                       │── translation-result →│
   │                       │   { hi: text+audio }  │
   │                       │                       │
   │                       │── new-transcript ────>│ (to room)
   │                       │   { text only }       │
```
