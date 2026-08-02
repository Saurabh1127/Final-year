"""Pydantic response/request models for the LinguaMeet AI Service."""

from __future__ import annotations

from typing import Optional

try:
    from pydantic import BaseModel  # type: ignore
except ImportError:
    BaseModel = object  # type: ignore  # Allows file to parse locally without pydantic


class AudioResult(BaseModel):  # type: ignore[misc]
    audio_base64: str
    mime_type: str
    engine: str


class LatencyMetrics(BaseModel):  # type: ignore[misc]
    asr_seconds: float
    nmt_seconds: float
    tts_seconds: float
    total_seconds: float


class VoiceRetentionStatus(BaseModel):  # type: ignore[misc]
    enabled: bool
    engine: str
    status: str


class SubtitleResponse(BaseModel):  # type: ignore[misc]
    original_text: str
    source_language: str
    translations: dict[str, str]
    audio_translations: dict[str, Optional[AudioResult]]
    speaker_id: str
    meeting_id: str
    timestamp: float
    latency: LatencyMetrics
    voice_retention: VoiceRetentionStatus


class HealthResponse(BaseModel):  # type: ignore[misc]
    status: str
    service: str
    whisper_model: str
    nllb_model: str
    tts_engine: str
    device: str
    voice_retention_active: bool
    timestamp: float


class LanguagesResponse(BaseModel):  # type: ignore[misc]
    languages: dict[str, str]


class AudioProcessRequest(BaseModel):  # type: ignore[misc]
    meeting_id: str
    user_id: str
    source_language: Optional[str] = None
    target_languages: list[str] = ["en"]
