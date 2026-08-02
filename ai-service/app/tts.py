"""
Text-to-Speech Module

Primary  : gTTS (Google TTS) — lightweight cloud API, zero GPU load, 100+ languages.
Secondary: Coqui XTTS-v2     — zero-shot voice cloning (Phase 2, GPU required).
           Controlled via env var USE_XTTS=true in .env
"""

from __future__ import annotations

import io
import os
import base64
import tempfile
from typing import Optional

# gTTS — installed on Colab via requirements.txt
try:
    from gtts import gTTS  # type: ignore
    _GTTS_AVAILABLE = True
except ImportError:
    _GTTS_AVAILABLE = False

# XTTS-v2 singleton (GPU-only, Phase 2)
_xtts_model = None

# gTTS language code map (ISO 639-1 → gTTS lang tag)
GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
    "ta": "ta", "te": "te", "bn": "bn", "mr": "mr", "ur": "ur",
    "gu": "gu", "kn": "kn", "ml": "ml", "pa": "pa", "pl": "pl",
    "uk": "uk", "sw": "sw",
}

# XTTS-v2 supported language codes
XTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "pl": "pl",
    "cs": "cs", "hu": "hu",
}


def _load_xtts():
    """Lazy-load Coqui XTTS-v2 model (GPU-only). Returns None if unavailable."""
    global _xtts_model
    if _xtts_model is None:
        try:
            from TTS.api import TTS  # type: ignore
            import torch              # type: ignore
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"🎙️  Loading XTTS-v2 on {device.upper()} ...")
            _xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("✅ XTTS-v2 ready — voice cloning active.")
        except ImportError:
            print("⚠️  Coqui TTS not installed. Install: pip install TTS>=0.22.0")
        except Exception as exc:
            print(f"⚠️  XTTS-v2 load error: {exc} — falling back to gTTS.")
    return _xtts_model


def _gtts(text: str, lang: str) -> bytes:
    """Synthesise speech via gTTS. Returns raw MP3 bytes."""
    if not _GTTS_AVAILABLE:
        raise RuntimeError("gTTS is not installed. Run: pip install gTTS==2.5.1")
    gtts_lang = GTTS_LANG_MAP.get(lang, "en")
    tts = gTTS(text=text, lang=gtts_lang, slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()


def _xtts(text: str, lang: str, speaker_audio: Optional[bytes] = None) -> bytes:
    """
    [SKELETON] Synthesise speech via XTTS-v2 with zero-shot voice cloning.
    Full implementation follows after Colab STT/gTTS verification (Phase 2).
    """
    model = _load_xtts()
    if model is None:
        return _gtts(text, lang)  # Graceful fallback

    xtts_lang = XTTS_LANG_MAP.get(lang, "en")
    out_path = tempfile.mktemp(suffix=".wav")

    try:
        if speaker_audio:
            ref_path = tempfile.mktemp(suffix=".wav")
            with open(ref_path, "wb") as f:
                f.write(speaker_audio)
            try:
                model.tts_to_file(
                    text=text,
                    speaker_wav=ref_path,
                    language=xtts_lang,
                    file_path=out_path,
                )
            finally:
                try:
                    os.unlink(ref_path)
                except OSError:
                    pass
        else:
            model.tts_to_file(text=text, language=xtts_lang, file_path=out_path)

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass


def synthesize_speech(
    text: str,
    target_lang: str,
    speaker_audio_bytes: Optional[bytes] = None,
    return_base64: bool = True,
) -> dict:
    """
    Public TTS entry point. Selects engine from USE_XTTS env var.

    Args:
        text:                Translated text to synthesise.
        target_lang:         ISO 639-1 target language code.
        speaker_audio_bytes: Optional reference audio for voice cloning (XTTS only).
        return_base64:       If True, audio encoded as base64 string for JSON transport.

    Returns:
        {
            "audio_base64": str | None,
            "audio_bytes":  bytes | None,
            "mime_type":    "audio/mp3" | "audio/wav",
            "engine":       "gtts" | "xtts",
        }
    """
    use_xtts = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_xtts:
        raw = _xtts(text, target_lang, speaker_audio_bytes)
        mime, engine = "audio/wav", "xtts"
    else:
        raw = _gtts(text, target_lang)
        mime, engine = "audio/mp3", "gtts"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine,
    }
