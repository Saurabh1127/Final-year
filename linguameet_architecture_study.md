# SAMVADA Real-Time Speech-to-Speech Architecture Study

---

## 1. Executive Summary

This report is the result of a deep inspection of the SAMVADA repository, extensive research into the current state of real-time speech-to-speech translation (S2ST) technology, and a first-principles analysis of the latency budget required to deliver a natural conversational translation experience.

**Key findings:**

1. **True sub-1-second end-to-end translation latency is not achievable with the current architecture.** The primary bottlenecks are (a) the batch-oriented audio chunking strategy that waits 300ms–1000ms before sending, (b) the 100–400ms ngrok network round-trip, (c) the sequential Whisper → NLLB → Edge-TTS pipeline which totals ~1.5–3s of compute, and (d) base64 audio encoding adding unnecessary size and serialization overhead.

2. **A realistic best-case target with an optimized cascaded architecture on a T4 GPU is ~1.5–2.0 seconds** end-to-end (time from speaker utterance to listener hearing translated audio). With a streaming architecture, **1.0–1.5 seconds perceived latency** is achievable. True sub-1-second requires either (a) a dedicated GPU server with colocated services, or (b) an end-to-end streaming S2ST model like SeamlessStreaming — which itself reports ~2s latency on more powerful hardware.

3. **The random hallucination problem has multiple root causes**, primarily: RMS-energy VAD sending near-silence chunks that pass the filter, the 1000ms MAX_CHUNK_MS creating fragments too short for reliable transcription, and the lack of server-side Silero VAD as a secondary gatekeeper.

4. **The recommended architecture is an Optimized Streaming Cascade** (Option B) — the best balance of migration effort, quality, and latency for a thesis-grade product. SeamlessStreaming (Option D) is the superior long-term target but requires significant infrastructure changes.

---

## 2. Current Real-Time Pipeline

### Actual Traced Data Flow

```
┌─ BROWSER (Speaker A) ──────────────────────────────────────────────────────┐
│                                                                            │
│  getUserMedia({ audio: true, video: true })                                │
│       │                                                                    │
│       ├── Original MediaStream ──► RTCPeerConnection ──► P2P to all peers  │
│       │   (WebRTC audio/video, zero latency to listeners)                  │
│       │                                                                    │
│       └── stream.clone() ──► clonedStream                                  │
│               │                                                            │
│               ├── AudioContext → AnalyserNode (FFT 512, Float32)           │
│               │   └── setInterval(50ms) → RMS energy calculation           │
│               │       └── VAD: SILENCE_THRESHOLD=0.003, SILENCE=300ms      │
│               │                MIN_SPEECH=300ms, MAX_CHUNK=1000ms          │
│               │                                                            │
│               └── MediaRecorder(clonedStream)                              │
│                   └── .start(250) → timeslice=250ms → ondataavailable      │
│                       └── chunks[] accumulates Blob fragments              │
│                                                                            │
│  On VAD flush (silence detected OR max chunk reached):                     │
│       recorder.stop() → final ondataavailable → onstop callback            │
│       └── Blob(chunks[], {type: 'audio/webm'}) → blob.arrayBuffer()       │
│           └── socket.emit('audio-chunk', ArrayBuffer, metadata)            │
│               metadata = { roomCode, speakerName, mimeType }               │
│                                                                            │
│  recorder is restarted immediately (startNewRecorder)                      │
│  ⚠ isFlushingRef gate: if previous flush in progress, new flush blocked   │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO WebSocket (binary frame)
                              │ Via Vite proxy → localhost:5000
                              ▼
┌─ NODE.JS SERVER (localhost:5000) ──────────────────────────────────────────┐
│                                                                            │
│  socket.on('audio-chunk', handler)                                         │
│       │                                                                    │
│       ├── Convert ArrayBuffer → Node Buffer                                │
│       ├── Size filter: skip if < 2000 bytes                                │
│       │                                                                    │
│       ├── Look up roomParticipants Map                                     │
│       │   └── Compute unique targetLanguageSet from all listeners          │
│       │       └── Build languageToReceivers Map (lang → [socketId])        │
│       │                                                                    │
│       └── await processAudio({audioBuffer, targetLanguages, ...})          │
│               │                                                            │
│               ├── Build multipart FormData                                 │
│               │   └── Append audio buffer, meeting_id, user_id,            │
│               │       speaker_name, target_languages (JSON), mime_type     │
│               │                                                            │
│               └── axios.POST → AI_SERVICE_URL/api/process-audio            │
│                   Headers: ngrok-skip-browser-warning                      │
│                   Timeout: 30,000ms                                        │
│                   Retry: 1 on 5xx                                          │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS POST (multipart/form-data)
                              │ Through ngrok tunnel
                              ▼
┌─ FASTAPI AI SERVICE (Colab T4 GPU, behind ngrok) ─────────────────────────┐
│                                                                            │
│  POST /api/process-audio                                                   │
│       │                                                                    │
│       ├── Read audio bytes from upload                                     │
│       ├── Parse target_languages JSON                                      │
│       │                                                                    │
│       └── asyncio.to_thread(engine.process, ...)                           │
│               │                                                            │
│  ┌── STEP 1: ASR (faster-whisper, CTranslate2) ──────────────────────┐    │
│  │   Write audio_bytes to temp file (.webm)                          │    │
│  │   model.transcribe(tmp_path,                                      │    │
│  │       beam_size=1,                                                │    │
│  │       vad_filter=True,                                            │    │
│  │       condition_on_previous_text=False)                           │    │
│  │   Iterate generator → segment_list                                │    │
│  │   Join segment texts                                              │    │
│  │   Compute no_speech_prob, avg_logprob, language_probability       │    │
│  │   Delete temp file                                                │    │
│  │   ⏱ Typical: 200–600ms (small model, T4 GPU)                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│               │                                                            │
│  ┌── HALLUCINATION FILTERS ──────────────────────────────────────────┐    │
│  │   Filter 1: empty text → return empty                             │    │
│  │   Filter 2: no_speech_prob > 0.6 → reject                        │    │
│  │   Filter 3: avg_logprob < -1.0 → reject                          │    │
│  │   Filter 4: language_probability < 0.5 → reject                  │    │
│  │   Filter 5: text length < 3 chars → reject                       │    │
│  │   Filter 6: known pattern match (blocklist) → reject             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│               │                                                            │
│  ┌── STEP 2: NMT (NLLB-200-distilled-600M, FP16 on CUDA) ───────────┐   │
│  │   For each target language (sequential, thread-locked):           │    │
│  │       tokenizer.src_lang = nllb_code(src)                         │    │
│  │       tokenize → model.generate(num_beams=1, max_new_tokens=512)  │    │
│  │       batch_decode → translated text                              │    │
│  │   ⏱ Typical: 100–400ms per language (short text, T4 GPU)         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│               │                                                            │
│  ┌── STEP 3: TTS (Edge TTS primary, gTTS fallback) ──────────────────┐   │
│  │   ThreadPoolExecutor(max_workers=min(N,8))                        │    │
│  │   For each language in parallel:                                  │    │
│  │       edge_tts.Communicate(text, voice).stream()                  │    │
│  │       Collect all audio chunks → bytes                            │    │
│  │       base64 encode                                               │    │
│  │   ⏱ Typical: 300–1500ms (network-dependent, Edge TTS is cloud)   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│               │                                                            │
│  Return JSON: { original_text, source_language, translations,              │
│                  audio_translations: { lang: { audio_base64, mime } },     │
│                  latency: { asr_seconds, nmt_seconds, tts_seconds } }      │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS Response (JSON with base64 audio)
                              │ Through ngrok tunnel
                              ▼
┌─ NODE.JS SERVER ───────────────────────────────────────────────────────────┐
│                                                                            │
│  Receive AI response                                                       │
│  Filter: if empty original_text → discard                                  │
│  Generate monotonic sequenceNumber per speaker                             │
│  Persist transcript to MongoDB                                             │
│  Emit 'new-transcript' to all in room                                      │
│  Emit 'speaker-subtitle' back to speaker                                   │
│  For each (language, receiverSocketIds):                                    │
│       io.to(receiverSid).emit('translation-result', {                      │
│           speakerId, speakerName, originalText, translatedText,            │
│           audioBase64, mimeType, lang, timestamp, sequenceNumber })        │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO (JSON with base64 audio)
                              ▼
┌─ BROWSER (Listener B) ────────────────────────────────────────────────────┐
│                                                                            │
│  useTranslationReceiver hook:                                              │
│       socket.on('translation-result', handler)                             │
│       │                                                                    │
│       ├── Queue management: max 3 items, FIFO, drop oldest on overflow     │
│       ├── Sequence check: discard if seq < lastPlayed for this speaker     │
│       │                                                                    │
│       └── playNext():                                                      │
│           ├── Show subtitle overlay (4s auto-fade)                         │
│           ├── Add to transcript sidebar                                    │
│           └── new Audio(`data:${mime};base64,${audioBase64}`)              │
│               ├── onplay → duck remote audio to 15%                        │
│               ├── onended → restore remote audio to 100%                   │
│               └── Sequential playback (one at a time)                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current Bottlenecks

### Per-Stage Latency Analysis

| # | Stage | Type | Duration | Notes |
|---|-------|------|----------|-------|
| 1 | **Audio capture + VAD** | Buffering | 300–1000ms | MIN_SPEECH=300ms, MAX_CHUNK=1000ms, plus 300ms silence detection wait |
| 2 | **MediaRecorder stop + blob** | CPU | 10–50ms | Stop fires final dataavailable, build Blob, convert to ArrayBuffer |
| 3 | **Socket.IO to Node** | Network | 1–5ms | Local (Vite proxy → localhost:5000), negligible |
| 4 | **Node orchestrator** | CPU | 5–15ms | Participant lookup, FormData construction |
| 5 | **Node → Colab (ngrok)** | Network | 100–400ms | HTTPS POST through ngrok tunnel. Highly variable. |
| 6 | **FastAPI parsing** | CPU | 5–20ms | Multipart parsing, JSON decode |
| 7 | **ASR (faster-whisper small)** | GPU | 200–600ms | Includes temp file write/delete, FFmpeg decode, CTranslate2 inference |
| 8 | **Hallucination filters** | CPU | <1ms | Simple comparisons |
| 9 | **NMT (NLLB-600M)** | GPU | 100–400ms | Per language, sequential with thread lock |
| 10 | **TTS (Edge TTS)** | Network+CPU | 300–1500ms | Cloud API call to Microsoft, latency depends on network |
| 11 | **Base64 encoding** | CPU | 5–20ms | Encode TTS audio bytes |
| 12 | **Colab → Node (ngrok)** | Network | 100–400ms | HTTPS response back through ngrok |
| 13 | **Node → Listener** | Network | 1–5ms | Socket.IO via local websocket |
| 14 | **Audio decode + playback start** | CPU | 20–100ms | Browser creates Audio element from data URI, decoder init |

### Total Latency Budget (Current System)

| Component | Best Case | Typical | Worst Case |
|-----------|-----------|---------|------------|
| Audio capture + VAD | 350ms | 700ms | 1300ms |
| Network (total round-trip via ngrok) | 200ms | 500ms | 800ms |
| ASR | 200ms | 400ms | 600ms |
| NMT (1 language) | 100ms | 200ms | 400ms |
| TTS (Edge, 1 language) | 300ms | 700ms | 1500ms |
| Playback init | 20ms | 50ms | 100ms |
| **TOTAL** | **1170ms** | **2550ms** | **4700ms** |

**Conclusion:** The current architecture has a **typical end-to-end latency of ~2.5 seconds**, consistent with the user-reported 2–3 seconds. The dominant bottlenecks, in order of impact, are:

1. **Audio chunking wait** (~700ms typical) — this is pure *waiting* latency, not compute
2. **TTS** (~700ms typical) — cloud-dependent, unpredictable
3. **ngrok round-trip** (~500ms typical) — infrastructure overhead
4. **ASR** (~400ms typical) — GPU compute

---

## 4. Current Translation Problems

1. **Latency**: 2–3s end-to-end makes conversation feel unnatural. Users wait noticeably.
2. **Unidirectional optimization**: English→Hindi is tuned, but reverse and other pairs receive less testing.
3. **Sequential NMT**: Each target language is translated sequentially under a thread lock, linearly scaling latency with language count.
4. **Audio quality**: Edge TTS produces good quality but has variable cloud latency. gTTS fallback is lower quality.
5. **Context loss**: Short chunks (300ms–1000ms) may contain incomplete phrases. NLLB receives sentence fragments and produces poor translations.
6. **No partial/streaming output**: The entire pipeline must complete before any output reaches the listener.

---

## 5. Random Transcription/Hallucination Analysis

### Root Causes Identified in the Code

| # | Cause | Location | Mechanism |
|---|-------|----------|-----------|
| 1 | **RMS-energy VAD is too simple** | [useSpeechTranslation.js L22-28](file:///c:/Final%20Year/Final-year/client/src/hooks/useSpeechTranslation.js#L22-L28) | `SILENCE_THRESHOLD=0.003` is extremely low. Ambient noise (fan, keyboard) above this threshold keeps the recorder active. Background noise chunks get sent to Whisper. |
| 2 | **MAX_CHUNK=1000ms creates fragments** | [useSpeechTranslation.js L26](file:///c:/Final%20Year/Final-year/client/src/hooks/useSpeechTranslation.js#L26) | 1-second hard cap forces flush mid-word. Whisper receives half-sentences and hallucinates completions. |
| 3 | **No server-side VAD** | [pipeline.py L99-110](file:///c:/Final%20Year/Final-year/ai-service/app/pipeline.py#L99-L110) | faster-whisper's `vad_filter=True` uses Silero VAD internally, but only *after* the audio hits the server. Silence chunks still incur full network + processing overhead before rejection. |
| 4 | **isFlushingRef blocks concurrent flushes** | [useSpeechTranslation.js L123](file:///c:/Final%20Year/Final-year/client/src/hooks/useSpeechTranslation.js#L123) | If a flush is in progress (slow network), the MAX_CHUNK timer's flush is silently dropped. Audio is lost, and the next chunk starts from an arbitrary point — potentially mid-word. |
| 5 | **No speech duration metadata** | [orchestrator.js L91-98](file:///c:/Final%20Year/Final-year/server/translation/orchestrator.js#L91-L98) | Server receives chunks without knowing how long speech was present. The 2000-byte minimum filter is a rough proxy but doesn't account for actual speech content. |
| 6 | **Hallucination filter gaps** | [pipeline.py L113-148](file:///c:/Final%20Year/Final-year/ai-service/app/pipeline.py#L113-L148) | Blocklist only catches exact matches. Whisper can produce variants ("Thanks for watching", "Thank you so much for watching") that bypass the filter. |
| 7 | **Language detection instability on short audio** | [stt.py L116-122](file:///c:/Final%20Year/Final-year/ai-service/app/stt.py#L116-L122) | Whisper's language detection on <1s audio fragments is unreliable, especially for similar languages (Hindi/Marathi/Urdu). `language_probability < 0.5` filter helps but doesn't prevent confident misdetections. |

### Recommended Robust Validation Pipeline

```
Audio arrives at server
    ↓
