"""
Voice Retention (Voice Cloning) Module — Phase 2 Production Integration
Uses Coqui XTTS-v2 for zero-shot speaker embedding extraction ($d$-vector)
and cross-lingual voice retention.
"""

from __future__ import annotations

import os
from typing import Optional
from .tts import _load_xtts, _xtts_clone_voice


class VoiceRetentionEngine:
    """
    Zero-Shot Voice Retention Engine.

    Features:
      • Extract 512-dim speaker embeddings from 3-second audio clips.
      • Synthesize translated text in the speaker's exact voice across languages.
      • Seamless GPU acceleration via PyTorch.
    """

    def __init__(self) -> None:
        self.active = os.getenv("USE_XTTS", "false").lower() == "true"
        print(f"🎙️  VoiceRetentionEngine status: {'ACTIVE (XTTS-v2)' if self.active else 'INACTIVE (USE_XTTS=false)'}")

    def clone_and_synthesize(
        self,
        text: str,
        target_lang: str,
        speaker_audio_bytes: bytes,
    ) -> bytes:
        """
        Public entry point for zero-shot voice retention synthesis.

        Args:
            text:                Translated text to synthesize.
            target_lang:         ISO 639-1 target language code.
            speaker_audio_bytes: Reference audio of the speaker.

        Returns:
            Raw audio bytes (WAV) of translated speech in speaker's voice.
        """
        return _xtts_clone_voice(text, target_lang, speaker_audio_bytes)


voice_engine = VoiceRetentionEngine()
