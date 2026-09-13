"""
Speech-to-Text Module
Uses faster-whisper (CTranslate2) for 4x faster transcription + auto language detection.
Auto-selects CUDA (Colab T4 / RTX 3050) or CPU (Ryzen 7 5800H).
"""

from __future__ import annotations

import os
import tempfile

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
        {"text": str, "language": str, "segments": list}
    """
    model = get_model()

    # Use the correct file extension so FFmpeg auto-detects the codec properly
    suffix = _mime_to_ext(mime_type)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        opts: dict = {}
        if source_language and source_language.lower() not in ("", "auto"):
            opts["language"] = source_language

        # condition_on_previous_text=False prevents getting stuck in hallucination loops
        # vad_filter=True completely eliminates "Thank you" / "Subscribe" hallucinations on silence
        segments, info = model.transcribe(
            tmp_path, 
            beam_size=5, 
            vad_filter=True, 
            condition_on_previous_text=False, 
            **opts
        )
        
        # faster-whisper returns a generator for segments, we must iterate to actually transcribe
        text = " ".join([segment.text for segment in segments]).strip()

        return {
            "text":     text,
            "language": info.language,
            "segments": [], # we omit segment details for now to save memory
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
