"""
Speech-to-Text Module
Uses OpenAI Whisper-small for transcription + auto language detection.
Auto-selects CUDA (Colab T4 / RTX 3050) or CPU (Ryzen 7 5800H).
"""

from __future__ import annotations

import os
import tempfile

# Third-party — not installed locally; installed on Colab. Linter suppressed.
try:
    import whisper  # type: ignore
    import torch    # type: ignore
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

# Singleton model instance — loaded once per process
_model = None


def _get_device() -> str:
    if not _DEPS_AVAILABLE:
        return "cpu"
    if torch.cuda.is_available():
        print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} — Whisper on CUDA.")
        return "cuda"
    print("💻 No GPU found — Whisper on CPU (Ryzen 7 5800H).")
    return "cpu"


def get_model():
    """Load Whisper model once and cache it (singleton)."""
    global _model
    if _model is None:
        if not _DEPS_AVAILABLE:
            raise RuntimeError("openai-whisper and torch are not installed. Run on Colab.")
        name = os.getenv("WHISPER_MODEL", "small")
        device = _get_device()
        print(f"🔊 Loading Whisper '{name}' on {device.upper()} ...")
        # Whisper automatically manages FP16 precision inside model.transcribe(..., fp16=True)
        _model = whisper.load_model(name, device=device)
        params_m = sum(p.numel() for p in _model.parameters()) / 1e6
        print(f"✅ Whisper '{name}' ready ({params_m:.0f}M params).")
    return _model



def transcribe_audio(audio_bytes: bytes, source_language: str | None = None) -> dict:
    """
    Transcribe raw audio bytes → text using Whisper-small.

    Args:
        audio_bytes:     Raw audio (WAV / WebM / MP3 / OGG).
        source_language: ISO 639-1 hint, e.g. "en". None = auto-detect.

    Returns:
        {"text": str, "language": str, "segments": list}
    """
    model = get_model()

    # Whisper needs a file path, not bytes — write to a temp file
    suffix = ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        opts: dict = {}
        if source_language and source_language.lower() not in ("", "auto"):
            opts["language"] = source_language

        use_fp16 = _DEPS_AVAILABLE and torch.cuda.is_available()
        result = model.transcribe(tmp_path, fp16=use_fp16, **opts)

        return {
            "text":     result.get("text", "").strip(),
            "language": result.get("language", "unknown"),
            "segments": result.get("segments", []),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
