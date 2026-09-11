# IMPLEMENTATION PLAN AUDIT & RECONCILIATION

> This document was produced by auditing `implementation_plan.md` against the actual repository source files. Every contradiction, missing dependency, ordering issue, and risk identified here has been reconciled **before** the technical documentation set was generated.

---

## 1. Contradictions Found & Resolved

### C-1: AI Service Description Mismatch

| implementation_plan.md says | Actual code says |
|---|---|
| "Whisper-small (STT) → NLLB-200-600M (NMT) → gTTS / **XTTS-v2**" (plan §1, §6.2) | `main.py` docstring line 12: "Whisper-small (STT) → NLLB-200-600M (NMT) → **gTTS / XTTS-v2**" — matches |
| "Whisper **large-v3** on GPU" (plan §6.2, Stage 2) | `pipeline.py` docstring and `main.py` description both say "Whisper-**small**". The env var `WHISPER_MODEL` defaults to `"small"` at `main.py:139`. |
| "NLLB **distilled-1.3B** on GPU" (plan §6.2, Stage 3) | `main.py:140` defaults to `"facebook/nllb-200-distilled-600M"` (the 600M model, not 1.3B). |

**Resolution**: The plan *aspirationally* references larger models (large-v3, 1.3B) as GPU-tier configuration, while the code defaults to smaller models (small, 600M) as CPU-safe defaults. Both are accurate for their contexts. The documentation set uses the **code defaults** as the current state and the **plan values** as the GPU-tier upgrade path. No contradiction — just scope clarification.

### C-2: Edge TTS vs gTTS as Primary

| Plan says | Code says |
|---|---|
| "Edge Neural TTS (KEEP as primary), gTTS fallback" (§6.2 Stage 4) | `tts.py` and `pipeline.py` call `synthesize_speech()` which invokes `synthesize_edge_tts()` first, falling back to `synthesize_gtts()`. The health endpoint says `"edge_tts"` as the default engine. |

**Resolution**: Consistent. Edge TTS is primary, gTTS is fallback. No fix needed.

### C-3: Socket.IO Room Name for Transcript Broadcast

| Plan says | Code says |
|---|---|
| Transcripts broadcast "to all room participants" (§2.1) | `transcriptRoutes.js:41`: `io.to(meetingId).emit(...)` — broadcasts to the **meetingId**, not the **roomCode**. |
| `meetingHandlers.js`: participant joins `socket.join(roomCode)` | The Socket.IO room name is `roomCode` (e.g., "abc-defg-hij"), but transcript broadcast uses `meetingId` (a MongoDB ObjectId). |

**Resolution**: This is an **actual bug**. The transcript broadcast emits to a room named by the MongoDB `_id`, but participants join a room named by `roomCode`. These are different strings, so transcript `new-transcript` events never reach any socket. Documented as a known bug in the technical documentation. Must be fixed in Phase 0.

### C-4: Phase 5 Dependency Ordering

| Plan says | Code says |
|---|---|
| Phase 5 (Socket.IO transport) depends on "Phase 2" | Phase 2 (server orchestrator) already defines the `audio-chunk` Socket.IO event (§Phase 2, Task 1). Phase 5 then also defines the same event. |

**Resolution**: Phase 2 and Phase 5 overlap. Phase 2's orchestrator *requires* audio chunks to arrive via Socket.IO — it can't work if the client is still using HTTP POST to Colab. **Phase 5 should be merged into Phase 2.** The documentation reflects this merge.

### C-5: "Translation Deduplication" Contradiction

| Plan says | Code says |
|---|---|
| "Calls AI Service ONCE per unique lang" (§5.1) — implies server sends one `process-audio` request per target language | "Calls AI service `POST /api/process-audio` with the audio + target languages" (§Phase 2, Task 2) — implies a single request with multiple targets |

**Resolution**: The AI service endpoint already accepts `target_languages` as a JSON array of codes (see `main.py:161`). One AI service call handles all target languages. The server does NOT need to call the AI service once per language — it calls once with all target languages and receives all translations + audio in a single response. The documentation corrects this to a single-call model.

---

## 2. Missing Dependencies Found & Added

### D-1: Phase 2 Requires Phase 5 (Not Vice Versa)

