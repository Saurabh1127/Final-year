"""
Text-to-Speech Module — Multi-Engine Architecture:
  1. Sarvam AI TTS (bulbul:v1) — Sovereign Indian AI for 10 Regional Indian Languages.
  2. Microsoft Edge Neural Speech (edge-tts) — Studio-grade global neural human voices.
  3. Google Text-to-Speech (gTTS) — Universal fallback.
"""

from __future__ import annotations

import io
import os
import json
import base64
import tempfile
import asyncio
import requests
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


# ── Sarvam AI Language Map (bulbul:v1) ──────────────────────────────────────
SARVAM_LANG_MAP: dict[str, str] = {
    "hi": "hi-IN",  # Hindi
    "bn": "bn-IN",  # Bengali
    "kn": "kn-IN",  # Kannada
    "ml": "ml-IN",  # Malayalam
    "mr": "mr-IN",  # Marathi
    "od": "od-IN",  # Odia
    "pa": "pa-IN",  # Punjabi
    "ta": "ta-IN",  # Tamil
    "te": "te-IN",  # Telugu
    "gu": "gu-IN",  # Gujarati
}

# ── Microsoft Edge Neural Voice Map ───────────────────────────────────────────
EDGE_VOICE_MAP_MALE: dict[str, str] = {
    "en": "en-US-ChristopherNeural",
    "hi": "hi-IN-MadhurNeural",
    "fr": "fr-FR-HenriNeural",
    "es": "es-ES-AlvaroNeural",
    "de": "de-DE-ConradNeural",
    "ja": "ja-JP-KeitaNeural",
    "zh": "zh-CN-YunjianNeural",
    "ar": "ar-SA-HamedNeural",
    "pt": "pt-BR-AntonioNeural",
    "ru": "ru-RU-DmitryNeural",
    "ko": "ko-KR-InJoonNeural",
    "it": "it-IT-DiegoNeural",
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
}


def synthesize_sarvam_tts(text: str, target_lang: str, api_key: Optional[str] = None) -> bytes:
    """Synthesise Indian Regional Speech via Sarvam AI API (bulbul:v1 model)."""
    key = api_key or os.getenv("SARVAM_API_KEY")
    if not key:
        raise ValueError("SARVAM_API_KEY environment variable is missing.")

    target_code = SARVAM_LANG_MAP.get(target_lang, "hi-IN")
    headers = {
        "api-subscription-key": key,
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": [text],
        "target_language_code": target_code,
        "speaker": "meera",
        "pitch": 0,
        "pace": 1.05,
        "loudness": 1.5,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
        "model": "bulbul:v1",
    }

    resp = requests.post("https://api.sarvam.ai/text-to-speech", headers=headers, json=payload, timeout=20)
    if resp.status_code != 200:
        raise RuntimeError(f"Sarvam AI TTS Error ({resp.status_code}): {resp.text}")

    audio_base64_list = resp.json().get("audios", [])
    if not audio_base64_list:
        raise RuntimeError("Sarvam AI returned empty audio payload.")

    return base64.b64decode(audio_base64_list[0])


def _run_async(coro):
    """Run async coroutine safely across notebook & server event loops."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio  # type: ignore
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
        else:
            return loop.run_until_complete(coro)
    except Exception:
        return asyncio.run(coro)


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
    voice = EDGE_VOICE_MAP_MALE.get(target_lang, "en-US-ChristopherNeural")
    return _run_async(_edge_tts_async(text, voice))


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
    Returns audio + explicit active engine name metadata.
    """
    sarvam_key = os.getenv("SARVAM_API_KEY")
    use_sarvam = (sarvam_key and sarvam_key.strip() != "" and target_lang in SARVAM_LANG_MAP)

    raw: Optional[bytes] = None
    engine_name = "unknown"
    mime = "audio/mp3"

    # Option 1: Sarvam AI Sovereign Indian TTS
    if use_sarvam and target_lang in SARVAM_LANG_MAP:
        try:
            raw = synthesize_sarvam_tts(text, target_lang, api_key=sarvam_key)
            mime, engine_name = "audio/wav", "🇮🇳 Sarvam AI (bulbul:v1)"
        except Exception as exc:
            print(f"⚠️ Sarvam AI TTS failed for '{target_lang}': {exc} — Fallback to Edge Neural TTS")

    # Option 2: Microsoft Edge Neural Speech
    if raw is None:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", f"🎙️ Microsoft Edge Neural Speech ({EDGE_VOICE_MAP_MALE.get(target_lang, 'default')})"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — Fallback to gTTS")

    # Option 3: Google TTS
    if raw is None:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "🔈 gTTS Fallback"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine_name,
    }
