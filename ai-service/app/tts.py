"""
Text-to-Speech & OpenVoice v2 Zero-Shot Voice Retention Module

Engine Architecture:
  1. Base Speech Generation: Microsoft Edge Neural TTS (Male & Female Studio Voices).
  2. Tone Color Transfer: OpenVoice v2 (MyShell AI) — Transfers speaker's voice timbre onto base speech.
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

# ── Microsoft Edge Neural Voice Map (Female & Male Studio Voices) ─────────────
EDGE_VOICE_MAP_FEMALE: dict[str, str] = {
    "en": "en-US-AvaNeural",         # English — Ava (Female)
    "hi": "hi-IN-SwaraNeural",       # Hindi — Swara (Female)
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
}

EDGE_VOICE_MAP_MALE: dict[str, str] = {
    "en": "en-US-ChristopherNeural", # English — Christopher (Deep Natural Male)
    "hi": "hi-IN-MadhurNeural",      # Hindi — Madhur (Natural Male)
    "fr": "fr-FR-HenriNeural",       # French — Henri (Male)
    "es": "es-ES-AlvaroNeural",      # Spanish — Alvaro (Male)
    "de": "de-DE-ConradNeural",      # German — Conrad (Male)
    "ja": "ja-JP-KeitaNeural",       # Japanese — Keita (Male)
    "zh": "zh-CN-YunjianNeural",     # Chinese — Yunjian (Male)
    "ar": "ar-SA-HamedNeural",       # Arabic — Hamed (Male)
    "pt": "pt-BR-AntonioNeural",     # Portuguese — Antonio (Male)
    "ru": "ru-RU-DmitryNeural",      # Russian — Dmitry (Male)
    "ko": "ko-KR-InJoonNeural",      # Korean — InJoon (Male)
    "it": "it-IT-DiegoNeural",       # Italian — Diego (Male)
}

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en", "hi": "hi", "fr": "fr", "es": "es", "de": "de",
    "ja": "ja", "zh": "zh", "ar": "ar", "pt": "pt", "ru": "ru",
    "ko": "ko", "it": "it", "nl": "nl", "tr": "tr", "vi": "vi",
    "ta": "ta", "te": "te", "bn": "bn", "mr": "mr", "ur": "ur",
    "gu": "gu", "kn": "kn", "ml": "ml", "pa": "pa", "pl": "pl",
    "uk": "uk", "sw": "sw",
}


def _convert_to_wav(audio_bytes: bytes, target_sr: int = 16000) -> str:
    """Convert raw audio bytes to WAV temp file."""
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        in_path = tmp_in.name

    out_path = tempfile.mktemp(suffix=".wav")
    cmd = ["ffmpeg", "-y", "-i", in_path, "-ar", str(target_sr), "-ac", "1", "-f", "wav", out_path]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        out_path = in_path
    finally:
        try: os.unlink(in_path)
        except OSError: pass

    return out_path


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
    fallback_default = "en-US-ChristopherNeural" if gender.lower() == "male" else "en-US-AvaNeural"
    voice = voice_map.get(target_lang, fallback_default)

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


def synthesize_openvoice(
    text: str,
    target_lang: str,
    speaker_audio_bytes: bytes,
    gender: str = "male"
) -> bytes:
    """
    OpenVoice v2 Tone Color Transfer.
    Generates studio male/female base speech, then converts tone color to match user's voice timbre!
    """
    # 1. Base studio speech matching speaker gender
    base_mp3 = synthesize_edge_tts(text, target_lang, gender=gender)
    base_wav_path = _convert_to_wav(base_mp3, target_sr=24000)
    ref_wav_path = _convert_to_wav(speaker_audio_bytes, target_sr=24000)
    output_wav_path = tempfile.mktemp(suffix=".wav")

    try:
        from openvoice import se_extractor  # type: ignore
        from openvoice.api import ToneColorConverter  # type: ignore
        import torch  # type: ignore

        device = "cuda" if torch.cuda.is_available() else "cpu"
        ckpt_path = os.getenv("OPENVOICE_CKPT", "/content/checkpoints_v2/converter")

        if os.path.exists(ckpt_path):
            converter = ToneColorConverter(f"{ckpt_path}/config.json", device=device)
            converter.load_ckpt(f"{ckpt_path}/checkpoint.pth")

            target_se, _ = se_extractor.get_se(ref_wav_path, converter, target_dir="/tmp/se", vad=True)
            source_se, _ = se_extractor.get_se(base_wav_path, converter, target_dir="/tmp/se", vad=True)

            converter.convert(
                audio_src_path=base_wav_path,
                src_se=source_se,
                tgt_se=target_se,
                output_path=output_wav_path,
            )
            with open(output_wav_path, "rb") as f:
                return f.read()
    except Exception as exc:
        print(f"⚠️ OpenVoice v2 tone transfer fallback to base edge-tts: {exc}")

    finally:
        for p in (base_wav_path, ref_wav_path, output_wav_path):
            try: os.unlink(p)
            except OSError: pass

    return base_mp3


def synthesize_speech(
    text: str,
    target_lang: str,
    speaker_audio_bytes: Optional[bytes] = None,
    return_base64: bool = True,
    gender: str = "male",
) -> dict:
    """
    Public Speech Synthesis Entry Point.
    Supports Male & Female base speech contours for accurate voice cloning!
    """
    use_cloning = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_cloning and speaker_audio_bytes and len(speaker_audio_bytes) > 0:
        raw = synthesize_openvoice(text, target_lang, speaker_audio_bytes, gender=gender)
        mime, engine_name = "audio/wav", "openvoice_v2_cloning"
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
