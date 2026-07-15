"""
Language detection is handled by Whisper itself during transcription.
This module provides utility functions for language code mapping and validation.
"""

from .translator import SUPPORTED_LANGUAGES, LANG_CODE_MAP


def is_supported_language(lang_code: str) -> bool:
    """Check if a language code is supported."""
    return lang_code in LANG_CODE_MAP


def get_language_name(lang_code: str) -> str:
    """Get human-readable language name from ISO 639-1 code."""
    return SUPPORTED_LANGUAGES.get(lang_code, f"Unknown ({lang_code})")


def get_supported_languages() -> dict:
    """Return dict of supported language codes → display names."""
    return SUPPORTED_LANGUAGES.copy()