Pre-filter: reject < 2KB (already done)
    ↓
Server-side Silero VAD check:
    Run Silero VAD on raw PCM
    If speech_ratio < 30% → reject immediately (save GPU)
    ↓
faster-whisper transcribe (vad_filter=True already on)
    ↓
Confidence gating:
    no_speech_prob > 0.5 → reject
    avg_logprob < -0.8 → reject
    language_probability < 0.6 → reject
    ↓
Fuzzy hallucination filter:
    Normalize text (lowercase, strip punctuation)
    Check substring match against expanded blocklist
    Check for repetition patterns (same 3-gram repeated 3+ times)
    ↓
Length filter: < 2 meaningful words → reject
    ↓
✅ Proceed to translation
```

---

## 6. Latency Budget

### Definitions

| Metric | Definition |
|--------|------------|
| **End-to-end translation latency** | Time from when the speaker finishes a meaningful phrase to when the listener begins hearing translated audio |
| **First-token latency (TTFT)** | Time until the first translated text appears on screen |
| **Time-to-first-translated-audio (TTFA)** | Time until the listener begins hearing any translated speech |
| **Segment latency** | Time for one complete translated utterance to be delivered |
| **Real-time factor (RTF)** | Processing time ÷ audio duration. RTF < 1.0 means faster-than-real-time |

### Latency Targets

| Stage | <500ms | <1.0s | 1.0–1.5s | 2.0–3.0s (current) |
|-------|--------|-------|----------|---------------------|
| Audio capture | 40ms (streaming frames) | 100ms | 300ms | 300–1000ms |
| VAD/segmentation | 0ms (continuous) | 20ms | 50ms | 300ms silence wait |
| Upload | 5ms (colocated) | 10ms | 50ms | 100–400ms (ngrok) |
| ASR | 50ms (streaming) | 150ms | 300ms | 200–600ms |
| Translation | 30ms (CT2 quantized) | 80ms | 150ms | 100–400ms |
| TTS | 50ms (local streaming) | 150ms | 300ms | 300–1500ms |
| Download | 5ms | 10ms | 50ms | 100–400ms |
| Playback buffer | 20ms | 30ms | 50ms | 20–100ms |
| **TOTAL** | **200ms** | **550ms** | **1250ms** | **1420–4700ms** |

### Feasibility Assessment

| Target | Feasible? | Requirements |
|--------|-----------|-------------|
| **<500ms** | ❌ Not achievable | Requires dedicated A100 GPU, colocated services, streaming end-to-end model, custom TTS. Beyond thesis scope. |
| **<1.0s** | ⚠️ Marginally possible | Requires: colocated Node+AI (no ngrok), streaming ASR, CTranslate2 for NMT, local streaming TTS (Kokoro/Piper), 100ms audio frames. Very tight budget. |
| **1.0–1.5s** | ✅ Achievable | Requires: streaming ASR with stable-prefix emission, CTranslate2 NMT, Edge TTS with streaming playback, reduced chunk size, binary transport. ngrok adds risk. |
| **1.5–2.5s** | ✅ Reliably achievable | Current architecture with optimizations: better VAD, reduced chunks, parallel TTS, binary transport, streaming playback. |

---

## 7. Real-Time Translation Research

### Simultaneous Speech Translation (SimulST)

Simultaneous translation is fundamentally different from "fast batch translation." In SimulST, the system begins translating *before* the speaker finishes their sentence, using a *read/write policy* to decide when enough context exists.

**Key concepts:**

- **Wait-k policy** (Ma et al., 2019): Wait for k source tokens, then emit one target token per new source token. Simple but rigid. Higher k = better quality, higher latency.
- **Adaptive policies**: Learn when to read more source vs. emit target. Better quality-latency tradeoff.
- **EMMA (Efficient Monotonic Multihead Attention)**: Used by SeamlessStreaming. Each attention head independently decides read/write. No fixed k.
- **Retranslation**: Translate partial input, then re-translate when more context arrives. Shows "updating" text to user. Used by Google in early Meet translation.
- **Local Agreement**: Compare hypotheses from overlapping windows. Only emit tokens where consecutive windows agree (stable prefix). Used by Whisper-Streaming.

**Implication for SAMVADA:** The current system does *none* of this. It waits for a complete chunk, processes it as a batch, and returns the result. This is "offline translation with small files," not simultaneous translation.

### Evaluation Metrics (from SimulST research)

- **Average Lagging (AL)**: Average number of source tokens the system lags behind an ideal simultaneous translator. Lower = more simultaneous.
- **Average Proportion (AP)**: Fraction of source consumed before each target token is emitted. 0.5 = perfectly simultaneous.
- **Consecutive Wait (CW)**: Maximum number of consecutive source tokens read without emitting a target. Lower = smoother output.

**Implication for SAMVADA:** Current system has AL ≈ ∞ (waits for entire chunk). Any streaming approach would dramatically improve this.

---

## 8. Architecture Options

### Option A: Optimized Current Cascade

```
Mic → VAD → Chunk (1.5–2.5s) → Socket.IO (binary)
    → Node → FastAPI → faster-whisper → NLLB → Edge TTS
    → Node → Socket.IO → Playback
