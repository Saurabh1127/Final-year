"""
Text-to-Speech Module — Microsoft Edge Neural Speech (edge-tts)

Fast, studio-grade, natural human neural speech engine with regional accents.
"""

from __future__ import annotations

import io
import os
import base64
import tempfile
import asyncio
import subprocess
from typing import Optional

# edge-tts — Microsoft Edge Neural TTS
try:
    import edge_tts  # type: ignore
    _EDGE_TTS_AVAILABLE = True
except ImportError:
    _EDGE_TTS_AVAILABLE = False

# gTTS fallback
try:
    from gtts import gTTS  # type: ignore
    _GTTS_AVAILABLE = True
except ImportError:
    _GTTS_AVAILABLE = False


# ── Microsoft Edge Neural Voice Map (Regional Human Studio Voices) ───────────
EDGE_VOICE_MAP: dict[str, str] = {
    "en": "en-US-ChristopherNeural", # English (US) — Male
    "hi": "hi-IN-SwaraNeural",       # Hindi (India) — Female
    "fr": "fr-FR-DeniseNeural",      # French — Female
    "es": "es-ES-ElviraNeural",      # Spanish — Female
    "de": "de-DE-KatjaNeural",       # German — Female
    "ja": "ja-JP-NanamiNeural",      # Japanese — Female
    "zh": "zh-CN-XiaoxiaoNeural",    # Chinese — Female
    "ar": "ar-SA-ZariyahNeural",     # Arabic — Female
    "pt": "pt-BR-FranciscaNeural",   # Portuguese — Female
    "ru": "ru-RU-SvetlanaNeural",    # Russian — Female
    "ko": "ko-KR-SunHiNeural",       # Korean — Female
    "it": "it-IT-ElsaNeural",        # Italian — Female
    "ta": "ta-IN-PallaviNeural",     # Tamil — Female
    "te": "te-IN-ShrutiNeural",      # Telugu — Female
    "mr": "mr-IN-AarohiNeural",      # Marathi — Female
    "bn": "bn-IN-TanishaaNeural",    # Bengali — Female
    "ur": "ur-PK-UzmaNeural",        # Urdu — Female
    "gu": "gu-IN-DhwaniNeural",      # Gujarati — Female
    "kn": "kn-IN-SapnaNeural",       # Kannada — Female
    "ml": "ml-IN-SobhanaNeural",     # Malayalam — Female
    "pa": "pa-IN-GurpreetNeural",    # Punjabi — Female
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
}


async def _edge_tts_async(text: str, voice: str) -> bytes:
    """Async helper for edge-tts."""
    communicate = edge_tts.Communicate(text, voice)
    mp3_bytes = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            mp3_bytes += chunk["data"]
    return mp3_bytes


def synthesize_edge_tts(text: str, target_lang: str) -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge-tts not installed.")

    voice = EDGE_VOICE_MAP.get(target_lang, "en-US-ChristopherNeural")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio  # type: ignore
            nest_asyncio.apply()
            return loop.run_until_complete(_edge_tts_async(text, voice))
        else:
            return loop.run_until_complete(_edge_tts_async(text, voice))
    except Exception:
        return asyncio.run(_edge_tts_async(text, voice))


def synthesize_gtts(text: str, target_lang: str) -> bytes:
    """Synthesise speech via Google TTS (gTTS)."""
    if not _GTTS_AVAILABLE:
        raise RuntimeError("gTTS not installed.")
    gtts_lang = GTTS_LANG_MAP.get(target_lang, "en")
    tts = gTTS(text=text, lang=gtts_lang, slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()


def synthesize_speech(
    text: str,
    target_lang: str,
    speaker_audio_bytes: Optional[bytes] = None,
    return_base64: bool = True,
) -> dict:
    """
    Public Speech Synthesis Entry Point.
    Uses Microsoft Edge Neural Speech for studio human voices, with gTTS fallback.
    """
    if _EDGE_TTS_AVAILABLE:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", "edge_neural_tts"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — fallback to gTTS")
            raw = synthesize_gtts(text, target_lang)
            mime, engine_name = "audio/mp3", "gtts_fallback"
    else:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "gtts_fallback"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine_name,
    }