Phase 2 (Server Orchestrator) defines a new Socket.IO `audio-chunk` event but the client still sends chunks via HTTP POST (Phase 5 changes this). The orchestrator cannot function without the client sending chunks via Socket.IO. **Phase 5 must be folded into Phase 2**, or Phase 2 must temporarily accept HTTP POST forwarding.

**Resolution**: Merged Phase 5 into Phase 2 in the documentation.

### D-2: Transcript Broadcast Bug Blocks Phase 3

Phase 3 (Client Receiver) relies on the client receiving `translation-result` events via Socket.IO. But C-3 above shows that the *existing* transcript broadcast is broken (wrong room name). This must be fixed in Phase 0, not discovered in Phase 3.

**Resolution**: Added transcript room-name fix as a Phase 0 task.

### D-3: Language List Dependency

Phase 4 (Language Selector) calls `GET /api/languages` on the AI service. But the target architecture routes all AI calls through the Node.js server. Either:
- The client calls the AI service directly for this one endpoint (breaks the architecture), or
- The server proxies `GET /api/languages` from the AI service.

**Resolution**: Server should proxy/cache the language list. Added to Phase 2 orchestrator tasks.

---

## 3. Architectural Risks Identified

### R-1: Socket.IO Binary Payload Size

Audio chunks (1-2.5s WebM Opus) are approximately 15-50 KB. Socket.IO's default `maxHttpBufferSize` is 1 MB. This is safe, but base64-encoded TTS responses per language add another ~30-80 KB each. For 4 target languages, a single translation result could be 200-350 KB.

**Risk**: Acceptable for MVP (well within 1 MB). At scale, consider binary transport instead of base64.

### R-2: Server Becomes Translation Bottleneck

The target architecture routes ALL audio through the Node.js server → AI service. A single Node.js process handles both WebRTC signaling, REST APIs, AND forwarding audio blobs to the AI service. Under load:
- Multiple concurrent translation requests can starve signaling.
- Large binary payloads consume event loop time.

**Risk**: Medium. For MVP (1-2 meetings), acceptable. For production, need a dedicated translation worker process.

### R-3: Colab Cold Start

If the Colab notebook has been idle, Whisper and NLLB models need to reload into GPU memory (~30-60 seconds). The first translation request after a cold start will timeout.

**Risk**: High for demo scenarios. Health check polling (Phase 6) mitigates this by detecting the cold state.

### R-4: The Summarize Endpoint Uses roomCode as meetingId

`summaryRoutes.js:94-95` does `Meeting.findOneAndUpdate({ roomCode: meetingId }, ...)` — the parameter is named `meetingId` but is matched against `roomCode`. The `POST` URL is `/api/meetings/:meetingId/summarize`. This means the client must pass the `roomCode` (not the MongoDB `_id`) as the `:meetingId` URL parameter.

**Risk**: Naming confusion. Not a bug if the client passes `roomCode`, which it does (the summary page uses `roomCode` from the URL). But the naming is misleading. Documented as a known design smell.

---

## 4. Incorrect Ordering

### O-1: Phase Dependency Graph Correction

**Original**: Phase 1 → Phase 2 → (Phase 3, Phase 4, Phase 5 in parallel) → Phase 6

**Corrected**: Phase 1 → Phase 2+5 (merged) → (Phase 3, Phase 4 in parallel) → Phase 6

Phase 5 is not independently useful and is a prerequisite for Phase 2's functionality.

---

## 5. Items Verified as Correct

- ✅ Dual mic capture problem (confirmed in `useSpeechTranslation.js` line 22 and `useAudioCapture.js`)
- ✅ TURN API key exposure (confirmed in `useWebRTC.js` line 23-24)
- ✅ MongoDB connection string format in `.env`
- ✅ CORS wildcard on both services (confirmed `server.js:18-21` and `main.py:120-126`)
- ✅ Mongoose race condition (confirmed `meetingHandlers.js` and `socket/index.js` both call `meeting.save()`)
- ✅ AudioContext leak pattern (confirmed `useAudioVolume.js` creates new context on stream change)
- ✅ Room code generation format `abc-defg-hij` (confirmed `Meeting.js:66-71`)
- ✅ AI pipeline response format matches `schemas.py` SubtitleResponse model
