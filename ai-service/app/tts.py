"""
Text-to-Speech Module

Primary  : Microsoft Edge Neural TTS (edge-tts) — Studio-grade natural human voices.
Secondary: Coqui XTTS-v2 — Zero-shot voice cloning (enabled via USE_XTTS=true).
Fallback : gTTS (Google TTS).
"""

from __future__ import annotations

import io
import os
import base64
import tempfile
import asyncio
from typing import Optional

# edge-tts — Microsoft Edge Neural TTS (Studio-grade human voices)
try:
    import edge_tts  # type: ignore
    _EDGE_TTS_AVAILABLE = True
except ImportError:
    _EDGE_TTS_AVAILABLE = False

# gTTS — fallback engine
try:
    from gtts import gTTS  # type: ignore
    _GTTS_AVAILABLE = True
except ImportError:
    _GTTS_AVAILABLE = False

# XTTS-v2 singleton (GPU voice cloning)
_xtts_model = None

# ── Microsoft Edge Neural Voice Map (ISO 639-1 → Studio Neural Voice) ─────────
EDGE_VOICE_MAP: dict[str, str] = {
    "en": "en-US-AvaNeural",         # English (US) — Ava (Natural Female)
    "hi": "hi-IN-SwaraNeural",       # Hindi — Swara (Natural Female)
    "fr": "fr-FR-DeniseNeural",      # French — Denise
    "es": "es-ES-ElviraNeural",      # Spanish — Elvira
    "de": "de-DE-KatjaNeural",       # German — Katja
    "ja": "ja-JP-NanamiNeural",      # Japanese — Nanami
    "zh": "zh-CN-XiaoxiaoNeural",    # Chinese — Xiaoxiao
    "ar": "ar-SA-ZariyahNeural",     # Arabic — Zariyah
    "pt": "pt-BR-FranciscaNeural",   # Portuguese — Francisca
    "ru": "ru-RU-SvetlanaNeural",    # Russian — Svetlana
    "ko": "ko-KR-SunHiNeural",       # Korean — Sun-Hi
    "it": "it-IT-ElsaNeural",        # Italian — Elsa
    "ta": "ta-IN-PallaviNeural",     # Tamil — Pallavi
    "te": "te-IN-ShrutiNeural",      # Telugu — Shruti
    "mr": "mr-IN-AarohiNeural",      # Marathi — Aarohi
    "bn": "bn-IN-TanishaaNeural",    # Bengali — Tanishaa
    "ur": "ur-PK-UzmaNeural",        # Urdu — Uzma
    "gu": "gu-IN-DhwaniNeural",      # Gujarati — Dhwani
    "kn": "kn-IN-SapnaNeural",       # Kannada — Sapna
    "ml": "ml-IN-SobhanaNeural",     # Malayalam — Sobhana
    "pa": "pa-IN-GurpreetNeural",    # Punjabi — Gurpreet
    "nl": "nl-NL-ColetteNeural",     # Dutch — Colette
    "tr": "tr-TR-EmelNeural",        # Turkish — Emel
    "pl": "pl-PL-ZofiaNeural",       # Polish — Zofia
    "uk": "uk-UA-PolinaNeural",      # Ukrainian — Polina
    "vi": "vie-VN-HoaiMyNeural",     # Vietnamese — HoaiMy
    "sw": "sw-KE-ZuriNeural",        # Swahili — Zuri
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
    "ta": "ta", "te": "te", "bn": "bn", "mr": "mr", "ur": "ur",
    "gu": "gu", "kn": "kn", "ml": "ml", "pa": "pa", "pl": "pl",
    "uk": "uk", "sw": "sw",
}

XTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "pl": "pl",
    "cs": "cs", "hu": "hu",
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
    """
    Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS.
    Returns raw MP3 audio bytes.
    """
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge-tts not installed. Run: pip install edge-tts")

    voice = EDGE_VOICE_MAP.get(target_lang, "en-US-AvaNeural")

    try:
        # Handle running inside an existing event loop or standard sync context
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If called inside an active async event loop (like FastAPI)
            import nest_asyncio  # type: ignore
            nest_asyncio.apply()
            return loop.run_until_complete(_edge_tts_async(text, voice))
        else:
            return loop.run_until_complete(_edge_tts_async(text, voice))
    except Exception:
        # Fallback to creating a fresh runner loop
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


def _load_xtts():
    """Lazy-load Coqui XTTS-v2 model (GPU-only)."""
    global _xtts_model
    if _xtts_model is None:
        try:
            from TTS.api import TTS  # type: ignore
            import torch              # type: ignore
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"🎙️ Loading XTTS-v2 on {device.upper()} ...")
            _xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("✅ XTTS-v2 ready — voice cloning active.")
        except ImportError:
            print("⚠️ Coqui TTS not installed.")
        except Exception as exc:
            print(f"⚠️ XTTS-v2 load error: {exc}")
    return _xtts_model


def _xtts(text: str, lang: str, speaker_audio: Optional[bytes] = None) -> bytes:
    """Synthesise speech via XTTS-v2 zero-shot voice cloning."""
    model = _load_xtts()
    if model is None:
        return synthesize_edge_tts(text, lang)

    xtts_lang = XTTS_LANG_MAP.get(lang, "en")
    out_path = tempfile.mktemp(suffix=".wav")

    try:
        if speaker_audio:
            ref_path = tempfile.mktemp(suffix=".wav")
            with open(ref_path, "wb") as f:
                f.write(speaker_audio)
            try:
                model.tts_to_file(text=text, speaker_wav=ref_path, language=xtts_lang, file_path=out_path)
            finally:
                try: os.unlink(ref_path)
                except OSError: pass
        else:
            model.tts_to_file(text=text, language=xtts_lang, file_path=out_path)

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        try: os.unlink(out_path)
        except OSError: pass


def synthesize_speech(
    text: str,
    target_lang: str,
    speaker_audio_bytes: Optional[bytes] = None,
    return_base64: bool = True,
) -> dict:
    """
    Public TTS entry point.
    Engine Priority:
      1. XTTS-v2 (if USE_XTTS=true)
      2. Microsoft Edge Neural TTS (edge-tts) — Studio-grade human voices
      3. gTTS fallback
    """
    use_xtts = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_xtts:
        raw = _xtts(text, target_lang, speaker_audio_bytes)
        mime, engine_name = "audio/wav", "xtts"
    elif _EDGE_TTS_AVAILABLE:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", "edge-tts"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — falling back to gTTS")
            raw = synthesize_gtts(text, target_lang)
            mime, engine_name = "audio/mp3", "gtts"
    else:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "gtts"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes": raw if not return_base64 else None,
        "mime_type": mime,
        "engine": engine_name,
    }
