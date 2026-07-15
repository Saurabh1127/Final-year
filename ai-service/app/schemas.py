from pydantic import BaseModel
from typing import Optional


class AudioProcessRequest(BaseModel):
    meeting_id: str
    user_id: str
    source_language: Optional[str] = None  # None = Whisper auto-detects
    target_languages: list[str] = ["en"]


class SubtitleResponse(BaseModel):
    text: str                      # Original transcribed text
    source_language: str           # Detected/provided language code
    translations: dict[str, str]   # {"en": "Hello", "fr": "Bonjour", "hi": "नमस्ते"}
    speaker_id: str
    timestamp: float


class HealthResponse(BaseModel):
    status: str
    service: str
    whisper_model: str
    nllb_model: str
    timestamp: float


class LanguagesResponse(BaseModel):
    languages: dict[str, str]  # {"en": "English", "hi": "Hindi", ...}
