"""
Text-to-Speech & Pure Zero-Shot Voice Cloning Module

Primary Voice Cloning Engine: Coqui XTTS-v2 (Pure Neural Voice Cloning on GPU)
  • Extracts 512-dim speaker embeddings from clean audio.
  • Synthesises speech directly in speaker's exact voice.

Primary Fast TTS Engine: Microsoft Edge Neural Speech (edge-tts).
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

# XTTS-v2 singleton
_xtts_model = None

# ── Microsoft Edge Neural Voice Map ───────────────────────────────────────────
EDGE_VOICE_MAP_MALE: dict[str, str] = {
    "en": "en-US-ChristopherNeural",
    "hi": "hi-IN-MadhurNeural",
    "fr": "fr-FR-HenriNeural",
    "es": "es-ES-AlvaroNeural",
    "de": "de-DE-ConradNeural",
    "ja": "ja-JP-KeitaNeural",
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
}

XTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "pl": "pl",
}


def _convert_to_16k_wav(audio_bytes: bytes) -> str:
    """Convert raw audio bytes into 16kHz mono WAV temp file."""
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


def _load_xtts():
    """Lazy-load Coqui XTTS-v2 model on GPU (singleton)."""
    global _xtts_model
    if _xtts_model is None:
        try:
            import torch  # type: ignore
            import transformers.pytorch_utils  # type: ignore

            os.environ["COQUI_TOS_AGREED"] = "1"
            if not hasattr(transformers.pytorch_utils, "isin_mps_friendly"):
                transformers.pytorch_utils.isin_mps_friendly = torch.isin

            from TTS.api import TTS  # type: ignore
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"🎙️ Loading Coqui XTTS-v2 Pure Neural Voice Cloning Engine on {device.upper()} ...")
            _xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("✅ Coqui XTTS-v2 ready — Pure Voice Cloning active!")
        except Exception as exc:
            print(f"⚠️ XTTS-v2 load error: {exc}")
    return _xtts_model


def synthesize_xtts_pure_clone(text: str, target_lang: str, speaker_audio_bytes: bytes) -> bytes:
    """
    Pure Zero-Shot Voice Cloning using Coqui XTTS-v2.
    Takes cleaned speaker audio and synthesises speech directly in speaker's exact voice!
    """
    model = _load_xtts()
    if model is None:
        return synthesize_edge_tts(text, target_lang)

    xtts_lang = XTTS_LANG_MAP.get(target_lang, "en")
    ref_wav_path = _convert_to_16k_wav(speaker_audio_bytes)
    out_wav_path = tempfile.mktemp(suffix=".wav")

    try:
        print(f"🧬 Synthesising pure neural voice clone for '{target_lang}'...")
        model.tts_to_file(
            text=text,
            speaker_wav=ref_wav_path,
            language=xtts_lang,
            file_path=out_wav_path,
            gpt_cond_len=6,     # Optimum conditioning length for high voice similarity
            temperature=0.75,   # Natural pitch variation without hallucinations
        )
        with open(out_wav_path, "rb") as f:
            return f.read()
    finally:
        for p in (ref_wav_path, out_wav_path):
            try: os.unlink(p)
            except OSError: pass


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

    voice = EDGE_VOICE_MAP_MALE.get(target_lang, "en-US-ChristopherNeural")

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
    When USE_XTTS=true, performs PURE ZERO-SHOT VOICE CLONING via Coqui XTTS-v2!
    """
    use_cloning = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_cloning and speaker_audio_bytes and len(speaker_audio_bytes) > 0:
        raw = synthesize_xtts_pure_clone(text, target_lang, speaker_audio_bytes)
        mime, engine_name = "audio/wav", "coqui_xtts_v2_pure_voice_clone"
    elif _EDGE_TTS_AVAILABLE:
        try:
            raw = synthesize_edge_tts(text, target_lang, gender=gender)
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