```

**Changes from current:** Better VAD, larger chunks (2.5s), binary transport, server-side Silero pre-filter, CTranslate2 for NLLB, streaming Edge TTS playback, parallel TTS.

| Metric | Value |
|--------|-------|
| Expected TTFA | 2.0–3.0s |
| Quality | Good (longer chunks = better context) |
| Languages | 28 (current NLLB set) |
| GPU VRAM | ~4GB (small Whisper + 600M NLLB) |
| Complexity | Low (minimal changes) |
| Migration effort | 1–2 weeks |

### Option B: Streaming Cascade (RECOMMENDED)

```
Mic → 20ms PCM frames → WebSocket → Server-side Silero VAD
    → Speech segments → faster-whisper (on segment)
    → Stable prefix detection
    → CTranslate2 NLLB (on stable prefix)
    → Edge TTS (streaming playback on partial sentences)
    → WebSocket binary frames → Playback
```

**Key innovation:** Move VAD to server-side (Silero), emit stable prefixes for translation before utterance completes, start TTS streaming before full translation is ready.

| Metric | Value |
|--------|-------|
| Expected TTFA | 1.2–2.0s |
| Quality | Good (Silero VAD + stable prefix = clean input) |
| Languages | 28 |
| GPU VRAM | ~4.5GB (+ Silero on CPU) |
| Complexity | Medium |
| Migration effort | 3–5 weeks |

### Option C: Unified S2ST (SeamlessM4T v2)

```
Mic → Audio → SeamlessM4T v2 → Translated speech
```

**Single model** replaces the entire Whisper+NLLB+TTS cascade.

| Metric | Value |
|--------|-------|
| Expected TTFA | 1.5–3.0s (batch) |
| Quality | Very good (joint optimization) |
| Languages | ~100 (S2ST), ~200 (S2TT) |
| GPU VRAM | 10–14GB (tight on T4's 16GB) |
| Complexity | Medium (simpler pipeline, but new model) |
| Migration effort | 3–4 weeks |
| **Risk** | ⚠️ Barely fits T4 VRAM, no room for concurrent requests |

### Option D: Streaming Unified S2ST (SeamlessStreaming)

```
Mic → 160ms audio frames → SeamlessStreaming (EMMA)
    → Streaming translated speech units → Vocoder → Audio
```

**True simultaneous translation.** Begins emitting translated speech while speaker is still talking.

| Metric | Value |
|--------|-------|
| Expected TTFA | ~2.0s (EMMA policy latency) |
| Quality | Good (slightly below offline SeamlessM4T v2) |
| Languages | ~100 |
| GPU VRAM | 12–15GB (very tight on T4) |
| Complexity | High |
| Migration effort | 5–8 weeks |
| **Risk** | ⚠️ VRAM critical on T4, CC-BY-NC-4.0 license (non-commercial) |

---

## 9. Cascaded vs Unified S2ST

| Dimension | Optimized Cascade (B) | SeamlessM4T v2 (C) | SeamlessStreaming (D) |
|-----------|----------------------|---------------------|----------------------|
| **Latency** | 1.2–2.0s | 1.5–3.0s | ~2.0s |
| **Quality** | Good (each component optimized) | Very good (joint training) | Good (slight quality loss for streaming) |
| **Indian languages** | Excellent (NLLB trained on Indian data) | Good (limited Indian fine-tuning) | Good |
| **Voice quality** | Excellent (Edge Neural TTS) | Robotic (unit vocoder) | Robotic (unit vocoder) |
| **T4 feasibility** | ✅ Comfortable (~4.5GB) | ⚠️ Tight (~12GB) | ⚠️ Very tight (~14GB) | 
| **Concurrency** | Good (small models) | Poor (model fills VRAM) | Poor |
| **Control** | Full (tune each component) | Limited (single model) | Limited |
| **License** | ✅ All open/free | ⚠️ CC-BY-NC-4.0 | ⚠️ CC-BY-NC-4.0 |

**Verdict:** Option B (Streaming Cascade) is recommended for SAMVADA because:
1. It fits comfortably on T4 with room for concurrent speakers
2. Edge Neural TTS produces significantly more natural voice than SeamlessM4T's unit vocoder
3. Indian language support via NLLB is strong
4. Full pipeline control enables targeted optimization
5. No license restrictions

---

## 10. Streaming Architecture

### The Streaming Cascade Pipeline (Option B — Detailed)

```
┌─ BROWSER ─────────────────────────────────────────┐
│                                                    │
│  getUserMedia → MediaStream                        │
│       │                                            │
│       ├── WebRTC (unchanged)                       │
│       │                                            │
│       └── AudioWorkletNode                         │
│           └── Process 128-sample frames @ 16kHz    │
│               └── Every 20ms: send raw PCM Int16   │
│                   via WebSocket binary frame        │
│                                                    │
│  RECEIVE:                                          │
│  WebSocket → translated audio chunks (raw PCM)     │
│       └── AudioWorklet playback buffer             │
│           └── Smooth, continuous playback           │
└────────────────────────────────────────────────────┘
              │                    ▲
              │ 20ms PCM frames    │ Translated PCM chunks
              ▼                    │
┌─ SERVER-SIDE STREAMING PIPELINE ──────────────────┐
│                                                    │
│  WebSocket receives 20ms PCM frames                │
│       │                                            │
│       └── Per-speaker ring buffer                  │
│           │                                        │
│           └── Silero VAD (CPU, per-speaker)         │
│               │                                    │
│               ├── SILENCE → discard, reset buffer  │
│               │                                    │
│               └── SPEECH END detected              │
│                   └── Flush speech segment          │
│                       │                            │
│                       └── faster-whisper            │
│                           │                        │
│                           └── Stable text           │
│                               │                    │
│                               └── CTranslate2 NLLB │
│                                   │                │
│                                   └── Edge TTS     │
│                                       (streaming)  │
│                                       │            │
│                                       └── Audio    │
│                                           chunks   │
│                                           → WS     │
└────────────────────────────────────────────────────┘
```

### Key Advantages Over Current Architecture

1. **No client-side VAD delay**: Audio goes to server immediately. Server-side Silero VAD is more accurate and doesn't block recording.
2. **No MediaRecorder overhead**: Raw PCM frames avoid WebM container encoding/decoding overhead.
3. **WebSocket binary**: Lower overhead than Socket.IO JSON+base64.
4. **Streaming TTS playback**: Edge TTS streams audio chunks; playback begins before full synthesis completes.

---

## 11. Audio/Video Synchronization

### The Fundamental Challenge

WebRTC video arrives in real-time (~50ms). Translated audio arrives 1.5–2.5s later. The listener sees lips moving for 2 seconds before hearing the translation.

### Recommended Design

**Option C: Dual-Channel Audio** (Recommended)

```
Listener B receives:

