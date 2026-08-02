"""
Text-to-Speech & OpenVoice v2 Zero-Shot Voice Retention Module

Engine Architecture:
  1. Base Speech Generation: Microsoft Edge Neural TTS (edge-tts) — Crisp studio neural speech.
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

# OpenVoice v2 singleton
_tone_converter = None

# ── Microsoft Edge Neural Voice Map ───────────────────────────────────────────
EDGE_VOICE_MAP: dict[str, str] = {
    "en": "en-US-AvaNeural",
    "hi": "hi-IN-SwaraNeural",
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
    "ja": "ja-JP-NanamiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ar": "ar-SA-ZariyahNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "ko": "ko-KR-SunHiNeural",
    "it": "it-IT-ElsaNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",
    "bn": "bn-IN-TanishaaNeural",
    "ur": "ur-PK-UzmaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "pa": "pa-IN-GurpreetNeural",
    "nl": "nl-NL-ColetteNeural",
    "tr": "tr-TR-EmelNeural",
    "pl": "pl-PL-ZofiaNeural",
    "uk": "uk-UA-PolinaNeural",
    "vi": "vie-VN-HoaiMyNeural",
    "sw": "sw-KE-ZuriNeural",
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
    """Convert raw audio bytes to 16kHz WAV temp file."""
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


def synthesize_edge_tts(text: str, target_lang: str) -> bytes:
    """Synthesise studio-grade natural human speech via Microsoft Edge Neural TTS."""
    if not _EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge-tts not installed.")

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


def synthesize_openvoice(text: str, target_lang: str, speaker_audio_bytes: bytes) -> bytes:
    """
    OpenVoice v2 Tone Color Transfer.
    Generates crisp studio neural base speech via edge-tts, then converts tone color to match user's voice!
    """
    # 1. Base studio speech
    base_mp3 = synthesize_edge_tts(text, target_lang)
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
) -> dict:
    """
    Public Speech Synthesis Entry Point.
    Uses Edge Neural TTS for base speech, and OpenVoice v2 for voice cloning if USE_XTTS=true.
    """
    use_cloning = os.getenv("USE_XTTS", "false").strip().lower() == "true"

    if use_cloning and speaker_audio_bytes and len(speaker_audio_bytes) > 0:
        raw = synthesize_openvoice(text, target_lang, speaker_audio_bytes)
        mime, engine_name = "audio/wav", "openvoice_v2_cloning"
    elif _EDGE_TTS_AVAILABLE:
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
