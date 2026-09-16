"""
Unified Speech-to-Speech Pipeline Engine
Combines: Whisper (ASR) → NLLB-200 (NMT) → Edge TTS (TTS)

Single public entry point:
    from app.pipeline import engine
    result = engine.process(audio_bytes, target_languages=["hi", "fr"])
"""

from __future__ import annotations

import os
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
from .translator import translate_to_multiple
from .tts import synthesize_speech
from .voice_retention import voice_engine


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
        Run the full S2ST pipeline on raw audio bytes.

        Args:
            audio_bytes:      Raw audio (WAV / WebM / MP3 / OGG).
            target_languages: List of ISO 639-1 target language codes.
                              Defaults to ["en"].
            source_language:  Optional source language hint for Whisper.
                              None or "auto" = Whisper auto-detects.
            user_id:          Speaker/user identifier (metadata).
            meeting_id:       Meeting session identifier (metadata).
            include_audio:    If True, synthesise TTS audio for each translation.

        Returns:
            dict with keys:
                original_text, source_language, translations,
                audio_translations, speaker_id, meeting_id,
                timestamp, latency, voice_retention
        """
        if not target_languages:
            target_languages = ["en"]

        t_start = time.time()

        # ── Step 1: ASR — Audio → Text (Whisper-small) ────────────────────────
        t0 = time.time()
        hint = source_language if source_language and source_language not in ("", "auto") else None
        transcription = transcribe_audio(audio_bytes, source_language=hint, mime_type=mime_type)
        detected_lang: str = transcription["language"]
        original_text: str = transcription["text"]
        no_speech_prob: float = transcription.get("no_speech_prob", 0.0)
        avg_logprob: float = transcription.get("avg_logprob", 0.0)
        lang_prob: float = transcription.get("language_probability", 1.0)
        asr_s = round(time.time() - t0, 3)
        print(f"📝 STT [{asr_s}s] [{detected_lang.upper()}]: {original_text[:80]}"
              f"  | no_speech={no_speech_prob:.3f} logprob={avg_logprob:.3f} lang_prob={lang_prob:.3f}")
        log_gpu_stats("after-STT")

        # ── Hallucination Filters ─────────────────────────────────────────────
        # Filter 1: Return early if nothing was transcribed
        if not original_text:
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # Filter 2: High no-speech probability → likely silence/noise
        if no_speech_prob > 0.6:
            print(f"🔇 [Filter] Rejected: no_speech_prob={no_speech_prob:.3f} > 0.6")
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # Filter 3: Low average log-probability → garbage/hallucination
        if avg_logprob < -1.0:
            print(f"🔇 [Filter] Rejected: avg_logprob={avg_logprob:.3f} < -1.0")
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # Filter 4: Uncertain language detection
        if lang_prob < 0.5:
            print(f"🔇 [Filter] Rejected: language_probability={lang_prob:.3f} < 0.5")
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # Filter 5: Text too short to be meaningful
        if len(original_text.strip()) < 3:
            print(f"🔇 [Filter] Rejected: text too short ({len(original_text.strip())} chars)")
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # Filter 6: Common Whisper hallucination patterns
        hallucination_patterns = [
            "thank you", "thanks for watching", "subscribe",
            "like and subscribe", "please subscribe", "see you next time",
            "bye bye", "you", "the end", "music",
            "applause", "laughter", "silence",
        ]
        text_lower = original_text.strip().lower()
        if text_lower in hallucination_patterns:
            print(f"🔇 [Filter] Rejected: hallucination pattern match '{text_lower}'")
            return self._empty_response(user_id, meeting_id, detected_lang, target_languages)

        # ── Step 2: NMT — Text → Translations (NLLB-200-600M) ────────────────
        t0 = time.time()
        translations = translate_to_multiple(original_text, detected_lang, target_languages)
        nmt_s = round(time.time() - t0, 3)
        print(f"🌐 NMT [{nmt_s}s]: translated to {list(translations.keys())}")
        log_gpu_stats("after-NMT")

        # ── Step 3: TTS — Translated Text → Audio (gTTS / XTTS-v2) ──────────
        audio_translations: dict = {}
        tts_s = 0.0

        if include_audio:
            t0 = time.time()
            import concurrent.futures
            
            def _synthesize(lang_and_text: tuple[str, str]) -> tuple[str, Optional[dict]]:
                lang, translated_text = lang_and_text
                if not translated_text or translated_text.startswith("[Translation error"):
                    return lang, None
                try:
                    tts_result = synthesize_speech(
                        text=translated_text,
                        target_lang=lang,
                        speaker_audio_bytes=audio_bytes,
                        return_base64=True,
                    )
                    return lang, {
                        "audio_base64": tts_result["audio_base64"],
                        "mime_type":    tts_result["mime_type"],
                        "engine":       tts_result["engine"],
                    }
                except Exception as exc:
                    print(f"⚠️  TTS failed for '{lang}': {exc}")
                    return lang, None

            with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(translations), 8)) as executor:
                for lang, res in executor.map(_synthesize, translations.items()):
                    if res:
                        audio_translations[lang] = res
                        
            tts_s = round(time.time() - t0, 3)
            print(f"🔈 TTS [{tts_s}s]: synthesised for {list(audio_translations.keys())}")

        total_s = round(time.time() - t_start, 3)
        print(f"⚡ Pipeline done [{total_s}s] | STT:{asr_s}s NMT:{nmt_s}s TTS:{tts_s}s")
        log_gpu_stats("pipeline-done")

        return {
            "original_text":     original_text,
            "source_language":   detected_lang,
            "translations":      translations,
            "audio_translations": audio_translations,
            "speaker_id":        user_id,
            "speaker_name":      speaker_name,
            "meeting_id":        meeting_id,
            "timestamp":         time.time(),
            "latency": {
                "asr_seconds":   asr_s,
                "nmt_seconds":   nmt_s,
                "tts_seconds":   tts_s,
                "total_seconds": total_s,
            },
            "voice_retention": {
                "enabled": False,
                "engine":  "xtts_v2",
                "status":  "skeleton — activate after Colab STT/TTS verification",
            },
        }

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