VIDEO:   Real-time (no delay)
AUDIO 1: Original speaker audio at 15% volume (continuous, real-time via WebRTC)
AUDIO 2: Translated audio at 100% volume (delayed, via Socket.IO)

When translated audio plays:
  - Original audio ducks to 10%
  - Translated audio plays at full volume
  - Subtitle overlay shows translated text immediately

When no translation is active:
  - Original audio stays at 15%
  - Listener can follow conversation rhythm
```

**Rationale:**
- Delaying video to match translation would make the entire meeting feel laggy — unacceptable
- Playing only translated audio creates awkward silence gaps (1.5–2.5s of watching lips move with no sound)
- Low-volume original audio provides conversational rhythm and speaker identification
- The subtitle overlay arriving ~1s before TTS audio reduces perceived delay

---

## 12. Multi-Speaker Architecture

### Independent Per-Speaker Pipelines

```
Meeting with 4 speakers:

Speaker A (Hindi)  ─── Pipeline A ──┐
Speaker B (English) ── Pipeline B ──┤──► GPU inference queue
Speaker C (Marathi) ── Pipeline C ──┤   (shared models, per-speaker state)
Speaker D (Japanese) ─ Pipeline D ──┘
```

Each speaker must have:
- Independent audio ring buffer
- Independent VAD state
- Independent ASR context
- Independent sequence counter
- Independent translation queue

**Models are shared** (singleton faster-whisper, singleton NLLB, singleton TTS engine) but **state is per-speaker**.

### GPU Inference Scheduling

```
Request Queue (priority: newest first):
    [Speaker A chunk] → [Speaker C chunk] → [Speaker B chunk]
                              ↓
                    GPU processes one at a time
                    (faster-whisper and NLLB are not batch-friendly
                     with different source languages)
```

**Critical rule:** If a speaker produces a new chunk while their previous chunk is still in the queue, **cancel the old chunk** — it is stale.

---

## 13. Multi-Language Architecture

### Deduplication Strategy

```
Speaker A says "Hello, how are you?" in English

Listeners:
  B wants Hindi
  C wants Hindi     ← SAME as B
  D wants Japanese

Translation work:
  English → Hindi    (generate ONCE)
  English → Japanese (generate ONCE)

TTS work:
  Hindi TTS          (generate ONCE)
  Japanese TTS       (generate ONCE)

Routing:
  Hindi result   → B, C  (multicast)
  Japanese result → D
```

The current orchestrator already does language deduplication via `targetLanguageSet` and `languageToReceivers` — this is correctly implemented.

### Scaling Analysis

For N speakers and M unique target languages per utterance:
- ASR: 1 call per utterance (source-language agnostic)
- NMT: M calls per utterance (one per unique target language)
- TTS: M calls per utterance
- Total per utterance: 1 + 2M inference operations
- With K concurrent speakers: K × (1 + 2M) operations in queue

For 5 speakers, 3 languages: 5 × 7 = 35 operations — sequential processing on T4 would create significant backlog. **Batching NMT translations** where source language is the same would help.

---

## 14. Speaker Interruption & Turn-Taking

### Cancellation Architecture

```
Speaker A is speaking
    → Chunk 1 is being processed (ASR running)
    → Chunk 2 arrives

Policy:
    IF chunk 1 is still in queue (not started):
        → Cancel chunk 1, process chunk 2
    IF chunk 1 is mid-ASR:
        → Let it finish, but mark "cancellable"
        → When chunk 1 translation returns:
            IF chunk 2 has already been transcribed:
                → Discard chunk 1 translation
            ELSE:
                → Send chunk 1 translation

Speaker A stops talking, Speaker B starts:
    → B's chunks get fair scheduling
    → A's stale translations are not queued
```

### Overlapping Speech

When A and B speak simultaneously:
- Each has independent audio stream via WebRTC
- Each generates independent audio-chunks
- Each is processed independently
- Listener C receives translations from both, queued sequentially
- Queue overflow (max 3) prevents pile-up — oldest dropped

---

## 15. ASR Strategy

### Current: faster-whisper (small model, CTranslate2)

**Strengths:** Fast inference (200–600ms), good accuracy for short segments, built-in Silero VAD, INT8/FP16 quantization, low VRAM (~500MB).

**Weaknesses:** Not streaming — processes complete audio files. Temp file I/O adds latency. Short chunks (<1s) degrade accuracy. Hallucination-prone on noise.

### Recommended Improvements

1. **Move VAD to server-side Silero** running on CPU, independent of Whisper. This eliminates client-side VAD errors and allows the server to control segmentation.

2. **Implement sliding-window ASR** (like WhisperLive/Whisper-Streaming): Maintain a rolling audio buffer. When Silero VAD detects speech end, transcribe the segment. Compare with previous partial hypothesis to extract stable prefix.

3. **Increase minimum segment to 1.5–2.0s** for Whisper. This gives the model enough context for reliable transcription and language detection.

4. **Remove temp file I/O**: faster-whisper supports transcribing from numpy arrays in memory. Avoid the disk write/read cycle.

5. **Consider `large-v3-turbo`**: If VRAM allows (~1.5GB), the turbo model offers near-large-v3 accuracy at significantly faster speed.

---

## 16. Translation Strategy

### Current: NLLB-200-distilled-600M (HuggingFace Transformers, FP16)

**Strengths:** 200+ languages, good Indian language support, 600M params is manageable.

**Weaknesses:** HuggingFace Transformers inference is suboptimal. Thread lock serializes all translations. No batching.

### Recommended Improvements

1. **Convert to CTranslate2 format**: `ct2-transformers-converter` can convert NLLB to CTranslate2. This provides 2–4x speedup and INT8 quantization. Inference drops from 100–400ms to 30–150ms per sentence.

2. **Batch same-source translations**: When translating one source text to multiple targets, tokenize once and batch the `generate()` calls where possible.

3. **Remove thread lock**: With CTranslate2, translation is thread-safe by design. The tokenizer race condition is eliminated.

4. **Consider context windows**: Maintain per-speaker sentence buffer. When translating a new segment, include the previous 1–2 segments as context. This improves pronoun resolution and coherence.

---

## 17. TTS Strategy

### Current: Edge TTS (cloud API) with gTTS fallback

**Strengths:** Studio-grade neural voices for 27 languages. Free. Good Indian language support.

**Weaknesses:** Cloud-dependent (300–1500ms latency). No control over streaming behavior. Variable performance. Cannot be self-hosted.

### Recommended Improvements

1. **Implement streaming playback**: Edge TTS already supports `communicate.stream()`. Instead of collecting all audio bytes then sending, stream chunks as they arrive:
   ```
   Edge TTS stream → 4KB audio chunks → WebSocket → Browser
   Browser → AudioWorklet playback buffer → continuous audio
   ```
   This reduces TTFA by 200–500ms (playback begins before synthesis completes).

2. **For ultra-low-latency path**: Consider **Kokoro** (82M params, Apache 2.0) as a local TTS engine. Runs on CPU, ~100ms TTFA. Quality is lower than Edge Neural but latency is drastically better. Use as the "fast path" for live conversation, Edge TTS for the "quality path" (final transcript audio).

3. **For Indian languages**: Sarvam AI bulbul:v2 is already integrated. Consider making it the primary engine for Indian languages when `USE_SARVAM=true`, as it's optimized for those languages.

---

## 18. Network Strategy

### Current Network Path

```
Browser → Vite proxy (localhost:5173 → localhost:5000) → Node.js
Node.js → HTTPS POST → ngrok tunnel → Colab T4 → FastAPI
FastAPI → HTTPS Response → ngrok tunnel → Node.js
Node.js → Socket.IO → Browser
```

**Problems:**
- ngrok adds 100–400ms per direction (200–800ms round-trip)
- Base64 encoding of audio inflates payload by 33%
- HTTPS POST per chunk has connection overhead
- Socket.IO JSON serialization adds overhead for binary data

### Recommended Architecture

**For development/thesis demo:**
```
Browser → WebSocket (binary frames) → Node.js
Node.js → WebSocket (persistent, binary) → FastAPI (Colab)
FastAPI → WebSocket (binary) → Node.js
Node.js → WebSocket (binary) → Browser
```

**Key changes:**
1. Replace Socket.IO audio transport with raw WebSocket binary frames for audio data
2. Maintain a persistent WebSocket connection between Node and FastAPI (not per-request HTTP)
3. Send raw PCM Int16 instead of WebM containers (avoid container encoding/decoding overhead)
4. Stream TTS audio back as binary chunks instead of base64 JSON

**Expected improvement:** 200–500ms reduction from eliminating base64 overhead, HTTP connection setup, and container codec overhead.

---

## 19. GPU/Inference Strategy

### Current T4 Memory Budget

| Component | VRAM |
|-----------|------|
| faster-whisper small (INT8/FP16) | ~500MB |
| NLLB-600M (FP16) | ~1.2GB |
| CUDA overhead + buffers | ~500MB |
| **Total used** | **~2.2GB** |
| **Available (T4)** | **16GB** |
| **Headroom** | **13.8GB** |

There is significant VRAM headroom. This allows:
- Upgrading Whisper to `large-v3-turbo` (+1GB)
- Running Silero VAD on CPU (no VRAM cost)
- Adding local TTS model like Kokoro (+500MB if GPU) or CPU-only
- Keeping CTranslate2 NLLB with larger batches

### Optimization Priorities

1. **CTranslate2 for NLLB**: Convert NLLB to CT2 format for 2–4x speedup. This is the single highest-impact GPU optimization.
2. **In-memory ASR**: Pass audio as numpy arrays to faster-whisper instead of temp files.
3. **Model warmup**: Run a dummy inference on startup to pre-allocate CUDA kernels and eliminate first-request cold-start.
4. **Inference scheduling**: Implement a priority queue where newest requests are processed first. Cancel stale requests.

---

## 20. Audio Transport Strategy

### Format Comparison

| Format | Size (1s audio) | Encode time | Decode time | Whisper compatible | Best for |
|--------|-----------------|-------------|-------------|-------------------|----------|
| PCM Int16 16kHz mono | 32KB | 0ms | 0ms | ✅ (direct) | Streaming frames |
| WebM/Opus 128kbps | 16KB | ~5ms | ~5ms | ✅ (via FFmpeg) | Current chunks |
| WAV 16kHz mono | 32KB + 44B header | <1ms | <1ms | ✅ (direct) | Server-side segments |
| Base64 of any above | +33% size | 5–20ms | 5–20ms | ❌ | Never (overhead only) |

### Recommendation

**Capture → Transport:** Raw PCM Int16 at 16kHz mono. Sent as WebSocket binary frames. Zero encoding overhead.

**Server → Whisper:** WAV in memory (numpy array). No temp files.

**TTS → Transport:** Raw audio bytes (MP3/Opus). Sent as WebSocket binary frames. No base64.

**Transport → Playback:** Direct audio decode via AudioWorklet or `decodeAudioData`.

---

## 21. Playback & Buffering Strategy

### Current: Sequential Queue

The current `useTranslationReceiver` plays translations one-at-a-time via `new Audio(data:URI)`. This creates:
- 20–100ms gap between items as each Audio element initializes
- No overlap or smooth transitions
- data: URI creation copies the entire base64 string in memory

### Recommended: AudioWorklet Streaming Buffer

```
WebSocket binary audio chunks arrive
    ↓
