"""
Text-to-Speech Module — Multi-Engine Architecture:
  1. Sarvam AI TTS (bulbul:v2) — Sovereign Indian AI for 10 Regional Indian Languages.
  2. Microsoft Edge Neural Speech (edge-tts) — Studio-grade global neural human voices.
  3. Google Text-to-Speech (gTTS) — Universal fallback.
"""

from __future__ import annotations

import io
import os
import sys
import json
import base64
import tempfile
import asyncio
import requests
import subprocess
from typing import Optional

# edge-tts check
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


# ── Sarvam AI Language Map (bulbul:v2) ──────────────────────────────────────
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
    """Synthesise Indian Regional Speech via Sarvam AI API (bulbul:v2 model)."""
    raw_key = api_key or os.getenv("SARVAM_API_KEY")
    if not raw_key:
        raise ValueError("SARVAM_API_KEY environment variable is missing.")

    key = raw_key.replace("Bearer ", "").strip()
    target_code = SARVAM_LANG_MAP.get(target_lang, "hi-IN")
    
    headers = {
        "api-subscription-key": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": [text],
        "target_language_code": target_code,
        "speaker": "anushka",
        "pitch": 0,
        "pace": 0.95,
        "loudness": 1.5,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
        "model": "bulbul:v2",
    }

    resp = requests.post("https://api.sarvam.ai/text-to-speech", headers=headers, json=payload, timeout=20)
    if resp.status_code != 200:
        raise RuntimeError(f"Sarvam AI API ({resp.status_code}): {resp.text}")

    audio_base64_list = resp.json().get("audios", [])
    if not audio_base64_list:
        raise RuntimeError("Sarvam AI returned empty audio payload.")

    return base64.b64decode(audio_base64_list[0])


def synthesize_edge_tts(text: str, target_lang: str) -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    voice = EDGE_VOICE_MAP_MALE.get(target_lang, "en-US-ChristopherNeural")

    # Method 1: Native Python edge_tts Communicate API
    if _EDGE_TTS_AVAILABLE:
        try:
            async def _async_gen():
                c = edge_tts.Communicate(text, voice)
                buf = io.BytesIO()
                async for chunk in c.stream():
                    if chunk.get("type") == "audio":
                        buf.write(chunk.get("data", b""))
                return buf.getvalue()

            try:
                import nest_asyncio  # type: ignore
                nest_asyncio.apply()
            except Exception:
                pass

            loop = asyncio.new_event_loop()
            try:
                data = loop.run_until_complete(_async_gen())
                if data and len(data) > 100:
                    return data
            finally:
                loop.close()
        except Exception as exc:
            print(f"⚠️ Native edge_tts failed: {exc} — attempting module CLI fallback")

    # Method 2: Python executable module fallback (sys.executable -m edge_tts)
    out_mp3 = tempfile.mktemp(suffix=".mp3")
    cmd = [sys.executable, "-m", "edge_tts", "--voice", voice, "--text", text, "--write-media", out_mp3]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        with open(out_mp3, "rb") as f:
            return f.read()
    finally:
        try: os.unlink(out_mp3)
        except OSError: pass


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
    use_sarvam = (os.getenv("USE_SARVAM", "false").lower() == "true") and bool(sarvam_key and sarvam_key.strip() != "" and target_lang in SARVAM_LANG_MAP)

    raw: Optional[bytes] = None
    engine_name = "unknown"
    mime = "audio/mp3"

    # Option 1: Sarvam AI Sovereign Indian TTS (Only when USE_SARVAM=true)
    if use_sarvam and target_lang in SARVAM_LANG_MAP:
        try:
            raw = synthesize_sarvam_tts(text, target_lang, api_key=sarvam_key)
            mime, engine_name = "audio/wav", "🇮🇳 Sarvam AI (bulbul:v2)"
        except Exception as exc:
            print(f"⚠️ Sarvam AI TTS failed for '{target_lang}': {exc} — Fallback to Edge Neural TTS")

    # Option 2: Microsoft Edge Neural Speech (Default Primary Engine)
    if raw is None:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", f"🎙️ Microsoft Edge Neural Speech ({EDGE_VOICE_MAP_MALE.get(target_lang, 'default')})"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — Fallback to gTTS")

    # Option 3: Google TTS Fallback
    if raw is None:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "gTTS Fallback"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine_name,
    }
