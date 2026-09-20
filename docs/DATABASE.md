# DATABASE.md — Database Schema & Design

# SAMVADA — Database Schema & Design

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Database**: MongoDB Atlas (M0 free tier, 512MB)  
**ODM**: Mongoose 8.x  
**Cross-references**: [API.md](file:///c:/Final%20Year/Final-year/docs/API.md), [ARCHITECTURE.md](file:///c:/Final%20Year/Final-year/docs/ARCHITECTURE.md)

---

## 1. Collections Overview

| Collection | Purpose | Est. Size | Growth Rate |
|---|---|---|---|
| `users` | Authentication + language preferences | Small | Low (registration events) |
| `meetings` | Room metadata, participants, AI summary | Medium | Medium (per meeting created) |
| `transcripts` | Per-utterance dialogue log with translations | Large | High (every translated speech chunk) |

---

## 2. Schema Definitions

### 2.1 Users Collection

**Model file**: [`server/models/User.js`](file:///c:/Final%20Year/Final-year/server/models/User.js)

```javascript
{
  _id: ObjectId,                    // Auto-generated
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,                   // Unique index
    lowercase: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false                   // Excluded from queries by default
  },
  preferredLanguage: {
    type: String,
    default: 'en'                   // ISO 639-1 code
  },
  createdAt: Date,                  // Mongoose timestamps
  updatedAt: Date                   // Mongoose timestamps
}
```

**Indexes**:
| Index | Fields | Type | Purpose |
|---|---|---|---|
| `_id` | `_id` | Primary | Default |
| `email_1` | `email` | Unique | Login lookup, duplicate prevention |

**Pre-save Hook**: Hashes password via `bcrypt.genSalt(10)` + `bcrypt.hash()` when `password` field is modified.

**Instance Methods**:
- `comparePassword(candidatePassword)` → `boolean` — bcrypt comparison
- `toJSON()` → object — strips `password` and `__v` fields

---

### 2.2 Meetings Collection

**Model file**: [`server/models/Meeting.js`](file:///c:/Final%20Year/Final-year/server/models/Meeting.js)

```javascript
{
  _id: ObjectId,
  roomCode: {
    type: String,
    unique: true,
    required: true,
    index: true                     // Explicit index for frequent lookups
  },
  title: {
    type: String,
    default: 'Untitled Meeting',
    trim: true,
    maxlength: 100
  },
  hostId: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting'
  },
  participants: [
    {
      userId: {
        type: ObjectId,
        ref: 'User'
      },
      displayName: String,
      targetLanguage: {
        type: String,
        default: 'en'
      },
      socketId: String,             // Active Socket.IO connection ID
      joinedAt: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }
  ],
  endedAt: Date,                    // Set when meeting ends
  summary: {
    executiveSummary: { type: String, default: '' },
    keyTopics: [String],
    actionItems: [String],
    generatedAt: Date
  },
  createdAt: Date,                  // Mongoose timestamps
  updatedAt: Date                   // Mongoose timestamps
}
```

**Indexes**:
| Index | Fields | Type | Purpose |
|---|---|---|---|
| `_id` | `_id` | Primary | Default |
| `roomCode_1` | `roomCode` | Unique | Room lookup by code |

**Static Methods**:
- `generateRoomCode()` → `string` — generates `xxx-xxxx-xxx` format (3-4-3 lowercase alpha chars)

**Instance Methods**:
- `getActiveParticipants()` → `array` — filters `participants` where `isActive === true`

**Lifecycle States**:
```
waiting → active → ended
  │                  ▲
  └──────────────────┘ (if all participants leave without host ending)
```

> [!NOTE]
> The transition from `waiting` to `active` happens in `meetingHandlers.js` when participants join. The transition to `ended` happens only in `summaryRoutes.js` when a summary is generated. There is no explicit "end meeting" action — the meeting ends when a summary is requested.

---

### 2.3 Transcripts Collection

**Model file**: [`server/models/Transcript.js`](file:///c:/Final%20Year/Final-year/server/models/Transcript.js)

```javascript
{
  _id: ObjectId,
  meetingId: {
    type: String,
    required: true,
    index: true                     // Single field index
  },
  speakerId: {
    type: String,
    required: true
  },
  speakerName: {
    type: String,
    required: true,
    default: 'Anonymous'
  },
  sourceLanguage: {
    type: String,
    default: 'auto'
  },
  originalText: {
    type: String,
    required: true
  },
  translations: {
    type: Map,
    of: String,
    default: {}                     // { "hi": "translated text", "fr": "..." }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes**:
| Index | Fields | Type | Purpose |
|---|---|---|---|
| `_id` | `_id` | Primary | Default |
| `meetingId_1` | `meetingId` | Standard | Filter by meeting |
| `meetingId_1_timestamp_1` | `meetingId, timestamp` | Compound | Chronological retrieval per meeting |

> [!WARNING]
> **Schema Design Issue**: `meetingId` is stored as a `String`, not an `ObjectId` reference. In some places the code passes the MongoDB `_id`, in others the `roomCode`. There is no referential integrity constraint. The compound index `{ meetingId: 1, timestamp: 1 }` is correctly defined for the primary query pattern.

> [!WARNING]
> **`translations` field type**: Mongoose `Map` type serializes as an object `{ key: value }` in JSON, but in MongoDB it's stored as key-value pairs. When reading, `Object.fromEntries(entry.translations || new Map())` is used in `transcriptRoutes.js` to convert for broadcast. This works but is fragile — `.lean()` queries return plain objects, making the `fromEntries` unnecessary.

---

## 3. Data Flow Diagrams

### 3.1 Write Paths

```
User Registration:
  POST /api/auth/register → User.create() → users collection

Meeting Creation:
  POST /api/meetings → Meeting.create() → meetings collection

Participant Join:
  Socket 'join-meeting' → Meeting.findOne() + push participant + meeting.save()

Transcript Save (current — client-initiated):
  POST /api/transcripts → Transcript.create() → transcripts collection

Transcript Save (target — server-initiated):
  Translation orchestrator → Transcript.create() → transcripts collection

Meeting Summary:
  POST /api/meetings/:id/summarize → Meeting.findOneAndUpdate() → meetings.summary

Participant Disconnect:
  Socket 'disconnect' → Meeting.findOne() + set isActive=false + meeting.save()
```

### 3.2 Read Paths

```
Login:
  User.findOne({ email }).select('+password')    ← uses email_1 index

Meeting Lookup:
  Meeting.findOne({ roomCode, status: { $ne: 'ended' } })   ← uses roomCode_1 index

Transcript Retrieval:
  Transcript.find({ meetingId }).sort({ timestamp: 1 })   ← uses compound index

Summary Retrieval:
  Meeting.findOne({ roomCode }).lean()   ← uses roomCode_1 index
```

---

## 4. Data Volume Estimates

### 4.1 Per Meeting (30-minute meeting, 3 participants)

| Data | Count | Avg Size | Total |
|---|---|---|---|
| Meeting document | 1 | ~2 KB | 2 KB |
| Transcript entries | ~180 (1 per ~10s per speaker) | ~500 bytes | 90 KB |
| Summary | 1 (embedded in meeting) | ~1 KB | 1 KB |
| **Total per meeting** | | | **~93 KB** |

### 4.2 MongoDB Atlas M0 Capacity

- Storage: 512 MB
- Estimated meetings before capacity: ~5,500 meetings
- Connections: 500 concurrent (sufficient for MVP)

---

## 5. Known Issues

| # | Issue | Severity | Location | Impact |
|---|---|---|---|---|
| 1 | `meetingId` in transcripts is `String`, not `ObjectId` — no referential integrity | Low | `Transcript.js` | Orphaned transcripts possible |
| 2 | `meetingId` used inconsistently — sometimes MongoDB `_id`, sometimes `roomCode` | Medium | `transcriptRoutes.js`, `summaryRoutes.js` | Transcript broadcast fails (wrong room name) |
| 3 | Concurrent `meeting.save()` on join + disconnect can race | Medium | `meetingHandlers.js`, `socket/index.js` | Participant state corruption |
| 4 | No TTL index for ended meetings | Low | `Meeting.js` | Storage grows unbounded |
| 5 | No input length validation on `originalText` | Low | `transcriptRoutes.js` | Potential abuse |

---

## 6. Planned Schema Changes

### 6.1 Phase 0 — Transcript Room Name Fix

Standardize `meetingId` in transcripts to always use `roomCode` (the Socket.IO room name). This ensures transcript broadcasts reach participants.

### 6.2 Phase 4 — User Language Update

No schema change needed — `User.preferredLanguage` already exists. A new `PATCH /api/auth/language` endpoint will update it.

### 6.3 Post-MVP — TTL Indexes

Add TTL index on `meetings` collection for ended meetings:
```javascript
meetingSchema.index({ endedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days
```

Add TTL index on `transcripts` for old entries:
```javascript
transcriptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days
```

> [!NOTE]
> TTL indexes are deferred to post-MVP. For the thesis, all data is retained indefinitely.
