"""
Speech-to-Text Module
Uses faster-whisper (CTranslate2) for 4x faster transcription + auto language detection.
Auto-selects CUDA (Colab T4 / RTX 3050) or CPU (Ryzen 7 5800H).
"""

from __future__ import annotations

import os
import subprocess
import tempfile

import numpy as np

# Third-party — not installed locally; installed on Colab. Linter suppressed.
try:
    from faster_whisper import WhisperModel  # type: ignore
    import torch    # type: ignore
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

# Singleton model instance — loaded once per process
_model = None


def _get_device_and_compute() -> tuple[str, str]:
    if not _DEPS_AVAILABLE:
        return "cpu", "int8"
    if torch.cuda.is_available():
        print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} — faster-whisper on CUDA (INT8).")
        return "cuda", "int8_float16" # compute_type="int8_float16" gives best performance on T4
    print("💻 No GPU found — faster-whisper on CPU (INT8).")
    return "cpu", "int8"


def get_model():
    """Load Whisper model once and cache it (singleton)."""
    global _model
    if _model is None:
        if not _DEPS_AVAILABLE:
            raise RuntimeError("faster-whisper and torch are not installed. Run on Colab.")
        name = os.getenv("WHISPER_MODEL", "small")
        device, compute_type = _get_device_and_compute()
        print(f"🔊 Loading faster-whisper '{name}' on {device.upper()} ...")
        
        _model = WhisperModel(name, device=device, compute_type=compute_type)
        print(f"✅ faster-whisper '{name}' ready.")
    return _model


# ── MIME type → file extension mapping ────────────────────────────────────────
MIME_EXT_MAP: dict[str, str] = {
    "audio/webm":              ".webm",
    "audio/webm;codecs=opus":  ".webm",
    "audio/ogg":               ".ogg",
    "audio/ogg;codecs=opus":   ".ogg",
    "audio/mp4":               ".m4a",
    "audio/mpeg":              ".mp3",
    "audio/mp3":               ".mp3",
    "audio/wav":               ".wav",
    "audio/x-wav":             ".wav",
    "audio/flac":              ".flac",
}


def _mime_to_ext(mime_type: str | None) -> str:
    """Map a MIME type string to a file extension Whisper/FFmpeg can decode."""
    if not mime_type:
        return ".webm"  # Browser default is WebM/Opus
    # Normalise: strip whitespace, lowercase
    key = mime_type.strip().lower().split(";")[0].strip()
    # Try exact match first, then base type
    return MIME_EXT_MAP.get(mime_type.strip().lower(),
           MIME_EXT_MAP.get(key, ".webm"))


def _decode_audio_to_numpy(audio_bytes: bytes, mime_type: str | None = None) -> np.ndarray | None:
    """
    Decode audio bytes in-memory using FFmpeg pipe into a 16kHz mono float32 NumPy array.
    Returns None if decoding fails (triggering the tempfile fallback).
    """
    try:
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-ar", "16000",
            "-ac", "1",
            "-f", "f32le",
            "pipe:1"
        ]
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        out, err = process.communicate(input=audio_bytes, timeout=10)
        if process.returncode != 0:
            return None
        return np.frombuffer(out, dtype=np.float32)
    except Exception:
        return None


def transcribe_audio(
    audio_bytes: bytes,
    source_language: str | None = None,
    mime_type: str | None = None,
) -> dict:
    """
    Transcribe raw audio bytes → text using faster-whisper.

    Args:
        audio_bytes:     Raw audio (WAV / WebM / MP3 / OGG).
        source_language: ISO 639-1 hint, e.g. "en". None = auto-detect.
        mime_type:       MIME type of the audio (e.g. "audio/webm;codecs=opus").
                         Used to pick the correct temp file extension so FFmpeg
                         decodes the format correctly.

    Returns:
        {
            "text": str,
            "language": str,
            "language_probability": float,
            "no_speech_prob": float,      # avg across segments; >0.6 = likely silence
            "avg_logprob": float,         # avg across segments; <-1.0 = low confidence
            "segments": list
        }
    """
    model = get_model()

    # Try in-memory decoding first
    audio_array = _decode_audio_to_numpy(audio_bytes, mime_type)
    if audio_array is not None and audio_array.size > 0:
        try:
            opts: dict = {}
            if source_language and source_language.lower() not in ("", "auto"):
                opts["language"] = source_language

            segments, info = model.transcribe(
                audio_array, 
                beam_size=1, 
                vad_filter=True, 
                vad_parameters=dict(
                    threshold=0.5,
                    min_speech_duration_ms=250,
                    min_silence_duration_ms=500
                ),
                condition_on_previous_text=False, 
                **opts
            )
            
            segment_list = list(segments)
            text = " ".join([seg.text for seg in segment_list]).strip()

            if segment_list:
                avg_no_speech = sum(seg.no_speech_prob for seg in segment_list) / len(segment_list)
                avg_logprob = sum(seg.avg_logprob for seg in segment_list) / len(segment_list)
            else:
                avg_no_speech = 1.0
                avg_logprob = -2.0

            return {
                "text":                 text,
                "language":             info.language,
                "language_probability": round(info.language_probability, 4),
                "no_speech_prob":       round(avg_no_speech, 4),
                "avg_logprob":          round(avg_logprob, 4),
                "segments":             [],
            }
        except Exception as exc:
            print(f"⚠️ [STT] In-memory transcription error: {exc}. Falling back to tempfile.")

    # Fallback path using tempfile
    suffix = _mime_to_ext(mime_type)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        opts = {}
        if source_language and source_language.lower() not in ("", "auto"):
            opts["language"] = source_language

        segments, info = model.transcribe(
            tmp_path, 
            beam_size=1, 
            vad_filter=True, 
            vad_parameters=dict(
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=500
            ),
            condition_on_previous_text=False, 
            **opts
        )
        
        segment_list = list(segments)
        text = " ".join([seg.text for seg in segment_list]).strip()

        if segment_list:
            avg_no_speech = sum(seg.no_speech_prob for seg in segment_list) / len(segment_list)
            avg_logprob = sum(seg.avg_logprob for seg in segment_list) / len(segment_list)
        else:
            avg_no_speech = 1.0
            avg_logprob = -2.0

        return {
            "text":                 text,
            "language":             info.language,
            "language_probability": round(info.language_probability, 4),
            "no_speech_prob":       round(avg_no_speech, 4),
            "avg_logprob":          round(avg_logprob, 4),
            "segments":             [],
        }
    except Exception as exc:
        print(f"⚠️ [STT] Audio decoding error: {exc}. Treating as silence.")
        return {
            "text":                 "",
            "language":             "en",
            "language_probability": 0.0,
            "no_speech_prob":       1.0,
            "avg_logprob":          -5.0,
            "segments":             [],
        }
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
