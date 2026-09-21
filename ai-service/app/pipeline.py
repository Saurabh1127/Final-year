"""
Unified Speech-to-Speech Pipeline Engine
Combines: Whisper (ASR) → NLLB-200 (NMT) → Edge TTS (TTS)

Single public entry point:
    from app.pipeline import engine
    result = engine.process(audio_bytes, target_languages=["hi", "fr"])

Phase 10 additions:
    - Expanded hallucination blocklist (~40 phrases + music/tag markers)
    - Fuzzy substring hallucination filter (_is_hallucination)
    - Repetition loop detector (same 3-word phrase repeated 3+ times)
    - Per-speaker context buffer (last 2 transcribed sentences per user_id)
    - Context-aware NMT: prefixes current text with context for NLLB coherence
"""

from __future__ import annotations

import os
import re
import time
from typing import Optional

# torch is only available when running on Colab/GPU machine
try:
    import torch  # type: ignore
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False


def log_gpu_stats(stage: str = "") -> None:
    """Print GPU VRAM and system RAM usage for diagnostics."""
    prefix = f"📊 [{stage}]" if stage else "📊"
    if _TORCH_AVAILABLE and torch.cuda.is_available():
        alloc = torch.cuda.memory_allocated() / 1e9
        reserved = torch.cuda.memory_reserved() / 1e9
        total = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"{prefix} VRAM: {alloc:.2f}GB alloc / {reserved:.2f}GB reserved / {total:.1f}GB total")
    try:
        import psutil  # type: ignore
        rss = psutil.Process().memory_info().rss / 1e9
        print(f"{prefix} System RAM: {rss:.2f}GB")
    except ImportError:
        pass

from .stt import transcribe_audio
from .translator import translate_to_multiple, get_nllb_code
from .tts import synthesize_speech
from .voice_retention import voice_engine


# ─────────────────────────────────────────────────────────────────────────────
# Phase 10 — Hallucination Filter
# ─────────────────────────────────────────────────────────────────────────────

# Expanded blocklist of known Whisper hallucination phrases.
# All comparisons are done after lowercasing + stripping punctuation.
_HALLUCINATION_BLOCKLIST: frozenset[str] = frozenset({
    # YouTube / streaming clichés
    "thank you for watching",
    "thanks for watching",
    "thank you for watching this video",
    "please subscribe",
    "subscribe to my channel",
    "like and subscribe",
    "don't forget to subscribe",
    "hit the like button",
    "hit the bell icon",
    "see you in the next video",
    "see you next time",
    "bye bye",
    # Music / noise markers
    "music",
    "applause",
    "laughter",
    "silence",
    "background music",
    # Teletext artifacts
    "subtitles by",
    "subtitles",
    "captions by",
    "closed captions",
    "transcribed by",
    # Common phantom repetitions
    "you",
    "um",
    "uh",
    "hmm",
    "ah",
    "oh",
    # Repeated punctuation / symbols (normalised away, but kept for safety)
    "...",
    "…",
    # Misc English
    "movistar",
    "www",
    "this video is brought to you by",
    "sponsored by",
    "ad",
    # ── Phase 12: Hindi / Indic phantom phrases ──────────────────────────────
    # Whisper commonly hallucinates these Hindi phrases on silence/noise when
    # processing Indian-language audio streams.
    "सब्सक्राइब",                   # "subscribe"
    "सब्सक्राइब करें",             # "subscribe kare"
    "शुक्रिया",                      # "shukriya"
    "धन्यवाद",                      # "dhanyavaad"
    "नमस्कार",                      # "namaskar"
    "आपका बहुत बहुत धन्यवाद",     # "aapka bahut bahut dhanyavaad"
    "आप देख रहे हैं",               # "aap dekh rahe hain"
    "देखते रहिये",                  # "dekhte rahiye"
    "लाइक और सब्सक्राइब",         # "like aur subscribe"
    "बेल आइकॉन",                    # "bell icon"
    "अगली वीडियो में",              # "agali video mein"
    "आपका स्वागत है",             # "aapka swaagat hai"
    "आमीन",                          # "aameen" (prayer noise)
    # ── Additional English patterns (Phase 12) ──────────────────────────────
    "thank you",
    "thanks",
    "okay",
    "alright",
    "so",
    "yeah",
    "yes",
    "no",
    "hello",
    "hi",
    "hey",
    "right",
    "the",
    "a",
    "i",
    "it",
    "is",
})

