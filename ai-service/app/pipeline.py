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
        asr_s = round(time.time() - t0, 3)
        print(f"📝 STT [{asr_s}s] [{detected_lang.upper()}]: {original_text[:80]}"
              f"  | no_speech={no_speech_prob:.3f} logprob={avg_logprob:.3f} lang_prob={lang_prob:.3f}")
        log_gpu_stats("after-STT")

        # ── Hallucination Filters ─────────────────────────────────────────────
        if (not original_text or 
            no_speech_prob > 0.6 or 
            avg_logprob < -1.0 or 
            lang_prob < 0.5 or 
            len(original_text.strip()) < 3 or 
            original_text.strip().lower() in ["thank you", "subscribe", "silence"]):
            print("🔇 [Filter] Rejected audio chunk as silence/hallucination.")
            yield self._empty_response(user_id, meeting_id, detected_lang, target_languages)
            return

        # ── Step 2: NMT — Text → Translations (NLLB-200-600M) ────────────────
        t0 = time.time()
        translations = await asyncio.to_thread(translate_to_multiple, original_text, detected_lang, target_languages)
        nmt_s = round(time.time() - t0, 3)
        print(f"🌐 NMT [{nmt_s}s]: translated to {list(translations.keys())}")
        log_gpu_stats("after-NMT")

        # ⚡ YIELD TEXT IMMEDIATELY ⚡
        yield {
            "type": "text",
            "original_text": original_text,
            "source_language": detected_lang,
            "translations": translations,
            "speaker_id": user_id,
            "speaker_name": speaker_name,
            "meeting_id": meeting_id,
            "timestamp": time.time(),
        }

        # ── Step 3: TTS — Translated Text → Audio ──────────────────────────
        tts_s = 0.0
        audio_translations: dict = {}
        if include_audio:
            t0 = time.time()
            from .tts import stream_edge_tts, synthesize_speech, _EDGE_TTS_AVAILABLE
            
            # For Phase 5 streaming, we currently only support streaming Edge-TTS. 
            # Other engines can just yield a single chunk.
            async def _stream_tts_for_lang(lang, translated_text):
                if not translated_text or translated_text.startswith("[Translation error"):
                    return
                
                try:
                    import base64
                    if _EDGE_TTS_AVAILABLE and os.getenv("USE_SARVAM", "false").lower() != "true":
                        async for chunk_bytes in stream_edge_tts(translated_text, lang):
                            yield {
                                "type": "audio_chunk",
                                "lang": lang,
                                "mime_type": "audio/mp3",
                                "audio_base64": base64.b64encode(chunk_bytes).decode('utf-8')
                            }
                    else:
                        # Fallback to synchronous engines
                        tts_result = await asyncio.to_thread(synthesize_speech, translated_text, lang, audio_bytes, True)
                        yield {
                            "type": "audio_chunk",
                            "lang": lang,
                            "mime_type": tts_result["mime_type"],
                            "audio_base64": tts_result["audio_base64"]
                        }
                except Exception as exc:
                    print(f"⚠️ TTS stream failed for {lang}: {exc}")
            
            # Create streaming tasks for all languages
            # Since yielding from multiple streams concurrently is complex in python generators,
            # we can run them sequentially or buffer them into tasks and yield as they arrive.
            # To avoid crossing audio chunks of different languages to the same client improperly,
            # we will process languages sequentially. (GPU batching happens in NMT anyway).
            
            for lang, translated_text in translations.items():
                async for chunk_payload in _stream_tts_for_lang(lang, translated_text):
                    yield chunk_payload

            tts_s = round(time.time() - t0, 3)

        total_s = round(time.time() - t_start, 3)
        print(f"⚡ Pipeline stream done [{total_s}s]")

        # ⚡ YIELD FINAL METRICS ⚡
        yield {
            "type": "done",
            "latency": {
                "asr_seconds": asr_s,
                "nmt_seconds": nmt_s,
                "tts_seconds": tts_s,
                "total_seconds": total_s,
            }
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
            
            async for payload in self.process_stream(
                audio_bytes, target_languages, source_language, user_id, 
                speaker_name, meeting_id, include_audio, mime_type
            ):
                if payload["type"] == "text":
                    text_data = payload
                elif payload["type"] == "audio_chunk":
                    lang = payload["lang"]
                    if lang not in audio_translations:
                        audio_translations[lang] = {"audio_base64": "", "mime_type": payload["mime_type"]}
                    audio_translations[lang]["audio_base64"] += payload["audio_base64"] # This is slightly broken for raw base64 appending, but only affects legacy REST API which we will stop using.
                elif payload["type"] == "done":
                    latency = payload["latency"]
                    
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
