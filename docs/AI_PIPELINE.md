# AI_PIPELINE.md — AI/ML Pipeline Specification

# SAMVADA — AI Pipeline Specification

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Pipeline**: Cascaded STT → NMT → TTS  
**Cross-references**: [AUDIO_PIPELINE.md](file:///c:/Final%20Year/Final-year/docs/AUDIO_PIPELINE.md), [API.md](file:///c:/Final%20Year/Final-year/docs/API.md)

---

## 1. Pipeline Architecture

```
Audio Bytes (WebM/WAV/MP3)
         │
         ▼
┌─────────────────────────┐
│  Stage 1: STT (Whisper) │  0.3-0.8s (GPU)
│  Audio → Text           │
│  + Language Detection    │
└────────────┬────────────┘
             │  { text: "Hello", language: "en" }
             ▼
┌─────────────────────────────┐
│  Stage 2: NMT (NLLB-200)   │  0.1-0.3s per language (GPU)
│  Text → Translated Text    │
│  (for N target languages)  │
└────────────┬────────────────┘
             │  { "hi": "नमस्ते", "fr": "Bonjour" }
             ▼
┌─────────────────────────────────────┐
│  Stage 3: TTS (Edge TTS / gTTS)    │  0.3-1.5s per language
│  Translated Text → Audio (MP3)     │
│  (sequential per language)          │
└────────────┬────────────────────────┘
             │  { "hi": { audio_base64, mime_type }, ... }
             ▼
         JSON Response
```

---

## 2. Stage 1: Speech-to-Text (Whisper)

### 2.1 Model Details

**File**: [`stt.py`](file:///c:/Final%20Year/Final-year/ai-service/app/stt.py)

| Property | Value |
|---|---|
| Model | OpenAI Whisper |
| Default size | `small` (244M parameters) |
| GPU size | `large-v3` (1.55B parameters) — configurable via `WHISPER_MODEL` env var |
| Library | `openai-whisper` (PyPI) |
| Input | Raw audio bytes (WAV, WebM, MP3, OGG, M4A) |
| Output | `{ "text": str, "language": str, "segments": list }` |
| Language detection | Automatic (built-in to Whisper) |
| Supported languages | 99 languages |
| VRAM usage | small: ~1GB, large-v3: ~5GB |

### 2.2 Processing Flow

```python
def transcribe_audio(audio_bytes: bytes, source_language: str | None = None) -> dict:
    # 1. Write audio bytes to temporary file (Whisper requires file path)
    # 2. Load Whisper model (cached after first load)
    # 3. Call whisper.transcribe(temp_file, language=source_language)
    # 4. Return { text, language, segments }
```

### 2.3 Performance

| Model | Device | 2.5s Audio | 5s Audio |
|---|---|---|---|
| `small` | T4 GPU | ~0.3s | ~0.5s |
| `small` | CPU (Ryzen 7) | ~2s | ~4s |
| `large-v3` | T4 GPU | ~0.5s | ~0.8s |
| `large-v3` | CPU | ~10s+ | ~20s+ (not viable) |

### 2.4 Planned Optimization

**Replace `openai-whisper` with `faster-whisper`** (Phase 12):
- Uses CTranslate2 backend (quantized inference)
- 2-4x speedup on same GPU
- Lower VRAM usage
- Segment-level streaming output
- Drop-in API replacement

---

## 3. Stage 2: Machine Translation (NLLB-200)

### 3.1 Model Details

**File**: [`translator.py`](file:///c:/Final%20Year/Final-year/ai-service/app/translator.py)

| Property | Value |
|---|---|
| Model | Meta NLLB-200 |
| Default size | `distilled-600M` (600M parameters) |
| GPU size | `distilled-1.3B` — configurable via `NLLB_MODEL` env var |
| Library | HuggingFace `transformers` |
| Input | Source text + source lang code + target lang codes |
| Output | `{ lang_code: translated_text }` for each target |
| Supported languages | 200+ languages |
| VRAM usage | 600M: ~2.5GB, 1.3B: ~5GB |

### 3.2 Language Code Mapping

NLLB uses Flores-200 language codes (e.g., `eng_Latn`, `hin_Deva`), not ISO 639-1 (e.g., `en`, `hi`). The translator module maintains a mapping:

```python
LANG_CODE_MAP = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "fr": "fra_Latn",
    "es": "spa_Latn",
    "de": "deu_Latn",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "zh": "zho_Hans",
    "ar": "arb_Arab",
    "pt": "por_Latn",
    "ru": "rus_Cyrl",
    "it": "ita_Latn",
    # ... additional mappings
}
```

### 3.3 Batch Translation

```python
def translate_to_multiple(
    text: str,
    source_lang: str,
    target_languages: list[str]
) -> dict[str, str]:
    """
    Translate text to multiple target languages.
    Returns: { "hi": "translated", "fr": "traduit" }
    """
    # For each target language:
    #   1. Map ISO 639-1 → NLLB Flores code
    #   2. If source == target, return original text
    #   3. Tokenize with source language tag
    #   4. Generate translation
    #   5. Decode tokens
    # Returns dict of { lang_code: translated_text }
```

### 3.4 Performance

| Model | Device | Per Language |
|---|---|---|
| `distilled-600M` | T4 GPU | ~0.1-0.2s |
| `distilled-600M` | CPU | ~0.5-1s |
| `distilled-1.3B` | T4 GPU | ~0.2-0.4s |

### 3.5 Translation Quality Notes

- NLLB-200 is best-in-class for many language pairs
- Quality degrades for low-resource languages and very short inputs
- Informal/colloquial speech may translate awkwardly (trained on formal text corpora)
- No context window across chunks — each chunk is translated independently

---

## 4. Stage 3: Text-to-Speech (TTS)

### 4.1 Engine Hierarchy

**File**: [`tts.py`](file:///c:/Final%20Year/Final-year/ai-service/app/tts.py)

```
Priority 1: Edge Neural TTS (default, free, high-quality)
Priority 2: Sarvam AI TTS (optional, for Indian languages, requires API key)
Priority 3: gTTS (fallback, acceptable quality)
Priority 4: Skip audio (text-only subtitle)
```

### 4.2 Edge TTS

| Property | Value |
|---|---|
| Library | `edge-tts` (PyPI) |
| API | Microsoft Edge's neural TTS service |
| Cost | Free (no API key required) |
| Output | MP3 audio |
| Quality | Studio-grade neural voices |
| Latency | 0.3-1.5s (network API call) |
| Streaming | Supported (not currently used) |

**Voice Map** (12 languages, male voices):
```python
EDGE_VOICE_MAP = {
    "en": "en-US-GuyNeural",
    "hi": "hi-IN-MadhurNeural",
    "fr": "fr-FR-HenriNeural",
    "es": "es-ES-AlvaroNeural",
    "de": "de-DE-ConradNeural",
    "ja": "ja-JP-KeitaNeural",
    "ko": "ko-KR-InJoonNeural",
    "zh": "zh-CN-YunxiNeural",
    "ar": "ar-SA-HamedNeural",
    "pt": "pt-BR-AntonioNeural",
    "ru": "ru-RU-DmitryNeural",
    "it": "it-IT-DiegoNeural",
}
```

> [!NOTE]
> Only male voices are mapped. Female voice variants exist in Edge TTS but are not currently selectable. Languages not in this map fall back to English voice.

### 4.3 gTTS (Fallback)

| Property | Value |
|---|---|
| Library | `gTTS` (PyPI) |
| API | Google Translate's TTS endpoint |
| Cost | Free |
| Output | MP3 audio |
| Quality | Acceptable but robotic |
| Latency | 0.5-2s |

### 4.4 Sarvam AI TTS (Optional)

| Property | Value |
|---|---|
| Library | HTTP API via `requests` |
| API | Sarvam AI v1 |
| Cost | Paid (API key required) |
| Output | WAV audio |
| Quality | Good for Indian languages |
| Languages | Hindi, Tamil, Telugu, etc. |
| Config | `USE_SARVAM=true`, `SARVAM_API_KEY=sk_...` |

### 4.5 XTTS-v2 Voice Cloning (Non-functional)

**File**: [`voice_retention.py`](file:///c:/Final%20Year/Final-year/ai-service/app/voice_retention.py)

A `VoiceRetentionEngine` class exists but does nothing — it immediately falls back to Edge TTS. The XTTS-v2 model requires 5-10 seconds per inference and is not viable for real-time use.

**Status**: Skeleton only. Excluded from MVP scope.

### 4.6 TTS Output Format

```json
{
  "audio_base64": "<base64 encoded MP3 data>",
  "mime_type": "audio/mp3",
  "engine": "edge_tts"
}
```

Audio size per language (typical 1-2 sentence translation):
- MP3: 15-40 KB (1-3 seconds of audio)
- WAV: 80-200 KB (Sarvam output, larger)

---

## 5. Pipeline Orchestration

### 5.1 `SpeechToSpeechEngine.process()` Flow

**File**: [`pipeline.py`](file:///c:/Final%20Year/Final-year/ai-service/app/pipeline.py)

```python
def process(self, audio_bytes, target_languages, ...):
    t_start = time.time()

    # Step 1: STT
    t0 = time.time()
    transcription = transcribe_audio(audio_bytes, source_language)
    asr_s = round(time.time() - t0, 3)
    
    if not transcription["text"]:
        return self._empty_response(...)  # No speech detected
    
    # Step 2: NMT
    t0 = time.time()
    translations = translate_to_multiple(text, detected_lang, target_languages)
    nmt_s = round(time.time() - t0, 3)
    
    # Step 3: TTS (sequential per language)
    t0 = time.time()
    audio_translations = {}
    for lang, translated_text in translations.items():
        if translated_text and not translated_text.startswith("[Translation error"):
            tts_result = synthesize_speech(translated_text, lang, ...)
            audio_translations[lang] = tts_result
    tts_s = round(time.time() - t0, 3)
    
    return { original_text, translations, audio_translations, latency: {...} }
```

### 5.2 Current Issues

1. **Sequential TTS**: TTS runs sequentially for each target language. For 3 languages, this triples TTS latency (0.9-4.5s instead of 0.3-1.5s).

2. **No streaming**: The entire pipeline completes before any result is returned. With streaming, STT segments could be translated as they arrive.

3. **No caching**: If the same text is translated to the same language twice (e.g., two consecutive speakers say "hello"), the full pipeline runs again.

4. **Blocking GPU**: Whisper and NLLB use the GPU synchronously. Only one request can be processed at a time. No request queuing.

### 5.3 Planned Optimizations (Phase 12)

| Optimization | Impact | Complexity |
|---|---|---|
| Parallelize TTS with `asyncio.gather` | 2-3x TTS speedup | Low |
| Replace Whisper with `faster-whisper` | 2-4x STT speedup | Medium |
| Enable streaming Edge TTS | Lower perceived latency | Medium |
| Add TTS audio cache (LRU, keyed by text+lang) | Skip TTS for repeated phrases | Low |
| Request queue with concurrency limit | Prevent GPU contention | Medium |
| NLLB quantization (INT8) | Lower VRAM, ~20% faster | Low |

---

## 6. Supported Languages

### 6.1 Full Pipeline Support (STT + NMT + TTS)

These languages have coverage across all three stages:

| Code | Language | Whisper | NLLB | Edge TTS Voice |
|---|---|---|---|---|
| `en` | English | ✅ | ✅ | en-US-GuyNeural |
| `hi` | Hindi | ✅ | ✅ | hi-IN-MadhurNeural |
| `fr` | French | ✅ | ✅ | fr-FR-HenriNeural |
| `es` | Spanish | ✅ | ✅ | es-ES-AlvaroNeural |
| `de` | German | ✅ | ✅ | de-DE-ConradNeural |
| `ja` | Japanese | ✅ | ✅ | ja-JP-KeitaNeural |
| `ko` | Korean | ✅ | ✅ | ko-KR-InJoonNeural |
| `zh` | Chinese | ✅ | ✅ | zh-CN-YunxiNeural |
| `ar` | Arabic | ✅ | ✅ | ar-SA-HamedNeural |
| `pt` | Portuguese | ✅ | ✅ | pt-BR-AntonioNeural |
| `ru` | Russian | ✅ | ✅ | ru-RU-DmitryNeural |
| `it` | Italian | ✅ | ✅ | it-IT-DiegoNeural |

### 6.2 Partial Support

Languages supported by Whisper and NLLB but without a mapped Edge TTS voice will fall back to gTTS or English voice:
- Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi
- Thai, Vietnamese, Indonesian, Malay, Turkish, Polish, Dutch, Swedish, etc.

---

## 7. GPU Memory Budget

### 7.1 Default Configuration (small models)

| Component | VRAM |
|---|---|
| Whisper small | ~1.0 GB |
| NLLB distilled-600M | ~2.5 GB |
| PyTorch overhead | ~0.5 GB |
| **Total** | **~4.0 GB** |
| T4 available | 16.0 GB |
| **Headroom** | **12.0 GB** |

### 7.2 GPU Configuration (large models)

| Component | VRAM |
|---|---|
| Whisper large-v3 | ~5.0 GB |
| NLLB distilled-1.3B | ~5.0 GB |
| PyTorch overhead | ~0.5 GB |
| **Total** | **~10.5 GB** |
| T4 available | 16.0 GB |
| **Headroom** | **5.5 GB** |

### 7.3 Model Loading

Models are loaded lazily on first request (not at startup). The `lifespan` handler in `main.py` logs initialization but does not preload models. First request will be slower (~10-30s) due to model loading.

---

## 8. Error Handling

| Error | Behavior | Response |
|---|---|---|
| Whisper: no speech detected | Return empty text, skip NMT + TTS | `_empty_response()` with empty text and translations |
| Whisper: audio decode failure | Exception caught in `main.py` | Error response with `"[Pipeline Error]"` |
| NLLB: unsupported language code | Skip that language | Translation value: `"[Translation error: ...]"` |
| NLLB: model not loaded | First-load delay | ~10-30s on first request |
| Edge TTS: network failure | Fall back to gTTS | TTS result uses `"engine": "gtts"` |
| gTTS: failure | Skip audio for that language | `audio_translations[lang] = None` |
| GPU out of memory | Process crash | Requires restart; reduce model size |
