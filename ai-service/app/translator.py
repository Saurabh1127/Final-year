"""
Neural Machine Translation Module
Uses Meta NLLB-200-distilled-600M converted to CTranslate2 INT8 format.
Provides 2-4x speedup over HuggingFace Transformers and supports batching.
"""

from __future__ import annotations

import os

# Third-party — installed on Colab. Linter suppressed via try/except.
try:
    from transformers import AutoTokenizer  # type: ignore
    import ctranslate2 # type: ignore
    import torch # type: ignore
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

# Singleton instances
_translator = None
_tokenizer = None

# ── NLLB BCP-47 language code map (ISO 639-1 → NLLB) ────────────────────────
LANG_CODE_MAP: dict[str, str] = {
    "en": "eng_Latn", "hi": "hin_Deva", "fr": "fra_Latn", "es": "spa_Latn",
    "de": "deu_Latn", "ja": "jpn_Jpan", "zh": "zho_Hans", "ar": "arb_Arab",
    "pt": "por_Latn", "ru": "rus_Cyrl", "ko": "kor_Hang", "it": "ita_Latn",
    "nl": "nld_Latn", "tr": "tur_Latn", "vi": "vie_Latn", "th": "tha_Thai",
    "bn": "ben_Beng", "ta": "tam_Taml", "te": "tel_Telu", "mr": "mar_Deva",
    "ur": "urd_Arab", "gu": "guj_Gujr", "kn": "kan_Knda", "ml": "mal_Mlym",
    "pa": "pan_Guru", "sw": "swh_Latn", "pl": "pol_Latn", "uk": "ukr_Cyrl",
}

# Supported languages for the UI dropdown
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",    "hi": "Hindi",      "fr": "French",
    "es": "Spanish",    "de": "German",     "ja": "Japanese",
    "zh": "Chinese",    "ar": "Arabic",     "pt": "Portuguese",
    "ru": "Russian",    "ko": "Korean",     "it": "Italian",
    "ta": "Tamil",      "te": "Telugu",     "mr": "Marathi",
    "bn": "Bengali",    "ur": "Urdu",       "gu": "Gujarati",
    "kn": "Kannada",    "ml": "Malayalam",  "pa": "Punjabi",
    "nl": "Dutch",      "tr": "Turkish",    "pl": "Polish",
    "uk": "Ukrainian",  "vi": "Vietnamese", "sw": "Swahili",
    "th": "Thai",
}


def _get_device() -> str:
    if not _DEPS_AVAILABLE:
        return "cpu"
    if torch.cuda.is_available():
        print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} — NLLB (CTranslate2) on CUDA.")
        return "cuda"
    print("💻 No GPU — NLLB (CTranslate2) on CPU.")
    return "cpu"


def get_translator_and_tokenizer():
    """Load CTranslate2 NLLB model + tokenizer once and cache them (singleton)."""
    global _translator, _tokenizer
    if _translator is None or _tokenizer is None:
        if not _DEPS_AVAILABLE:
            raise RuntimeError("ctranslate2, transformers and torch are not installed. Run on Colab.")
        
        model_path = os.getenv("NLLB_MODEL", "nllb-200-distilled-600M-int8")
        device = _get_device()
        print(f"🌐 Loading CTranslate2 NLLB '{model_path}' on {device.upper()} ...")
        
        # Ensure tokenizer loads from the same directory (where converter copied it) or fallback to HF hub
        try:
            _tokenizer = AutoTokenizer.from_pretrained(model_path)
        except Exception:
            _tokenizer = AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M")
            
        compute_type = "int8_float16" if device == "cuda" else "int8"
        _translator = ctranslate2.Translator(model_path, device=device, compute_type=compute_type)
        print(f"✅ NLLB (CTranslate2) ready.")
    return _translator, _tokenizer


def get_nllb_code(iso: str) -> str:
    """Map ISO 639-1 → NLLB BCP-47 code. Falls back to English."""
    return LANG_CODE_MAP.get(iso, "eng_Latn")


def translate_text(text: str, src: str, tgt: str) -> str:
    """
    Translate text from src language to tgt language using NLLB CTranslate2.
    """
    if not text or not text.strip():
        return ""
    if src == tgt:
        return text  # No-op

    translator, tokenizer = get_translator_and_tokenizer()

    tokenizer.src_lang = get_nllb_code(src)
    source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
    target_prefix = [get_nllb_code(tgt)]
    
    results = translator.translate_batch([source], target_prefix=[target_prefix])
    
    target = results[0].hypotheses[0][1:] # skip the forced bos prefix
    return tokenizer.decode(tokenizer.convert_tokens_to_ids(target))


def translate_to_multiple(text: str, src: str, targets: list[str]) -> dict[str, str]:
    """
    Translate text to multiple target languages using CTranslate2 batching.
    This provides a massive speedup by processing all languages in a single GPU pass.
    """
    out: dict[str, str] = {}
    if not targets:
        return out
    if not text or not text.strip():
        for lang in targets:
            out[lang] = ""
        return out

    # Filter out target = src
    valid_targets = [tgt for tgt in targets if tgt != src]
    for tgt in targets:
        if tgt == src:
            out[tgt] = text
            
    if not valid_targets:
        return out

    translator, tokenizer = get_translator_and_tokenizer()
    
    try:
        tokenizer.src_lang = get_nllb_code(src)
        source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        
        # Batching: duplicate the source for each target language
        source_batch = [source] * len(valid_targets)
        target_prefixes = [[get_nllb_code(tgt)] for tgt in valid_targets]
        
        results = translator.translate_batch(source_batch, target_prefix=target_prefixes)
        
        for i, tgt in enumerate(valid_targets):
            target_tokens = results[i].hypotheses[0][1:] # skip prefix
            out[tgt] = tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens))
            
    except Exception as exc:
        print(f"⚠️  Batch translation failed: {exc}")
        for tgt in valid_targets:
            out[tgt] = f"[Translation error for '{tgt}']"

    return out

