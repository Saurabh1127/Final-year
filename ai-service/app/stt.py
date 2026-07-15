import whisper
import os
import tempfile
import numpy as np

# Global model instance (loaded once)
_model = None


def get_model():
    """Load Whisper model lazily (singleton pattern)."""
    global _model
    if _model is None:
        model_name = os.getenv("WHISPER_MODEL", "tiny")
        print(f"🔊 Loading Whisper '{model_name}' model...")
        _model = whisper.load_model(model_name)
        print(f"✅ Whisper '{model_name}' model loaded.")
    return _model


def transcribe_audio(audio_bytes: bytes, source_language: str = None) -> dict:
    """
    Transcribe audio bytes using Whisper Tiny.
    
    Args:
        audio_bytes: Raw audio file bytes (WAV, WebM, etc.)
        source_language: Optional ISO 639-1 language code to hint Whisper.
                         If None, Whisper auto-detects the language.
    
    Returns:
        dict with keys: text, language, segments
    """
    model = get_model()

    # Write audio bytes to a temp file (Whisper needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # Build transcription options
        options = {}
        if source_language:
            options["language"] = source_language

        result = model.transcribe(tmp_path, **options)

        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", "unknown"),
            "segments": result.get("segments", []),
        }
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
