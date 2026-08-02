"""
Neural Machine Translation Module
Uses Meta NLLB-200-distilled-600M for 200+ language translation.
Auto-selects CUDA or CPU; FP16 on GPU for speed.
"""

from __future__ import annotations

import os

# Third-party — installed on Colab. Linter suppressed via try/except.
try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
    import torch  # type: ignore
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

# Singleton instances
_model = None
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
}


def _get_device() -> str:
    if not _DEPS_AVAILABLE:
        return "cpu"
    if torch.cuda.is_available():
        print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} — NLLB on CUDA.")
        return "cuda"
    print("💻 No GPU — NLLB on CPU.")
    return "cpu"


def get_model_and_tokenizer():
    """Load NLLB model + tokenizer once and cache them (singleton)."""
    global _model, _tokenizer
    if _model is None or _tokenizer is None:
        if not _DEPS_AVAILABLE:
            raise RuntimeError("transformers and torch are not installed. Run on Colab.")
        name = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
        device = _get_device()
        print(f"🌐 Loading NLLB '{name}' on {device.upper()} ...")
        _tokenizer = AutoTokenizer.from_pretrained(name)
        if device == "cuda":
            _model = AutoModelForSeq2SeqLM.from_pretrained(name, torch_dtype=torch.float16).to(device)
            print("⚡ NLLB FP16 on GPU enabled.")
        else:
            _model = AutoModelForSeq2SeqLM.from_pretrained(name).to(device)
        params_m = sum(p.numel() for p in _model.parameters()) / 1e6
        print(f"✅ NLLB '{name}' ready ({params_m:.0f}M params).")
    return _model, _tokenizer



def get_nllb_code(iso: str) -> str:
    """Map ISO 639-1 → NLLB BCP-47 code. Falls back to English."""
    return LANG_CODE_MAP.get(iso, "eng_Latn")


def translate_text(text: str, src: str, tgt: str) -> str:
    """
    Translate text from src language to tgt language using NLLB-200.

    Args:
        text: Text to translate.
        src:  ISO 639-1 source language code (e.g. "en").
        tgt:  ISO 639-1 target language code (e.g. "hi").

    Returns:
        Translated text string.
    """
    if not text or not text.strip():
        return ""
    if src == tgt:
        return text  # No-op

    model, tokenizer = get_model_and_tokenizer()
    device = next(model.parameters()).device

    tokenizer.src_lang = get_nllb_code(src)
    inputs = tokenizer(
        text,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    ).to(device)

    forced_bos = tokenizer.convert_tokens_to_ids(get_nllb_code(tgt))

    with torch.no_grad():
        tokens = model.generate(
            **inputs,
            forced_bos_token_id=forced_bos,
            max_new_tokens=512,
            num_beams=1,
            do_sample=False,
        )


    return tokenizer.batch_decode(tokens, skip_special_tokens=True)[0]


def translate_to_multiple(text: str, src: str, targets: list[str]) -> dict[str, str]:
    """Translate text to multiple target languages. Returns {lang: translated_text}."""
    out: dict[str, str] = {}
    for lang in targets:
        try:
            out[lang] = translate_text(text, src, lang)
        except Exception as exc:
            print(f"⚠️  Translation to '{lang}' failed: {exc}")
            out[lang] = f"[Translation error for '{lang}']"
    return out