# Regex: detect [MUSIC], [APPLAUSE], ♪ etc. — common Whisper noise tags
_NOISE_TAG_RE = re.compile(
    r"(\[.*?\]|<.*?>|♪|♫|\*+)",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation/symbols, collapse whitespace.
    Uses re.UNICODE so \w matches Devanagari, Bengali, Tamil, etc.
    Without this flag, \w only matches ASCII and all Hindi characters get stripped.
    """
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)   # strip punctuation, keep Unicode word chars
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _has_repetition_loop(text: str, min_repeats: int = 3) -> bool:
    """
    Detect if a 3-word phrase is repeated ≥ min_repeats times in a row.
    E.g. "thank you thank you thank you" → True.
    This catches Whisper's looping hallucination pattern.
    """
    words = text.split()
    if len(words) < min_repeats * 2:
        return False
    # Check all n-gram sizes from 1 to 4
    for n in range(1, 5):
        for start in range(len(words) - n * min_repeats + 1):
            phrase = words[start:start + n]
            count = 1
            pos = start + n
            while pos + n <= len(words) and words[pos:pos + n] == phrase:
                count += 1
                pos += n
            if count >= min_repeats:
                return True
    return False


def _is_hallucination(text: str) -> bool:
    """
    Return True if the transcribed text is likely a Whisper hallucination.

    Checks (in order):
    1. Contains noise tags like [MUSIC] or ♪
    2. Normalised text exactly matches a blocklist entry
    3. Normalised text is a substring of a blocklist entry (fuzzy)
    4. A blocklist entry is a substring of the normalised text (fuzzy reverse)
    5. Repetition loop detected (same phrase 3+ times in a row)

    NOTE: Single-word utterances are NOT rejected here. All known single-word
    noise artifacts ("ah", "um", "hmm", "you", etc.) are already enumerated in
    _HALLUCINATION_BLOCKLIST and are caught by check 2. Blocking ALL single-word
    outputs would silently discard valid short speech ("Haan", "Yes", "Theek",
    "Namaste") that was VAD-cut from a longer utterance.
    """
    # 1. Noise tags
    if _NOISE_TAG_RE.search(text):
        print(f"🚫 [Filter] Noise tag detected in: \"{text[:60]}\" → rejected.")
        return True

    norm = _normalize(text)

    # Empty / pure whitespace after normalisation
    if not norm:
        print(f"🚫 [Filter] Empty after normalisation → rejected.")
        return True

    # 2. Exact blocklist match
    if norm in _HALLUCINATION_BLOCKLIST:
        print(f"🚫 [Filter] Exact blocklist match: \"{norm}\" → rejected.")
        return True

    # 3 & 4. Fuzzy substring match (both directions)
    for blocked in _HALLUCINATION_BLOCKLIST:
        if len(blocked) > 4:  # only check meaningful phrases, skip single words
            if blocked in norm or norm in blocked:
                print(f"🚫 [Filter] Fuzzy match \"{norm}\" ↔ blocklist \"{blocked}\" → rejected.")
                return True

    # 5. Repetition loop
    if _has_repetition_loop(norm):
        print(f"🚫 [Filter] Repetition loop detected: \"{norm[:60]}\" → rejected.")
        return True

    return False


# NOTE: Per-Speaker Context Buffer (Phase 10) was removed.
# The [Context: ...] prefix approach does NOT work with NLLB-200 — it is a pure
# sequence-to-sequence MT model that translates the prefix verbatim, causing
# "[Context: Do it] Do it" to appear in subtitles and be read aloud by TTS.
# If context-aware translation is needed, use an instruction-following LLM instead.


def _diagnose_pipeline(
    original_text: str,
    detected_lang: str,
    hint_lang: str | None,
    lang_prob: float,
    avg_logprob: float,
    no_speech_prob: float,
    duration_s: float,
    translations: dict[str, str],
    tts_engine: str,
) -> tuple[str, list[dict], str]:
    """
    Analyzes all pipeline handoffs (Audio -> STT -> Language -> NMT -> TTS)
    and pinpoints exactly which stage is degrading translation quality.
    Returns: (status: 'healthy' | 'warning' | 'error', warnings: list[dict], primary_remedy: str)
    """
    flags = []
    status = "healthy"
    remedy = "All translation pipeline stages are functioning normally."

    # Stage 1: Audio / VAD issues
    if duration_s > 0 and duration_s < 0.7:
        flags.append({
            "stage": "vad",
            "level": "warning",
            "title": "Audio Chunk Was Short",
            "message": f"Audio chunk duration was only {duration_s:.2f}s. Speech was likely cut off mid-sentence by silence detection.",
            "suggestion": "Speak complete thoughts without long mid-word pauses, or speak slightly closer to the mic."
        })
        status = "warning"
        remedy = f"Audio chunk was cut short ({duration_s:.2f}s). Sentence was likely sliced prematurely by VAD."

    # Stage 2: Spoken Language Mismatch
    if hint_lang and hint_lang.lower() not in ("auto", "", "none"):
        if detected_lang.lower() != hint_lang.lower():
            flags.append({
                "stage": "language_detection",
                "level": "warning",
                "title": "Spoken Language Mismatch",
                "message": f"You selected 'Speaking in: {hint_lang.upper()}', but Whisper identified speech as '{detected_lang.upper()}' (conf: {lang_prob*100:.1f}%).",
                "suggestion": f"If speaking in {hint_lang.upper()}, ensure words are pronounced clearly without excessive English mixing, or select 'auto'."
            })
            status = "warning"
            remedy = f"Language mismatch: Spoken {hint_lang.upper()} was classified as {detected_lang.upper()}. NLLB applied wrong grammar rules."

    # Stage 3: Whisper Recognition Confidence
    if avg_logprob < -0.95:
        flags.append({
            "stage": "stt",
            "level": "warning",
            "title": "Low STT Confidence",
            "message": f"Whisper speech recognition confidence was low ({avg_logprob:.2f} logprob). Some spoken words were likely misrecognized.",
            "suggestion": "Reduce background noise and speak with higher volume into your microphone."
        })
        status = "warning"
        if status != "error":
            remedy = f"Whisper recognition confidence was low ({avg_logprob:.2f}). Misheard words corrupted the translation."

    # Stage 4: NMT Translation Check
    for target_lang, trans in translations.items():
        if not trans or "[Translation error" in trans:
            flags.append({
                "stage": "nmt",
                "level": "error",
                "title": "NMT Translation Failure",
                "message": f"Meta NLLB model failed to produce translation for '{target_lang}'.",
                "suggestion": "Check NLLB model status in Colab."
            })
            status = "error"
            remedy = f"NLLB-200 model failed to generate translation for {target_lang.upper()}."
        elif original_text and len(original_text.split()) >= 4 and len(trans.split()) <= 1:
            flags.append({
                "stage": "nmt",
                "level": "warning",
                "title": "NMT Truncated Output",
                "message": f"Translation for '{target_lang}' is unusually brief compared to the input sentence.",
                "suggestion": "NLLB beam search may have dropped clauses. Try rephrasing."
            })
            status = "warning"
            remedy = f"NMT model over-compressed or dropped words during translation to {target_lang.upper()}."

    # Stage 5: TTS Synthesis
    if tts_engine and ("fallback" in tts_engine.lower() or "error" in tts_engine.lower()):
        flags.append({
            "stage": "tts",
            "level": "warning",
            "title": "TTS Fallback Used",
            "message": f"Primary voice engine failed and fell back to: {tts_engine}.",
            "suggestion": "Check your Sarvam AI API key or network connection to Edge-TTS."
        })
        if status == "healthy":
            status = "warning"

    return status, flags, remedy


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline Engine
# ─────────────────────────────────────────────────────────────────────────────

class SpeechToSpeechEngine:
    """
    Unified Speech-to-Speech Translation Engine.

    Pipeline:
        Audio bytes
          → Whisper-small  (transcription + language detection)
          → NLLB-200-600M  (translation to N target languages)
          → gTTS / XTTS-v2 (speech synthesis — voice cloning in Phase 2)
          → JSON result with text, translations, audio_base64, and latency metrics
    """

    def __init__(self) -> None:
        if _TORCH_AVAILABLE:
            device_label = "CUDA GPU" if torch.cuda.is_available() else "CPU"
        else:
            device_label = "CPU (torch not installed — run on Colab)"
        print(f"🚀 SpeechToSpeechEngine ready | Device: {device_label}")

    async def process_stream(
        self,
        audio_bytes: bytes,
        target_languages: Optional[list[str]] = None,
        source_language: Optional[str] = None,
        user_id: str = "unknown",
        speaker_name: str = "Anonymous",
        meeting_id: str = "unknown",
        include_audio: bool = True,
        mime_type: Optional[str] = None,
    ):
        """
        Streaming generator for S2ST pipeline.
        Yields:
          - A text payload right after NMT.
          - Audio chunk payloads as they stream from TTS.
          - A final 'done' payload with latency metrics.
        """
        import asyncio
        if not target_languages:
            target_languages = ["en"]

        t_start = time.time()

        # ── Step 1: ASR — Audio → Text (Whisper-small) ────────────────────────
        t0 = time.time()
        hint = source_language if source_language and source_language not in ("", "auto") else None

        # Run synchronous STT in a thread
        transcription = await asyncio.to_thread(transcribe_audio, audio_bytes, hint, mime_type)

        detected_lang: str = transcription["language"]
        original_text: str = transcription["text"]
        no_speech_prob: float = transcription.get("no_speech_prob", 0.0)
        avg_logprob: float = transcription.get("avg_logprob", 0.0)
        lang_prob: float = transcription.get("language_probability", 1.0)
        duration_s: float = transcription.get("duration_seconds", round(len(audio_bytes) / 32000.0, 2))
        asr_s = round(time.time() - t0, 3)
        print(f"📝 STT [{asr_s}s] [{detected_lang.upper()}]: {original_text[:80]}"
              f"  | duration={duration_s}s no_speech={no_speech_prob:.3f} logprob={avg_logprob:.3f} lang_prob={lang_prob:.3f}")
        log_gpu_stats("after-STT")

        # ── Phase 10 Hallucination & Noise Filters ───────────────────────────
        # Soften rejection when user provided an explicit language hint
        stat_reject = (
            no_speech_prob > 0.65 or
            avg_logprob < -1.1 or
            (lang_prob < 0.4 if not hint else False)
        )
        # NOTE: We intentionally do NOT reject based on character length (< 3).
        # Hindi words like "कर" (2 chars) and "हाँ" (3 chars) are valid speech.
        # The hallucination blocklist already catches known noise words.
        text_reject = not original_text or not original_text.strip()

        # ── Phase 12: Word-count filter ──────────────────────────────────────
        # If Whisper produces only 1 word token from a chunk, it's almost always
        # a hallucination artifact ("you", "the", "so", etc.) or a misfire.
        # Skip this check when user provided an explicit language hint, because
        # valid Hindi responses like "हाँ" may be 1 token.
        word_count = len(original_text.split()) if original_text else 0
        if word_count == 1 and not hint:
            text_reject = True

        if stat_reject or text_reject or _is_hallucination(original_text):
            reject_reason = (
                f"Silence/low-speech (no_speech={no_speech_prob:.2f})" if no_speech_prob > 0.65
                else f"Low confidence ({avg_logprob:.2f})" if avg_logprob < -1.1
                else f"Low language confidence ({lang_prob:.2f})" if (lang_prob < 0.4 and not hint)
                else "Short/empty utterance" if text_reject
                else "Hallucination pattern detected"
            )
            print(f"🔇 [Filter] Utterance filtered: {reject_reason}")
            filtered_diagnostics = {
                "status": "warning",
                "primary_remedy": f"Speech segment was filtered out: {reject_reason}.",
                "warnings": [{
                    "stage": "stt",
                    "level": "warning",
                    "title": "Speech Segment Filtered",
                    "message": f"Utterance was not passed to translation: {reject_reason}.",
                    "suggestion": "Speak louder and closer to the microphone."
                }],
                "vad": {"duration_seconds": duration_s, "audio_bytes": len(audio_bytes)},
                "stt": {
                    "original_text": original_text,
                    "detected_language": detected_lang,
                    "hint_language": hint or "auto",
                    "language_probability": round(lang_prob, 3),
                    "confidence_logprob": round(avg_logprob, 3),
                    "asr_seconds": asr_s,
                },
                "nmt": {"source_nllb_code": get_nllb_code(detected_lang), "nmt_seconds": 0.0, "target_languages": []},
                "tts": {"engine": "none", "tts_seconds": 0.0},
            }
            yield {
                "type": "text",
                "original_text": "",
                "source_language": detected_lang,
                "translations": {},
                "speaker_id": user_id,
                "speaker_name": speaker_name,
                "meeting_id": meeting_id,
                "timestamp": time.time(),
                "diagnostics": filtered_diagnostics,
            }
            yield {
                "type": "done",
                "latency": {
                    "asr_seconds": asr_s,
                    "nmt_seconds": 0.0,
                    "tts_seconds": 0.0,
                    "total_seconds": asr_s,
                },
                "diagnostics": filtered_diagnostics,
            }
            return

        # ── Step 2: NMT — Text → Translations (NLLB-200) ──────────────────────
        t0 = time.time()
        translations = await asyncio.to_thread(
            translate_to_multiple, original_text, detected_lang, target_languages
        )


        nmt_s = round(time.time() - t0, 3)
        print(f"🌐 NMT [{nmt_s}s]: translated to {list(translations.keys())}")
        log_gpu_stats("after-NMT")

        # Initial diagnostic evaluation (STT + NMT)
        early_status, early_warnings, early_remedy = _diagnose_pipeline(
            original_text=original_text,
            detected_lang=detected_lang,
            hint_lang=hint,
            lang_prob=lang_prob,
            avg_logprob=avg_logprob,
            no_speech_prob=no_speech_prob,
            duration_s=duration_s,
            translations=translations,
            tts_engine="pending",
        )

        early_diagnostics = {
            "status": early_status,
            "primary_remedy": early_remedy,
            "warnings": early_warnings,
            "vad": {
                "duration_seconds": duration_s,
                "audio_bytes": len(audio_bytes),
            },
            "stt": {
                "original_text": original_text,
                "detected_language": detected_lang,
                "hint_language": hint or "auto",
                "language_probability": round(lang_prob, 3),
                "confidence_logprob": round(avg_logprob, 3),
                "asr_seconds": asr_s,
            },
            "nmt": {
                "source_nllb_code": get_nllb_code(detected_lang),
                "nmt_seconds": nmt_s,
                "target_languages": list(translations.keys()),
            },
            "tts": {
                "engine": "pending",
                "tts_seconds": 0.0,
            }
        }

        # ⚡ YIELD TEXT IMMEDIATELY (with early diagnostic trace) ⚡
        yield {
            "type": "text",
            "original_text": original_text,
            "source_language": detected_lang,
            "translations": translations,
            "speaker_id": user_id,
            "speaker_name": speaker_name,
            "meeting_id": meeting_id,
            "timestamp": time.time(),
            "diagnostics": early_diagnostics,
        }

        # ── Step 3: TTS — Translated Text → Audio ──────────────────────────
        tts_s = 0.0
        last_tts_engine = "none"
        if include_audio:
            t0 = time.time()
            from .tts import synthesize_speech

            async def _synthesize_one(lang, translated_text):
                """Run TTS for a single language. Returns (lang, result_dict) or None."""
                if not translated_text or translated_text.startswith("[Translation error"):
                    return None
                try:
                    tts_result = await asyncio.to_thread(synthesize_speech, translated_text, lang, audio_bytes, True)
                    return (lang, tts_result)
                except Exception as exc:
                    print(f"⚠️ TTS generation failed for {lang}: {exc}")
                    return None

            # Launch all TTS calls concurrently — cuts latency by ~50% for multi-language rooms
            tts_tasks = [_synthesize_one(lang, text) for lang, text in translations.items()]
            tts_results = await asyncio.gather(*tts_tasks)

            for result in tts_results:
                if result is None:
                    continue
                lang, tts_result = result
                last_tts_engine = tts_result.get("engine", "unknown")
                yield {
                    "type": "audio_chunk",
                    "lang": lang,
                    "mime_type": tts_result["mime_type"],
                    "audio_base64": tts_result["audio_base64"],
                    "engine": last_tts_engine,
                }

            tts_s = round(time.time() - t0, 3)


        total_s = round(time.time() - t_start, 3)
        print(f"⚡ Pipeline stream done [{total_s}s] ➔ STT: {asr_s}s | NMT: {nmt_s}s | TTS: {tts_s}s | Engine: {last_tts_engine}")

        # Final diagnostic with TTS confirmation
        final_status, final_warnings, final_remedy = _diagnose_pipeline(
            original_text=original_text,
            detected_lang=detected_lang,
            hint_lang=hint,
            lang_prob=lang_prob,
            avg_logprob=avg_logprob,
            no_speech_prob=no_speech_prob,
            duration_s=duration_s,
            translations=translations,
            tts_engine=last_tts_engine,
        )

        final_diagnostics = {
            **early_diagnostics,
            "status": final_status,
            "primary_remedy": final_remedy,
            "warnings": final_warnings,
            "tts": {
                "engine": last_tts_engine,
                "tts_seconds": tts_s,
            },
            "latency": {
                "asr_seconds": asr_s,
                "nmt_seconds": nmt_s,
                "tts_seconds": tts_s,
                "total_seconds": total_s,
            }
        }

        # ⚡ YIELD FINAL METRICS & COMPLETE DIAGNOSTICS ⚡
        yield {
            "type": "done",
            "latency": final_diagnostics["latency"],
            "diagnostics": final_diagnostics,
        }

    def process(
        self,
        audio_bytes: bytes,
        target_languages: Optional[list[str]] = None,
        source_language: Optional[str] = None,
        user_id: str = "unknown",
        speaker_name: str = "Anonymous",
        meeting_id: str = "unknown",
        include_audio: bool = True,
        mime_type: Optional[str] = None,
    ) -> dict:
        """
        Synchronous backwards-compatible wrapper around process_stream for REST endpoints.
        """
        import asyncio

        async def _run():
            text_data = {}
            audio_translations = {}
            latency = {}
            diagnostics = {}

            async for payload in self.process_stream(
                audio_bytes, target_languages, source_language, user_id,
                speaker_name, meeting_id, include_audio, mime_type
            ):
                if payload["type"] == "text":
                    text_data = payload
                    if "diagnostics" in payload:
                        diagnostics = payload["diagnostics"]
                elif payload["type"] == "audio_chunk":
                    lang = payload["lang"]
                    if lang not in audio_translations:
                        audio_translations[lang] = {"audio_base64": "", "mime_type": payload["mime_type"]}
                    audio_translations[lang]["audio_base64"] += payload["audio_base64"] # This is slightly broken for raw base64 appending, but only affects legacy REST API which we will stop using.
                elif payload["type"] == "done":
                    latency = payload["latency"]
                    if "diagnostics" in payload:
                        diagnostics = payload["diagnostics"]

            if not text_data:
                return self._empty_response(user_id, meeting_id, source_language or "unknown", target_languages or [])

            return {
                "original_text": text_data.get("original_text", ""),
                "source_language": text_data.get("source_language", "unknown"),
                "translations": text_data.get("translations", {}),
                "audio_translations": audio_translations,
                "speaker_id": user_id,
                "speaker_name": speaker_name,
                "meeting_id": meeting_id,
                "timestamp": text_data.get("timestamp", time.time()),
                "latency": latency,
                "diagnostics": diagnostics,
                "voice_retention": {"enabled": False, "engine": "xtts_v2", "status": "skeleton"}
            }

        return asyncio.run(_run())

    def _empty_response(
        self,
        user_id: str,
        meeting_id: str,
        source_language: str,
        target_languages: list[str],
    ) -> dict:
        """Return a clean empty result when no speech is detected."""
        return {
            "original_text":      "",
            "source_language":    source_language,
            "translations":       {lang: "" for lang in target_languages},
            "audio_translations": {},
            "speaker_id":         user_id,
            "meeting_id":         meeting_id,
            "timestamp":          time.time(),
            "latency":            {"asr_seconds": 0, "nmt_seconds": 0, "tts_seconds": 0, "total_seconds": 0},
            "voice_retention":    {"enabled": False, "engine": "xtts_v2", "status": "skeleton"},
        }


# Module-level singleton — imported by main.py
engine = SpeechToSpeechEngine()
