"""
Text-to-Speech & Zero-Shot Voice Cloning Module

Primary Engine  : Coqui XTTS-v2 — Zero-Shot Voice Cloning on CUDA GPU (enabled via USE_XTTS=true).
Secondary Engine: Microsoft Edge Neural TTS (edge-tts) — Studio-grade human voices (~0.15s).
Fallback Engine : gTTS (Google TTS).
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
    "en": "en-US-AvaNeural",         # English — Ava
    "hi": "hi-IN-SwaraNeural",       # Hindi — Swara
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


def _convert_to_16k_wav(audio_bytes: bytes) -> str:
    """
    Convert raw audio bytes (WebM, OGG, MP3, WAV) into a clean
    16kHz mono WAV file for Coqui XTTS-v2 speaker embedding extraction.
    """
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        in_path = tmp_in.name

    out_path = tempfile.mktemp(suffix=".wav")

    cmd = [
        "ffmpeg", "-y", "-i", in_path,
        "-ar", "16000", "-ac", "1", "-f", "wav", out_path
    ]
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

            # Auto-agree to Coqui CPML non-commercial TOS for non-interactive server loading
            os.environ["COQUI_TOS_AGREED"] = "1"

            # Fix transformers 4.44+ compatibility for Coqui TTS
            if not hasattr(transformers.pytorch_utils, "isin_mps_friendly"):
                transformers.pytorch_utils.isin_mps_friendly = torch.isin

            from TTS.api import TTS  # type: ignore
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"🎙️  Loading Coqui XTTS-v2 Voice Cloning Engine on {device.upper()} ...")
            _xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("✅ Coqui XTTS-v2 ready — Zero-Shot Voice Cloning active!")
        except ImportError:
            print("⚠️  Coqui TTS library not installed. Run: pip install coqui-tts")
        except Exception as exc:
            print(f"⚠️  XTTS-v2 load error: {exc}")
    return _xtts_model




def _xtts_clone_voice(text: str, lang: str, speaker_audio_bytes: Optional[bytes] = None) -> bytes:
    """
    Synthesise translated text in the speaker's cloned voice using Coqui XTTS-v2.
    """
    model = _load_xtts()
    if model is None:
        print("⚠️  XTTS-v2 model unavailable — falling back to edge-tts.")
        return synthesize_edge_tts(text, lang)

    xtts_lang = XTTS_LANG_MAP.get(lang, "en")
    out_wav_path = tempfile.mktemp(suffix=".wav")
    ref_wav_path = None

    try:
        if speaker_audio_bytes and len(speaker_audio_bytes) > 0:
            # Convert user's microphone audio to clean 16kHz WAV
            ref_wav_path = _convert_to_16k_wav(speaker_audio_bytes)
            print(f"🧬 Extracting speaker voice embedding from audio for '{lang}'...")
            model.tts_to_file(
                text=text,
                speaker_wav=ref_wav_path,
                language=xtts_lang,
                file_path=out_wav_path,
            )
        else:
            print(f"🎙️  Synthesising XTTS default voice for '{lang}'...")
            model.tts_to_file(text=text, language=xtts_lang, file_path=out_wav_path)

        with open(out_wav_path, "rb") as f:
            return f.read()

    finally:
        for p in (out_wav_path, ref_wav_path):
            if p:
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


def synthesize_edge_tts(text: str, target_lang: str) -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge-tts not installed. Run: pip install edge-tts")

    voice = EDGE_VOICE_MAP.get(target_lang, "en-US-AvaNeural")

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

    Modes:
      • USE_XTTS=true  ➔ Coqui XTTS-v2 Zero-Shot Voice Cloning (Clones user's voice on GPU)
      • USE_XTTS=false ➔ Microsoft Edge Neural TTS (Studio-grade human voices, ~0.15s)
    """
    use_xtts = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_xtts:
        raw = _xtts_clone_voice(text, target_lang, speaker_audio_bytes)
        mime, engine_name = "audio/wav", "xtts_v2_voice_cloning"
    elif _EDGE_TTS_AVAILABLE:
        try:
            raw = synthesize_edge_tts(text, target_lang)
            mime, engine_name = "audio/mp3", "edge_neural_tts"
        except Exception as exc:
            print(f"⚠️  Edge TTS failed for '{target_lang}': {exc} — fallback to gTTS")
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