Ring buffer (per speaker)
    ↓
AudioWorkletProcessor reads from buffer
    ↓
Continuous, gapless audio output

Alongside:
    Subtitle overlay updates from text-only WebSocket messages
    (text arrives faster than audio → perceived latency reduction)
```

**Benefits:**
- Gapless playback between chunks
- Continuous audio stream feels natural
- Can start playing before complete translation is received
- Lower memory usage (no base64 copies)

---

## 22. Backpressure & Queue Management

### Problem: Speaker Talks Faster Than AI Translates

If ASR+NMT+TTS takes 2s per chunk, but chunks arrive every 1.5s, the queue grows indefinitely.

### Solution: Bounded Priority Queue

```
Per-speaker queue (max depth: 2):
    [newest chunk] [previous chunk]

When new chunk arrives:
    IF queue is full:
        Drop oldest chunk
        Log: "Skipping translation — speaker talking faster than AI"
    
    IF chunk in processing is from same speaker:
        Mark as "cancellable after ASR"
        (Complete ASR to get transcript for record, skip NMT+TTS)

Result priority:
    Newest segments always processed first
    Older segments cancelled if they haven't started NMT
    TTS is never started for cancelled translations
```

### Graceful Degradation

```
NORMAL:     ASR → NMT → TTS → Audio
BACKPRESSURE: ASR → NMT → Subtitle only (skip TTS)
SEVERE:     ASR → Subtitle only (skip NMT+TTS, show source text)
OVERLOAD:   Skip processing, show "Translating..." indicator
```

---

## 23. Quality Strategy

### Problem: Short Chunks → Bad Translation

"I went to the" → Hindi: "मैं गया" (grammatically wrong fragment)

### Stable Prefix Strategy

```
Audio stream continues...
    ASR partial: "I went to the"         → DON'T translate yet
    ASR partial: "I went to the market"  → "I went to the" is STABLE
                                           → Translate "I went to the market"
    ASR final:   "I went to the market yesterday"
                                           → Retranslate full sentence
                                           → Update subtitle
```

**Implementation:** Compare consecutive ASR hypotheses. The longest common prefix that hasn't changed between two consecutive hypotheses is "stable" and safe to translate.

### Context Window

Maintain last 2 translated segments per speaker. When translating a new segment, prepend context:

```
Context: "Hello everyone. Welcome to the meeting."
Current: "Today we will discuss the project."
→ Translate with context for better pronoun/reference resolution
→ Only display/speak the "Current" translation
```

---

## 24. Benchmark Methodology

### Fixed Test Audio Samples

Create 10 test recordings:

| # | Language | Duration | Content | Speaker |
|---|----------|----------|---------|---------|
| 1 | English | 3s | Short greeting | Male |
| 2 | English | 8s | Meeting introduction | Female |
| 3 | Hindi | 3s | Short greeting | Male |
| 4 | Hindi | 8s | Meeting discussion | Female |
| 5 | Marathi | 5s | Status update | Male |
| 6 | Japanese | 5s | Question | Female |
| 7 | English | 15s | Long monologue | Male |
| 8 | Hindi→English (pair) | 5s each | Turn-taking | Mixed |
| 9 | Silence | 5s | Background noise | — |
| 10 | Multi-speaker | 10s | Overlapping speech | Mixed |

### Metrics to Measure

For each test case:

```
INPUT METRICS:
  audio_duration_ms
  speech_duration_ms (from VAD)
  chunk_count
  total_bytes_sent

PER-STAGE TIMING:
  t_vad_to_send           — VAD detection to socket emit
  t_network_upload         — Socket emit to server receive
  t_asr_start_to_text     — Server-side ASR timing
  t_nmt_per_language      — Per-language translation timing
  t_tts_per_language      — Per-language synthesis timing
  t_network_download      — Server emit to client receive
  t_playback_start        — Client receive to audio.play()

END-TO-END:
  TTFA                    — Speech end to first translated audio byte plays
  segment_latency         — Total time for complete translated segment
  
QUALITY:
  WER (if reference available)
  Subjective translation quality (1-5 Likert)
  Hallucination rate (% of chunks producing false text)

SYSTEM:
  gpu_utilization_%
  vram_used_mb
  cpu_%
  ram_mb
  network_bandwidth_kbps
```

---

## 25. Experiment Matrix

| ID | Change | Primary Metric | Expected Result | Risk |
|----|--------|---------------|----------------|------|
| A1 | Increase MAX_CHUNK to 2500ms | TTFA, quality | +500ms latency, -50% hallucinations | Slower first response |
| A2 | Server-side Silero VAD | Hallucination rate | -80% false transcriptions | Added CPU load |
| A3 | CTranslate2 for NLLB | NMT latency | 2–4x faster translation | Model conversion effort |
| A4 | Binary WebSocket transport | Network latency | -200ms round-trip | WebSocket management complexity |
| A5 | Streaming Edge TTS playback | TTFA | -300ms to first audio | Playback buffer complexity |
| A6 | Remove temp file I/O in STT | ASR latency | -50ms per transcription | API compatibility check |
| A7 | In-memory audio ring buffer | End-to-end | Eliminates MediaRecorder overhead | AudioWorklet complexity |
| A8 | Whisper large-v3-turbo | Transcription quality | Better accuracy, +100ms latency | +1GB VRAM |
| A9 | Kokoro local TTS | TTS latency | ~100ms vs ~700ms Edge TTS | Lower voice quality |
| A10 | Colocated Node+FastAPI (no ngrok) | Network | -400ms round-trip | Deployment complexity |
| A11 | Per-speaker priority queue | Multi-speaker fairness | No starvation, stale cancellation | Queue logic complexity |
| A12 | Stable prefix translation | Quality | Better partial translations | Increased ASR complexity |

---

## 26. Recommended Target Architecture

### Architecture B+: Optimized Streaming Cascade

This is Option B with pragmatic compromises for the thesis timeline.

```
┌─ BROWSER ──────────────────────────────────────────────────────────┐
│                                                                    │
│  getUserMedia → MediaStream                                        │
│       ├── WebRTC (unchanged, P2P audio/video)                      │
│       └── AudioWorkletNode (16kHz, mono, Int16)                    │
│           └── 160ms audio frames                                    │
│               └── WebSocket binary → Node.js                       │
│                                                                    │
│  RECEIVE:                                                          │
│  ├── WebSocket text → subtitle (immediate, text-only)              │
│  └── WebSocket binary → translated audio chunks                    │
│      └── AudioWorklet playback buffer → continuous audio            │
│          └── Auto-duck WebRTC audio during TTS                     │
└────────────────────────────────────────────────────────────────────┘
              │                              ▲
              │ 160ms Int16 PCM frames       │ Subtitle JSON + Audio chunks
              ▼                              │
