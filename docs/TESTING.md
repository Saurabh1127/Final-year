# TESTING.md — Test Strategy & Plan

# SAMVADA — Test Strategy & Plan

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Current test coverage**: **Zero** — no tests exist in the repository  
**Cross-references**: [TECHNICAL_SPEC.md](file:///c:/Final%20Year/Final-year/docs/TECHNICAL_SPEC.md), [API.md](file:///c:/Final%20Year/Final-year/docs/API.md)

---

## 1. Current State

The repository contains **zero automated tests** across all three services (client, server, ai-service). There are no test files, no test configuration, no test dependencies in `package.json`, and no CI pipeline.

**Manual testing** is the only validation method currently available:
- AI service has an interactive test dashboard at `GET /demo` that allows uploading audio and viewing pipeline results
- The `colab_test.py` script can test the AI service endpoint

---

## 2. Test Strategy

### 2.1 Test Pyramid

```
        ┌───────────┐
        │   E2E     │  1-2 critical path tests (manual or Playwright)
        │  Tests    │
        ├───────────┤
        │Integration│  5-10 tests (server + MongoDB, server + Socket.IO)
        │  Tests    │
        ├───────────┤
        │   Unit    │  20-30 tests (auth, orchestrator, models, hooks)
        │  Tests    │
        └───────────┘
```

### 2.2 Priority Order

1. **Server unit tests** — auth, meeting CRUD, orchestrator logic (Phase 10)
2. **Server integration tests** — full API flows with real MongoDB (Phase 10)
3. **AI service integration test** — pipeline latency benchmarking (Phase 10)
4. **E2E test** — full meeting translation flow (Phase 10)
5. **Client unit tests** — context providers, hooks (Post-MVP)

---

## 3. Test Framework Selection

| Service | Framework | Runner | Rationale |
|---|---|---|---|
| Server (Node.js) | Jest or Vitest | — | Standard for Node.js; Vitest is Vite-aligned |
| Client (React) | Vitest + React Testing Library | — | Vite-native, fast, good React support |
| AI Service (Python) | pytest | — | Standard for Python |
| E2E | Playwright or Manual | — | Cross-browser, headless |

---

## 4. Server Test Plan

### 4.1 Unit Tests

#### Auth Routes (`routes/auth.js`)

| Test ID | Description | Input | Expected |
|---|---|---|---|
| AUTH-U-01 | Register with valid data | `{ name, email, password }` | 201, returns token + user |
| AUTH-U-02 | Register with missing name | `{ email, password }` | 400, "Name, email, and password are required." |
| AUTH-U-03 | Register with short password | `{ ..., password: "12345" }` | 400, "Password must be at least 6 characters." |
| AUTH-U-04 | Register with duplicate email | Same email twice | 409, "An account with this email already exists." |
| AUTH-U-05 | Login with valid credentials | `{ email, password }` | 200, returns token + user |
| AUTH-U-06 | Login with wrong password | `{ email, wrong_password }` | 401, "Invalid email or password." |
| AUTH-U-07 | Login with non-existent email | `{ unknown_email, password }` | 401, "Invalid email or password." |
| AUTH-U-08 | Get /me with valid token | `Authorization: Bearer <valid>` | 200, returns user |
| AUTH-U-09 | Get /me without token | No auth header | 401 |
| AUTH-U-10 | Get /me with expired token | Expired JWT | 401 |

#### Meeting Routes (`routes/meetings.js`)

| Test ID | Description | Expected |
|---|---|---|
| MTG-U-01 | Create meeting with title | 201, roomCode in `xxx-xxxx-xxx` format |
| MTG-U-02 | Create meeting without title | 201, default title = `"<name>'s Meeting"` |
| MTG-U-03 | Get meeting by valid roomCode | 200, returns meeting details |
| MTG-U-04 | Get meeting by invalid roomCode | 404 |
| MTG-U-05 | Get ended meeting | 404 (filtered by status) |
| MTG-U-06 | Update language for participant | 200, "Language updated." |
| MTG-U-07 | Update language for non-participant | 403, "You are not in this meeting." |

#### Transcript Routes (`routes/transcriptRoutes.js`)

| Test ID | Description | Expected |
|---|---|---|
| TR-U-01 | Save transcript with valid data | 201, transcript created |
| TR-U-02 | Save transcript without meetingId | 400 |
| TR-U-03 | Get transcripts for meeting | 200, sorted by timestamp |
| TR-U-04 | Get transcripts for non-existent meeting | 200, empty array |

#### Translation Orchestrator (TO BE BUILT — `translation/orchestrator.js`)

| Test ID | Description | Mock | Expected |
|---|---|---|---|
| ORCH-U-01 | Route translation to correct listeners | Mock AI service | translation-result emitted to correct sockets |
| ORCH-U-02 | Deduplicate: 2 listeners with same language | Mock AI service | AI service called once, result sent to both |
| ORCH-U-03 | Skip speaker's own language | Mock room state | No translation for speaker's detected language |
| ORCH-U-04 | Handle AI service timeout | Mock timeout | Error logged, no crash, meeting continues |
| ORCH-U-05 | Handle empty transcription | Mock empty result | No translation or transcript saved |

### 4.2 Integration Tests

| Test ID | Description | Requires | Expected |
|---|---|---|---|
| INT-01 | Full auth flow: register → login → /me | MongoDB | Token works across all endpoints |
| INT-02 | Meeting lifecycle: create → join (socket) → leave | MongoDB + Socket.IO | Participant state correct at each step |
| INT-03 | Transcript save + broadcast | MongoDB + Socket.IO | Transcript persisted and broadcast received |
| INT-04 | Summary generation | MongoDB + Gemini API (mock) | Summary saved to meeting document |
| INT-05 | Socket.IO auth middleware | — | Invalid token rejected, valid token accepted |

---

## 5. AI Service Test Plan

### 5.1 Pipeline Tests (pytest)

| Test ID | Description | Input | Expected |
|---|---|---|---|
| AI-U-01 | STT produces text from English audio | English WAV file | Non-empty text, language = "en" |
| AI-U-02 | STT returns empty for silence | Silent audio | Empty text |
| AI-U-03 | NMT translates English to Hindi | "Hello" + en → hi | Non-empty Hindi text |
| AI-U-04 | NMT handles unsupported target lang | Invalid lang code | Error message or skip |
| AI-U-05 | TTS produces audio for Hindi text | Hindi text | Non-empty base64, mime_type = "audio/mp3" |
| AI-U-06 | Full pipeline: audio → text + translations + audio | English WAV + targets [hi] | Complete response with all fields |
| AI-U-07 | Pipeline with empty audio | 0-byte file | Empty response, no crash |
| AI-U-08 | Health endpoint returns status | GET /health | 200, status = "ok" |
| AI-U-09 | Languages endpoint returns supported list | GET /api/languages | Dict with ≥12 entries |

### 5.2 Latency Benchmark

```
Script: ai-service/tests/benchmark.py (TO BE CREATED)

1. Load 10 test audio samples (1s, 2s, 3s durations)
2. For each sample:
   a. Call POST /api/process-audio with target_languages=["hi"]
   b. Record { asr_seconds, nmt_seconds, tts_seconds, total_seconds }
3. Compute:
   - P50, P90, P99 for each stage
   - P50, P90, P99 for total pipeline
4. Print results table
5. Assert P80 total ≤ 4s (target) or ≤ 6s (acceptable)
```

---

## 6. Client Test Plan

### 6.1 Context Tests

| Test ID | Description | Expected |
|---|---|---|
| CTX-U-01 | AuthContext: login sets user + token | State updated, localStorage set |
| CTX-U-02 | AuthContext: logout clears state | State cleared, localStorage cleared |
| CTX-U-03 | AuthContext: /me on mount restores session | User loaded from stored token |
| CTX-U-04 | SocketContext: connects when authenticated | Socket instance created |
| CTX-U-05 | SocketContext: disconnects on logout | Socket disconnected |

### 6.2 Hook Tests (with mocked dependencies)

| Test ID | Description | Expected |
|---|---|---|
| HOOK-U-01 | useAudioCapture: acquires stream | Stream with audio + video tracks |
| HOOK-U-02 | useAudioCapture: toggleMute stops audio track | Track.enabled = false |
| HOOK-U-03 | useSpeechTranslation: starts/stops recording | MediaRecorder created/stopped |

> [!NOTE]
> Client hook tests require mocking `navigator.mediaDevices`, `MediaRecorder`, `AudioContext`, and `RTCPeerConnection`. This is complex and is deferred to post-MVP. The server and AI service tests provide higher ROI.

---

## 7. End-to-End Test Plan

### 7.1 Critical Path (Manual or Playwright)

```
E2E-01: Full Translation Flow

Preconditions:
  - Server running on localhost:5000
  - AI service running (Colab or local)
  - Two browser windows (or Playwright contexts)

Steps:
  1. Browser A: Register user "Alice" (alice@test.com)
  2. Browser A: Login as Alice
  3. Browser A: Create meeting → get roomCode
  4. Browser B: Register user "Bob" (bob@test.com)
  5. Browser B: Login as Bob
  6. Browser B: Join meeting using roomCode
  7. Both: Verify video tiles appear (Alice and Bob see each other)
  8. Both: Verify original audio flows (Bob hears Alice's mic via WebRTC)
  9. Alice: Set target language to Hindi
  10. Bob: Set target language to English
  11. Alice: Enable translation
  12. Bob: Enable translation
  13. Alice: Speak in English for 3 seconds
  14. Bob: Verify translated Hindi audio plays within 6 seconds
  15. Bob: Verify subtitle appears with Hindi text
  16. Bob: Speak in Hindi for 3 seconds
  17. Alice: Verify translated English audio plays within 6 seconds
  18. Alice: Leave meeting → verify summary page loads
  19. Bob: Leave meeting

Expected:
  - Bidirectional translation works
  - No audio overlap or queue explosion
  - Summary is generated
  - No console errors
```

### 7.2 Edge Case Tests (Manual)

| Test ID | Scenario | Expected |
|---|---|---|
| E2E-02 | Join meeting when AI service is down | Meeting works for video/audio, translation shows "unavailable" |
| E2E-03 | Disconnect and reconnect mid-meeting | Rejoin room, re-establish peers, resume translation |
| E2E-04 | Speak while muted | No audio chunks sent, no translation |
| E2E-05 | Change language mid-meeting | Next translation arrives in new language |
| E2E-06 | 3 participants, 3 languages | Each hears the other two translated |

---

## 8. Test Data

### 8.1 Audio Test Files (TO BE CREATED)

| File | Duration | Language | Content |
|---|---|---|---|
| `test_en_hello.wav` | 2s | English | "Hello, how are you?" |
| `test_hi_namaste.wav` | 2s | Hindi | "नमस्ते, आप कैसे हैं?" |
| `test_silence.wav` | 3s | — | Silence |
| `test_noise.wav` | 3s | — | Background noise |
| `test_long.wav` | 10s | English | Extended speech |

### 8.2 Test Users

| Name | Email | Password | Language |
|---|---|---|---|
| Test Alice | alice@test.com | test1234 | en |
| Test Bob | bob@test.com | test1234 | hi |
| Test Charlie | charlie@test.com | test1234 | fr |

---

## 9. Quality Gates

### Before Phase 6 (MVP Integration):
- [ ] All AUTH unit tests pass
- [ ] All MTG unit tests pass
- [ ] All ORCH unit tests pass
- [ ] E2E-01 passes manually

### Before V1.0 Release:
- [ ] All server unit + integration tests pass
- [ ] AI pipeline benchmark shows P80 ≤ 6s
- [ ] E2E-01 through E2E-06 pass
- [ ] No critical security issues open (SEC-01 through SEC-07 fixed)
