"""
Text-to-Speech Module — Multi-Engine Architecture:
  1. Sarvam AI TTS (bulbul:v3) — Sovereign Indian AI for 10 Regional Indian Languages.
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

# Kokoro TTS (local, instant fallback)
try:
    from kokoro import KPipeline  # type: ignore
    import soundfile as sf  # type: ignore
    import numpy as np # type: ignore
    _KOKORO_AVAILABLE = True
except ImportError:
    _KOKORO_AVAILABLE = False

# gTTS fallback
try:
    from gtts import gTTS  # type: ignore
    _GTTS_AVAILABLE = True
except ImportError:
    _GTTS_AVAILABLE = False


# ── Sarvam AI Language Map (bulbul:v3) ──────────────────────────────────────
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
    # ── Tier 1 (Fully tested) ──
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
    
    # ── Tier 2 (Indian Regional) ──
    "ta": "ta-IN-ValluvarNeural",
    "te": "te-IN-MohanNeural",
    "mr": "mr-IN-ManoharNeural",
    "bn": "bn-IN-BashkarNeural",
    "ur": "ur-IN-SalmanNeural",
    "gu": "gu-IN-NiranjanNeural",
    "kn": "kn-IN-GaganNeural",
    "ml": "ml-IN-MidhunNeural",
    "pa": "pa-IN-OjasNeural",
    
    # ── Tier 3 (International) ──
    "nl": "nl-NL-MaartenNeural",
    "tr": "tr-TR-AhmetNeural",
    "pl": "pl-PL-MarekNeural",
    "uk": "uk-UA-OstapNeural",
    "vi": "vi-VN-NamMinhNeural",
    "sw": "sw-KE-RafikiNeural",
    "th": "th-TH-NiwatNeural",
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
    "ta": "ta", "te": "te", "mr": "mr", "bn": "bn", "ur": "ur",
    "gu": "gu", "kn": "kn", "ml": "ml", "pl": "pl", "uk": "uk",
    "sw": "sw", "th": "th",
}

# ── Kokoro-82M Local Voice Map ──────────────────────────────────────────────
KOKORO_LANG_MAP: dict[str, str] = {
    "en": "a", "hi": "h", "es": "e", "fr": "f", 
    "it": "i", "pt": "p", "ja": "j", "zh": "z"
}

KOKORO_VOICE_MAP: dict[str, str] = {
    "en": "am_michael", "hi": "hm_omega", "es": "em_alex", "fr": "fm_matthew", 
    "it": "im_nicola", "pt": "pm_alex", "ja": "jm_kento", "zh": "zm_yunjian"
}

_kokoro_pipelines = {}

def get_kokoro_pipeline(lang: str):
    global _kokoro_pipelines
    if lang not in _kokoro_pipelines:
        if not _KOKORO_AVAILABLE:
            raise RuntimeError("Kokoro not installed.")
        print(f"🌐 Loading Kokoro TTS pipeline for lang '{lang}'...")
        _kokoro_pipelines[lang] = KPipeline(lang_code=lang)
    return _kokoro_pipelines[lang]


def synthesize_sarvam_tts(text: str, target_lang: str, api_key: Optional[str] = None) -> bytes:
    """Synthesise Indian Regional Speech via Sarvam AI API (bulbul:v3 model)."""
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
        "text": text,
        "language_code": target_code,
        "model": "bulbul:v3",
        "speaker": os.getenv("SARVAM_SPEAKER", "shubh"),
        "pace": float(os.getenv("SARVAM_PACE", "1.0")),
        "temperature": 0.6,
        "speech_sample_rate": 24000,
        "output_audio_codec": "wav",
    }

    resp = requests.post("https://api.sarvam.ai/text-to-speech", headers=headers, json=payload, timeout=20)
    if resp.status_code != 200:
        raise RuntimeError(f"Sarvam AI API ({resp.status_code}): {resp.text}")

    data = resp.json()
    audio_b64 = (
        data.get("audio_content")
        or data.get("audio_data")
        or (data.get("audios") and data["audios"][0])
        or data.get("audio")
    )
    if not audio_b64:
        raise RuntimeError(f"Sarvam AI returned empty audio payload. Response keys: {list(data.keys())}")

    return base64.b64decode(audio_b64)


async def stream_edge_tts(text: str, target_lang: str):
    """
    Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS.
    Yields audio chunks directly as they are streamed.
    """
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge_tts not installed.")
        
    voice = EDGE_VOICE_MAP_MALE.get(target_lang, "en-US-ChristopherNeural")
    
    try:
        communicate = edge_tts.Communicate(text, voice)
        buffer = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buffer += chunk["data"]
                # Buffer 48KB of audio (approx 1 second) before yielding to prevent 
                # micro-stuttering in HTML5 Audio Blob queues on the client browser.
                if len(buffer) >= 48 * 1024:
                    yield buffer
                    buffer = b""
        
        # Flush the remaining buffer
        if buffer:
            yield buffer
            
    except Exception as e:
        print(f"⚠️ edge_tts stream error for {target_lang}: {e}")
        raise


def synthesize_edge_tts(text: str, target_lang: str) -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    voice = EDGE_VOICE_MAP_MALE.get(target_lang, "en-US-ChristopherNeural")

    import asyncio
    
    # We use a new event loop in a background thread because we might already be running
    # in an asyncio executor thread pool, and edge_tts requires a running loop.
    def _run_edge_tts():
        async def _async_synthesize():
            try:
                # Add strict timeout to communicate
                communicate = edge_tts.Communicate(text, voice)
                audio_data = b""
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_data += chunk["data"]
                return audio_data
            except Exception as e:
                print(f"⚠️ edge_tts error for {target_lang}: {e}")
                raise

        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(asyncio.wait_for(_async_synthesize(), timeout=15.0))
        except asyncio.TimeoutError:
            print(f"⚠️ edge_tts timed out after 15 seconds for {target_lang}")
            raise RuntimeError("TTS generation timed out")
        finally:
            loop.close()

    # If we are in the main thread with a running loop, run in executor.
    # Otherwise (we're already in a worker thread), just run it.
    try:
        asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(_run_edge_tts).result()
    except RuntimeError:
        return _run_edge_tts()


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


def synthesize_kokoro_tts(text: str, target_lang: str) -> bytes:
    """Synthesise speech via local Kokoro-82M model."""
    if not _KOKORO_AVAILABLE:
        raise RuntimeError("Kokoro not installed.")
        
    k_lang = KOKORO_LANG_MAP.get(target_lang, "a")
    voice = KOKORO_VOICE_MAP.get(target_lang, "am_michael")
    
    pipeline = get_kokoro_pipeline(k_lang)
    generator = pipeline(text, voice=voice, speed=1.0, split_pattern=r'\n+')
    
    # Generate all chunks and concatenate
    all_audio = []
    sample_rate = 24000
    for i, (gs, ps, audio) in enumerate(generator):
        all_audio.append(audio)
        
    if not all_audio:
        raise RuntimeError("Kokoro generated empty audio.")
        
    full_audio = np.concatenate(all_audio)
    
    buf = io.BytesIO()
    sf.write(buf, full_audio, sample_rate, format='WAV')
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
            mime, engine_name = "audio/wav", "🇮🇳 Sarvam AI (bulbul:v3)"
        except Exception as exc:
            print(f"⚠️ Sarvam AI TTS failed for '{target_lang}': {exc} — Fallback to Edge Neural TTS")

    # Option 2: Microsoft Edge Neural Speech (Default Primary Engine)
    if raw is None:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", f"🎙️ Microsoft Edge Neural Speech ({EDGE_VOICE_MAP_MALE.get(target_lang, 'default')})"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — Fallback to Kokoro")

    # Option 3: Kokoro-82M Local Fallback
    if raw is None and os.getenv("USE_KOKORO", "true").lower() == "true" and target_lang in KOKORO_LANG_MAP:
        try:
            raw = synthesize_kokoro_tts(text, target_lang)
            mime, engine_name = "audio/wav", f"🤖 Kokoro-82M Local ({KOKORO_VOICE_MAP.get(target_lang)})"
        except Exception as exc:
            print(f"⚠️ Kokoro TTS failed for '{target_lang}': {exc} — Fallback to gTTS")

    # Option 4: Google TTS Fallback
    if raw is None:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "gTTS Fallback"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine_name,
    }