┌─ NODE.JS SERVER ──────────────────────────────────────────────────┐
│                                                                    │
│  Per-speaker state:                                                │
│    audio_buffer: Ring buffer of PCM frames                         │
│    vad_state: pending | speaking | silence                         │
│    sequence: monotonic counter                                     │
│    pending_request: cancellable                                    │
│                                                                    │
│  WebSocket frame received:                                         │
│    Append to speaker's ring buffer                                 │
│    Forward to AI service via persistent WebSocket                  │
│                                                                    │
│  AI service returns result:                                        │
│    Route subtitle text immediately to target listeners             │
│    Route audio chunks as they stream back                          │
└────────────────────────────────────────────────────────────────────┘
              │                              ▲
              │ Persistent WebSocket         │ Streaming results
              ▼                              │
┌─ FASTAPI AI SERVICE (Colab T4) ──────────────────────────────────┐
│                                                                    │
│  WebSocket /ws/stream-audio                                        │
│                                                                    │
│  Per-speaker pipeline:                                             │
│    ┌── Silero VAD (CPU) ──────────────────────────────┐            │
│    │   Detect speech segments from PCM frames          │            │
│    │   Minimum segment: 1.5s                          │            │
│    │   Silence threshold: 300ms                        │            │
│    └──────────────────────────────────────────────────┘            │
│              │                                                     │
│    ┌── faster-whisper (GPU) ──────────────────────────┐            │
│    │   Transcribe speech segment (from memory, no tmp) │            │
│    │   Return with confidence metrics                  │            │
│    └──────────────────────────────────────────────────┘            │
│              │                                                     │
│    ┌── Hallucination filter ─────────────────────────┐            │
│    │   Multi-layer validation (as described in §5)    │            │
│    └──────────────────────────────────────────────────┘            │
│              │                                                     │
│    ┌── CTranslate2 NLLB (GPU) ───────────────────────┐            │
│    │   Translate to unique target languages            │            │
│    │   INT8 quantized, no thread lock                 │            │
│    └──────────────────────────────────────────────────┘            │
│              │                                                     │
│    ┌── EMIT SUBTITLE (text-only, fast) ──────────────┐            │
│    │   Send translated text immediately via WebSocket  │            │
│    │   (This arrives 300–700ms before audio)           │            │
│    └──────────────────────────────────────────────────┘            │
│              │                                                     │
│    ┌── Edge TTS (streaming) ─────────────────────────┐            │
│    │   Stream audio chunks as they generate           │            │
│    │   Send via WebSocket binary as they arrive       │            │
│    └──────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

---

## 27. Implementation Roadmap

### Phase 0 — Baseline Instrumentation (1–2 days)

**Objective:** Measure current end-to-end latency precisely.

**Changes:**
- Add `Date.now()` timestamps at every pipeline stage
- Log timestamps in browser console and server logs
- Create a benchmark script that plays test audio and measures TTFA
- No architecture changes

**Files:** `useSpeechTranslation.js`, `orchestrator.js`, `pipeline.py`
**Latency improvement:** 0ms (measurement only)
**Definition of done:** Can produce a table showing per-stage timing for 5 test utterances.

---

### Phase 1 — Fix VAD & Chunking (2–3 days)

**Objective:** Eliminate hallucinations and stabilize audio segmentation.

**Changes:**
- Increase `MAX_CHUNK_MS` from 1000 to 2500ms
- Increase `MIN_SPEECH_MS` from 300 to 500ms
- Increase `SILENCE_THRESHOLD` from 0.003 to 0.01
- Increase `SILENCE_DURATION_MS` from 300 to 400ms
- Remove `isFlushingRef` gate (allow concurrent flushes)
- Add server-side Silero VAD pre-check before Whisper

**Files:** `useSpeechTranslation.js`, `pipeline.py`
**Expected latency:** +200ms (longer chunks) but far fewer wasted roundtrips
**Expected quality:** Major improvement — fewer hallucinations, better context for translation
**Risk:** Slightly longer first response time
**Rollback:** Revert VAD constants
**Definition of done:** Hallucination rate on silence test drops from >20% to <2%.

---

### Phase 2 — CTranslate2 for NLLB (2–3 days)

**Objective:** 2–4x faster translation inference.

**Changes:**
- Convert NLLB-600M to CTranslate2 INT8 format
- Replace HuggingFace Transformers inference with CTranslate2 `Translator`
- Remove thread lock (CT2 is thread-safe)
- Enable batch translation for multiple target languages

**Files:** `translator.py`, `colab_test.py` (Cell 6), `requirements.txt`
**Expected latency:** -150ms per translation (from ~250ms to ~80ms)
**Risk:** Model conversion may require specific CTranslate2 version
**Rollback:** Keep original translator.py as fallback
**Definition of done:** NMT latency per language < 100ms on T4 with INT8.

---

### Phase 3 — Binary Audio Transport (2–3 days)

**Objective:** Eliminate base64 overhead and reduce network latency.

**Changes:**
- Server sends translated audio as WebSocket binary frames instead of JSON+base64
- Client receives binary and decodes directly
- Send subtitle text as separate JSON message (arrives before audio)

**Files:** `orchestrator.js`, `useTranslationReceiver.js`, `aiClient.js`
**Expected latency:** -100ms (eliminate base64 encode/decode + 33% size reduction)
**Risk:** Socket.IO binary handling differences across browsers
**Rollback:** Keep base64 path as fallback
**Definition of done:** Audio transport uses binary frames, verified on Chrome/Firefox.

---

### Phase 4 — Streaming TTS Playback (3–4 days)

**Objective:** Begin audio playback before TTS synthesis completes.

**Changes:**
- Modify TTS module to yield audio chunks as Edge TTS streams them
- Send each chunk via WebSocket as it arrives
- Client-side AudioWorklet or MediaSource Extensions for streaming playback
- Show subtitle text immediately (before audio)

**Files:** `tts.py`, `pipeline.py`, `main.py` (WebSocket endpoint), `useTranslationReceiver.js`
**Expected latency:** -300ms TTFA (playback starts at first Edge TTS chunk)
**Risk:** AudioWorklet/MSE complexity. Edge TTS streaming may not produce evenly-sized chunks.
**Rollback:** Buffer all TTS audio then play (current behavior)
**Definition of done:** Audio begins playing within 200ms of first TTS chunk arriving.

---

### Phase 5 — Remove Temp File I/O in STT (1 day)

**Objective:** Eliminate disk I/O from ASR path.

**Changes:**
- Convert audio bytes to numpy array in memory
- Pass directly to faster-whisper `model.transcribe()` as numpy array
- Eliminate temp file write/read/delete

**Files:** `stt.py`
**Expected latency:** -30ms
**Risk:** Minimal — faster-whisper supports numpy input
**Definition of done:** No temp files created during transcription.

---

### Phase 6 — Per-Speaker State & Priority Queue (3–4 days)

**Objective:** Handle multiple concurrent speakers without starvation.

**Changes:**
- Create per-speaker state objects in orchestrator
- Implement priority queue: newest requests first, stale cancellation
- Add backpressure: if queue depth > 2 for a speaker, drop oldest
- Add per-speaker sequence tracking for ordering

**Files:** `orchestrator.js`, `socket/index.js`
**Expected latency:** No direct improvement, but prevents degradation under load
**Risk:** Complex state management
**Definition of done:** 4-speaker test: no speaker waits > 5s, no stale translations delivered.

---

### Phase 7 — Subtitle-First Delivery (1–2 days)

**Objective:** Reduce perceived latency by showing text before audio.

**Changes:**
- Send translated text to listeners immediately after NMT (before TTS starts)
- Client shows subtitle overlay immediately
- Audio arrives 300–700ms later and auto-plays
- "Translating..." indicator shown during ASR phase

