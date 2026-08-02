"""
Text-to-Speech & Hyper-Realistic Voice Retention Module

Architecture:
  1. Primary Zero-Shot Voice Retention: ElevenLabs Multilingual v2 API (Hyper-realistic Voice Cloning).
  2. Fallback 1: Microsoft Edge Neural Speech (edge-tts) — Studio-grade human neural voices.
  3. Fallback 2: Google Text-to-Speech (gTTS).
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

EDGE_VOICE_MAP_FEMALE: dict[str, str] = {
    "en": "en-US-AvaNeural",
    "hi": "hi-IN-SwaraNeural",
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
    "ja": "ja-JP-NanamiNeural",
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
}


def _convert_to_mp3_or_wav(audio_bytes: bytes) -> str:
    """Convert raw audio bytes into 16kHz WAV temp file for API upload."""
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        in_path = tmp_in.name

    out_path = tempfile.mktemp(suffix=".wav")
    cmd = ["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", "-f", "wav", out_path]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        out_path = in_path
    finally:
        try: os.unlink(in_path)
        except OSError: pass

    return out_path


def synthesize_elevenlabs_clone(
    text: str,
    target_lang: str,
    speaker_audio_bytes: bytes,
    api_key: Optional[str] = None
) -> bytes:
    """
    Hyper-Realistic Zero-Shot Voice Retention via ElevenLabs Multilingual v2 API.
    1. Uploads speaker audio sample to clone voice instantly.
    2. Synthesises translated text in speaker's exact cloned voice.
    3. Cleans up cloned voice ID after synthesis.
    """
    key = api_key or os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is missing.")

    headers = {"xi-api-key": key}
    ref_wav_path = _convert_to_mp3_or_wav(speaker_audio_bytes)

    voice_id = None
    try:
        # Step 1: Clone voice instantly via Instant Voice Cloning endpoint
        print("🧬 Creating ElevenLabs Instant Voice Clone profile...")
        with open(ref_wav_path, "rb") as f:
            files = [("files", ("speaker_mic.wav", f, "audio/wav"))]
            data = {
                "name": f"LinguaMeet_Speaker_{int(os.getpid())}",
                "description": "Instant Voice Retention for LinguaMeet Meeting",
            }
            clone_resp = requests.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers=headers,
                data=data,
                files=files,
                timeout=20,
            )

        if clone_resp.status_code not in (200, 201):
            raise RuntimeError(f"ElevenLabs Voice Clone Add Failed ({clone_resp.status_code}): {clone_resp.text}")

        voice_id = clone_resp.json().get("voice_id")
        print(f"✅ ElevenLabs Voice Profile Created: {voice_id}")

        # Step 2: Generate translated speech using ElevenLabs Multilingual v2
        print(f"🎙️ Synthesising '{target_lang}' translated speech in ElevenLabs cloned voice...")
        tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        tts_payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.50,
                "similarity_boost": 0.85,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }
        gen_resp = requests.post(
            tts_url,
            headers={**headers, "Content-Type": "application/json"},
            json=tts_payload,
            timeout=30,
        )

        if gen_resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs TTS Generation Failed ({gen_resp.status_code}): {gen_resp.text}")

        return gen_resp.content

    finally:
        # Cleanup temporary audio file
        try: os.unlink(ref_wav_path)
        except OSError: pass

        # Step 3: Delete temporary voice profile to keep ElevenLabs account clean
        if voice_id:
            try:
                requests.delete(f"https://api.elevenlabs.io/v1/voices/{voice_id}", headers=headers, timeout=10)
                print(f"🗑️ ElevenLabs temporary voice profile {voice_id} deleted cleanly.")
            except Exception:
                pass


async def _edge_tts_async(text: str, voice: str) -> bytes:
    """Async helper for edge-tts."""
    communicate = edge_tts.Communicate(text, voice)
    mp3_bytes = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            mp3_bytes += chunk["data"]
    return mp3_bytes


def synthesize_edge_tts(text: str, target_lang: str, gender: str = "male") -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge-tts not installed.")

    voice_map = EDGE_VOICE_MAP_MALE if gender.lower() == "male" else EDGE_VOICE_MAP_FEMALE
    voice = voice_map.get(target_lang, "en-US-ChristopherNeural")

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
    gender: str = "male",
) -> dict:
    """
    Public Speech Synthesis Entry Point.
    1. Tries ElevenLabs Hyper-Realistic Voice Cloning if ELEVENLABS_API_KEY is present & USE_XTTS=true.
    2. Fallback 1: Microsoft Edge Neural Speech (edge-tts) for studio human voices.
    3. Fallback 2: Google Text-to-Speech (gTTS).
    """
    use_cloning = os.getenv("USE_XTTS", "false").strip().lower() == "true"
    eleven_key = os.getenv("ELEVENLABS_API_KEY")

    raw: Optional[bytes] = None
    engine_name = "unknown"
    mime = "audio/mp3"

    # Option 1: ElevenLabs Hyper-Realistic Voice Cloning
    if use_cloning and eleven_key and speaker_audio_bytes and len(speaker_audio_bytes) > 0:
        try:
            raw = synthesize_elevenlabs_clone(text, target_lang, speaker_audio_bytes, api_key=eleven_key)
            mime, engine_name = "audio/mp3", "elevenlabs_multilingual_v2_voice_clone"
        except Exception as exc:
            print(f"⚠️ ElevenLabs Voice Cloning failed: {exc} — Fallback to Edge Neural TTS")

    # Fallback 1: Microsoft Edge Neural Speech
    if raw is None and _EDGE_TTS_AVAILABLE:
        try:
            raw = synthesize_edge_tts(text, target_lang, gender=gender)
            mime, engine_name = "audio/mp3", "edge_neural_tts"
        except Exception as exc:
            print(f"⚠️ Edge TTS failed for '{target_lang}': {exc} — Fallback to gTTS")

    # Fallback 2: Google TTS
    if raw is None:
        raw = synthesize_gtts(text, target_lang)
        mime, engine_name = "audio/mp3", "gtts_fallback"

    return {
        "audio_base64": base64.b64encode(raw).decode("utf-8") if return_base64 else None,
        "audio_bytes":  raw if not return_base64 else None,
        "mime_type":    mime,
        "engine":       engine_name,
    }