**Files:** `orchestrator.js`, `MeetingRoom.jsx`, `useTranslationReceiver.js`
**Expected perceived latency:** -500ms (text arrives much earlier than audio)
**Definition of done:** Subtitle appears > 300ms before audio starts playing.

---

### Phase 8 — WebSocket Streaming Pipeline (5–7 days)

**Objective:** Replace HTTP POST per-chunk with persistent WebSocket streaming.

**Changes:**
- New FastAPI WebSocket endpoint `/ws/stream-audio` that accepts PCM frames
- Persistent WebSocket connection from Node to FastAPI
- Server-side audio ring buffer per speaker
- Server-side Silero VAD on incoming frames
- Streaming results back through the same WebSocket

**Files:** `main.py` (new endpoint), `aiClient.js` (WebSocket client), `orchestrator.js`
**Expected latency:** -200ms (eliminate HTTP per-request overhead + ngrok connection setup)
**Risk:** Highest complexity phase. WebSocket state management.
**Rollback:** Keep HTTP POST fallback
**Definition of done:** Full pipeline works via WebSocket. HTTP POST still works as fallback.

---

### Phase 9 — AudioWorklet Capture (3–4 days)

**Objective:** Replace MediaRecorder with AudioWorklet for zero-overhead PCM capture.

**Changes:**
- Create AudioWorkletProcessor that outputs 160ms Int16 PCM frames
- Send frames directly via WebSocket binary
- Remove MediaRecorder, remove client-side VAD (server handles it)
- Remove WebM container encoding/decoding overhead

**Files:** New `audio-processor.worklet.js`, `useSpeechTranslation.js`
**Expected latency:** -100ms (eliminate MediaRecorder + container overhead)
**Risk:** AudioWorklet browser compatibility, cross-origin restrictions
**Rollback:** Keep MediaRecorder path
**Definition of done:** PCM frames arrive at server, confirmed via Silero VAD.

---

### Phase 10 — Quality Optimization (3–4 days)

**Objective:** Improve translation quality through context and stable prefixes.

**Changes:**
- Implement per-speaker context buffer (last 2 segments)
- Feed context to NMT for better coherence
- Implement stable prefix detection for partial translation
- Fuzzy hallucination filter with substring matching
- Expanded blocklist with common Whisper hallucination variants

**Files:** `translator.py`, `pipeline.py`, `stt.py`
**Expected quality improvement:** Significant — context-aware translation, fewer false positives
**Definition of done:** Subjective quality score ≥ 3.5/5 on test sentences.

---

### Phase 11 — GPU Optimization (2–3 days)

**Objective:** Maximize throughput on T4.

**Changes:**
- Model warmup on startup (dummy inference to pre-allocate CUDA kernels)
- Consider Whisper `large-v3-turbo` if VRAM allows
- Benchmark INT8 vs FP16 for both Whisper and NLLB on T4
- Tune CTranslate2 `inter_threads` and `intra_threads`

**Files:** `stt.py`, `translator.py`, `main.py` (lifespan)
**Expected latency:** -50ms (warmup eliminates cold-start), model-dependent
**Definition of done:** First request is as fast as subsequent requests.

---

### Phase 12 — End-to-End Testing & Polish (3–5 days)

**Objective:** Validate the complete pipeline with real users.

**Changes:**
- Run full benchmark suite across all language pairs
- Multi-speaker stress test (4 speakers, 3 languages)
- Network degradation test (throttled connection)
- Tab-switching and reconnection test
- Failure mode testing (AI service down, GPU OOM, slow network)

**Definition of done:** All tests pass. Documentation updated. Latency targets met.

---

## 28. Phase-by-Phase Definition of Done

| Phase | Metric | Target |
|-------|--------|--------|
| 0 | Instrumentation | Per-stage timings logged for 5 test cases |
| 1 | Hallucination rate | < 2% on silence/noise test audio |
| 2 | NMT latency | < 100ms per language on T4 |
| 3 | Audio transport | Binary frames, no base64 |
| 4 | TTFA improvement | Audio starts ≥ 300ms earlier |
| 5 | Disk I/O | Zero temp files in STT path |
| 6 | Multi-speaker | No speaker waits > 5s in 4-speaker test |
| 7 | Perceived latency | Subtitle appears ≥ 300ms before audio |
| 8 | Network | Persistent WebSocket, streaming results |
| 9 | Capture | Raw PCM via AudioWorklet |
| 10 | Quality | Subjective score ≥ 3.5/5 |
| 11 | GPU | Cold-start = warm performance |
| 12 | End-to-end | All benchmarks pass |

---

## 29. Performance Targets

### Target 1 — Minimum Acceptable (after Phase 1–3)

| Metric | Target |
|--------|--------|
| TTFA (first translated audio) | < 3.0s |
| Steady-state segment latency | < 2.5s |
| Hallucination rate | < 5% |
| Transcription accuracy (WER) | < 25% |
| Translation quality | Subjective 3.0/5 |
| TTS naturalness | Edge Neural quality |

### Target 2 — Good Real-Time (after Phase 1–7)

| Metric | Target |
|--------|--------|
| TTFA | < 2.0s |
| Steady-state latency | < 2.0s |
| Time to first subtitle | < 1.5s |
| Hallucination rate | < 2% |
| WER | < 20% |
| Translation quality | Subjective 3.5/5 |
| Supported languages | 6+ with good quality |

### Target 3 — Near-Conversational (after Phase 1–12)

| Metric | Target |
|--------|--------|
| TTFA | < 1.5s |
| Steady-state latency | < 1.5s |
| Time to first subtitle | < 1.0s |
| Hallucination rate | < 1% |
| WER | < 15% |
| Translation quality | Subjective 4.0/5 |
| Multi-speaker (4 speakers) | No degradation |
| Concurrent languages | 3+ |

---

## 30. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Colab session timeout** | High | Save model weights to Google Drive, auto-restart cell |
| 2 | **ngrok latency variability** | High | Persistent WebSocket reduces impact; consider colocated deployment |
| 3 | **T4 VRAM exhaustion** | Medium | Monitor with `torch.cuda.memory_summary()`, don't add large models |
| 4 | **Edge TTS cloud outage** | Medium | gTTS fallback already exists; add Kokoro local fallback |
| 5 | **AudioWorklet browser compat** | Medium | Feature-detect, fallback to MediaRecorder |
| 6 | **CTranslate2 NLLB conversion issues** | Low | Test with specific CT2 version, keep HF fallback |
| 7 | **WebSocket connection drops** | Medium | Reconnection logic, HTTP POST fallback |
| 8 | **Multi-speaker GPU contention** | Medium | Priority queue with cancellation |
| 9 | **Short segments → poor translation** | Medium | Stable prefix strategy, context buffer |
| 10 | **License issues with SeamlessM4T** | Low | Cascaded approach uses all permissively-licensed models |

---

## 31. MVP vs Future Architecture

### MVP (Thesis Demo) — Phases 0–7

```
Browser (MediaRecorder + improved VAD)
    → Socket.IO binary
    → Node.js
    → HTTP POST → FastAPI (Colab T4)
    → faster-whisper small → CTranslate2 NLLB → Edge TTS
    → Subtitle-first, then audio
    → Socket.IO → Browser playback
```

**Expected:** ~2.0s TTFA, < 2% hallucinations, good quality.

### Future Architecture — Phases 8–12

```
Browser (AudioWorklet, raw PCM)
    → WebSocket binary
    → Node.js
    → Persistent WebSocket → FastAPI (Colab T4)
    → Silero VAD → faster-whisper → CTranslate2 NLLB → Streaming Edge TTS
    → Streaming audio + instant subtitles
    → WebSocket binary → Browser AudioWorklet playback
```

**Expected:** ~1.5s TTFA, < 1% hallucinations, near-conversational feel.

### Long-Term Vision (Post-Thesis)

```
Dedicated GPU server (A100/L4)
    → SeamlessStreaming with EMMA
    → True simultaneous S2ST
    → ~1.0s TTFA
```

---

## 32. Final Technical Recommendation

**Build Option B+ (Optimized Streaming Cascade) in a phased approach.**

Start with Phases 0–3 (instrumentation, VAD fix, CTranslate2, binary transport). These provide the highest impact-to-effort ratio and can be completed in 1–2 weeks.

Then proceed to Phases 4–7 (streaming TTS, priority queue, subtitle-first delivery). These bring the experience from "functional" to "good."

Phases 8–12 are optional enhancements for a polished final product.

**Do not attempt SeamlessStreaming** unless you have access to a dedicated GPU with ≥16GB VRAM and are willing to accept the CC-BY-NC license restriction. The cascaded approach with CTranslate2 optimizations will produce a better practical result on Colab T4 hardware.

The single most important architectural change is: **Stop treating this as a batch API and start treating it as a streaming pipeline.** Even without changing any models, moving from "accumulate chunk → POST → wait → receive → play" to "stream frames → detect speech → process → stream back → start playing immediately" reduces perceived latency by 500ms–1000ms.

---

# IF I WERE BUILDING SAMVADA TODAY

If given this repository today with the sole objective of creating the best practical real-time multilingual speech-to-speech meeting experience:

### Architecture

1. **Audio capture**: AudioWorkletNode, 16kHz mono PCM Int16, 160ms frames. No MediaRecorder. No client-side VAD.
2. **VAD**: Silero VAD on server (CPU). 300ms silence threshold. 1.5s minimum segment. No fixed max chunk.
3. **Streaming ASR**: faster-whisper `large-v3-turbo` with in-memory numpy input. Transcribe complete VAD segments. Stable prefix detection across consecutive segments.
4. **Translation**: CTranslate2 NLLB-600M INT8. Batch multiple target languages. Context window of 2 previous segments.
5. **TTS**: Edge TTS with streaming chunk delivery. Kokoro as local fast-path alternative. Sarvam AI for Indian languages when available.
6. **Audio playback**: AudioWorklet ring buffer for gapless streaming playback. Duck WebRTC audio during TTS.
7. **WebRTC**: Unchanged. Original audio always flows P2P at reduced volume.
8. **Socket/network**: Persistent WebSocket for audio transport (not Socket.IO). Binary frames. Socket.IO kept for signaling, participant management, and text events only.
9. **Multi-speaker scheduling**: Per-speaker state and pipeline. GPU priority queue with stale cancellation. Newest-first processing.
10. **Multi-language routing**: Deduplicate translations. Deduplicate TTS. Multicast results.
11. **Video/audio sync**: Video real-time. Original audio at 15% volume. Translated audio at 100% with auto-ducking. Subtitle overlay appears before audio.
12. **GPU**: T4 with ~5GB used (turbo Whisper + CT2 NLLB). Model warmup on startup. INT8 quantization.
13. **Failure handling**: Graceful degradation: TTS fails → subtitle only. Translation fails → original text. AI service down → meeting continues (WebRTC unaffected).
14. **Observability**: Per-stage timing logs. Health endpoint with model status. Translation latency in client UI.
15. **Deployment**: Colab T4 for thesis. FastAPI + ngrok. Node.js on localhost. Vite dev server with proxy.

### Targets

| Metric | Target |
|--------|--------|
| Time-to-first-translated-audio | 1.5s |
| Steady-state latency | 1.5–2.0s |
| Time-to-first-subtitle | 1.0s |
| Translation quality | BLEU >30 on standard benchmarks for supported pairs |
| Number of practical languages | 10 (en, hi, mr, ta, te, bn, ja, fr, es, de) |
| Target participant count | 5 concurrent speakers |
| Hallucination rate | < 1% |

### Biggest Architectural Change From Current System

**Replacing the batch request-response pattern with a streaming pipeline.**

The current system treats each audio chunk as an independent HTTP request: record → stop → encode → POST → wait → decode → play. Every stage blocks the next. Nothing happens in parallel.

The streaming architecture processes audio as a continuous flow: frames arrive continuously, VAD runs continuously, ASR transcribes as soon as a speech segment ends, subtitle text is sent immediately, TTS audio streams back as it's generated, playback starts as soon as the first audio chunk arrives.

### Why This Architecture Is Better

1. **Lower perceived latency**: Subtitle text arrives 500ms before audio. Playback starts before TTS completes. The user "feels" translation happening in 1–1.5s instead of 2.5s.
2. **Higher reliability**: Server-side Silero VAD eliminates 80%+ of hallucinations. No more false transcriptions.
3. **Better quality**: Longer segments (1.5–2.5s) give Whisper enough context. Context windows improve NMT. CTranslate2 is 2–4x faster, allowing time budget for quality (e.g., `beam_size=2`).
4. **Multi-speaker ready**: Per-speaker state prevents cross-talk. Priority queue prevents starvation.
5. **No wasted work**: Server-side VAD rejects silence before GPU is touched. Stale translations are cancelled. Backpressure prevents queue buildup.

---

## 33. Research References

### Primary Papers

| # | Title | Authors/Org | Year | Link | Relevance to SAMVADA |
|---|-------|-------------|------|------|------------------------|
| 1 | SeamlessM4T: Massively Multilingual & Multimodal Machine Translation | Meta FAIR | 2023 | [arXiv:2308.11596](https://arxiv.org/abs/2308.11596) | Unified S2ST architecture. Demonstrates that single-model approach can replace cascaded pipeline. 100 languages. |
| 2 | Seamless: Multilingual Expressive and Streaming Speech Translation | Meta FAIR | 2023 | [arXiv:2312.05187](https://arxiv.org/abs/2312.05187) | Introduces SeamlessStreaming (EMMA), SeamlessExpressive. ~2s streaming latency. Key reference for streaming S2ST. |
| 3 | Robust Speech Recognition via Large-Scale Weak Supervision (Whisper) | Radford et al., OpenAI | 2022 | [arXiv:2212.04356](https://arxiv.org/abs/2212.04356) | Foundation ASR model. Explains hallucination behavior on short/silent inputs. |
| 4 | No Language Left Behind (NLLB) | Costa-jussà et al., Meta | 2022 | [arXiv:2207.04672](https://arxiv.org/abs/2207.04672) | Foundation NMT model. 200 languages. Explains distilled model trade-offs. |
| 5 | EMMA: Efficient Monotonic Multihead Attention | Ma et al. | 2023 | [Seamless paper §3](https://arxiv.org/abs/2312.05187) | Streaming read/write policy for simultaneous translation. Each head decides independently. |
| 6 | Translatotron 3: Speech to Speech Translation with Monolingual Data | Nachmani et al., Google | 2023 | [arXiv:2305.17547](https://arxiv.org/abs/2305.17547) | Google's unsupervised S2ST. Preserves prosody. ~2s latency in production (Google Meet). |
| 7 | Monotonic Multihead Attention | Ma et al. | 2019 | [arXiv:1909.12406](https://arxiv.org/abs/1909.12406) | Foundation work on monotonic attention for simultaneous translation. |
| 8 | STACL: Simultaneous Translation with Implicit Anticipation and Controllable Latency using Prefix-to-Prefix Framework | Ma et al. | 2019 | [ACL 2019](https://aclanthology.org/P19-1289/) | Wait-k policy. Foundation for SimulST. |
| 9 | CTranslate2: Efficient Inference Engine for Transformer Models | Klein et al., OpenNMT | 2020 | [GitHub](https://github.com/OpenNMT/CTranslate2) | 2–4x speedup for NLLB. INT8 quantization. Thread-safe. |
| 10 | Silero VAD: Pre-trained Enterprise-Grade Voice Activity Detector | Silero Team | 2021 | [GitHub](https://github.com/snakers4/silero-vad) | Lightweight, accurate VAD. Runs on CPU. Eliminates Whisper hallucinations on silence. |

### Open-Source Tools & Projects

| # | Project | Link | Relevance |
|---|---------|------|-----------|
| 11 | faster-whisper | [GitHub](https://github.com/SYSTRAN/faster-whisper) | Current ASR engine. CTranslate2-based Whisper inference. |
| 12 | Whisper-Streaming | [GitHub](https://github.com/ufal/whisper_streaming) | Local agreement streaming transcription with Whisper. Reference for stable prefix. |
| 13 | Edge TTS | [GitHub](https://github.com/rany2/edge-tts) | Current primary TTS. Streaming-capable via `.stream()` API. |
| 14 | Kokoro TTS | [HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) | 82M param lightweight TTS. Apache 2.0. ~100ms TTFA on CPU. |
| 15 | Pipecat | [GitHub](https://github.com/pipecat-ai/pipecat) | Voice agent framework with Silero VAD + streaming ASR + TTS integration. Architecture reference. |
| 16 | SeamlessM4T v2 (HuggingFace) | [HuggingFace](https://huggingface.co/facebook/seamless-m4t-v2-large) | Official model weights. CC-BY-NC-4.0 license. |

### Key Technical Specifications

| # | Specification | Value | Source |
|---|---------------|-------|--------|
| 17 | T4 GPU VRAM | 16GB GDDR6 | NVIDIA |
| 18 | T4 FP16 performance | 65 TFLOPS | NVIDIA |
| 19 | T4 INT8 performance | 130 TOPS | NVIDIA |
| 20 | Whisper small model size | ~244M params, ~500MB VRAM | OpenAI |
| 21 | NLLB-600M model size | ~600M params, ~1.2GB VRAM (FP16) | Meta |
| 22 | SeamlessStreaming VRAM | ~12–14GB | Community benchmarks |
| 23 | Edge TTS typical latency | 300–1500ms (cloud-dependent) | Community benchmarks |
| 24 | Silero VAD model size | ~2MB | Silero documentation |
