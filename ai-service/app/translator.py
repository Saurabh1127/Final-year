from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import os

# Global model/tokenizer instances (loaded once)
_model = None
_tokenizer = None

# NLLB uses BCP-47 style language codes — map common ISO 639-1 codes to NLLB codes
LANG_CODE_MAP = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "fr": "fra_Latn",
    "es": "spa_Latn",
    "de": "deu_Latn",
    "ja": "jpn_Jpan",
    "zh": "zho_Hans",
    "ar": "arb_Arab",
    "pt": "por_Latn",
    "ru": "rus_Cyrl",
    "ko": "kor_Hang",
    "it": "ita_Latn",
    "nl": "nld_Latn",
    "tr": "tur_Latn",
    "vi": "vie_Latn",
    "th": "tha_Thai",
    "bn": "ben_Beng",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "mr": "mar_Deva",
    "ur": "urd_Arab",
    "gu": "guj_Gujr",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "pa": "pan_Guru",
}

# Supported languages for the UI (display name → ISO code)
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ja": "Japanese",
    "zh": "Chinese",
    "ar": "Arabic",
    "pt": "Portuguese",
    "ru": "Russian",
    "ko": "Korean",
    "it": "Italian",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "bn": "Bengali",
    "ur": "Urdu",
}


def get_nllb_code(iso_code: str) -> str:
    """Convert ISO 639-1 code to NLLB BCP-47 code."""
    return LANG_CODE_MAP.get(iso_code, "eng_Latn")


def get_model_and_tokenizer():
    """Load NLLB model and tokenizer lazily (singleton)."""
    global _model, _tokenizer
    if _model is None or _tokenizer is None:
        model_name = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
        print(f"🌐 Loading NLLB model '{model_name}'...")
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        print(f"✅ NLLB model loaded.")
    return _model, _tokenizer


def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text from source_lang to target_lang using NLLB.
    
    Args:
        text: The text to translate
        source_lang: ISO 639-1 source language code (e.g., "en", "hi")
        target_lang: ISO 639-1 target language code
    
    Returns:
        Translated text string
    """
    if not text or not text.strip():
        return ""

    # Skip translation if source == target
    if source_lang == target_lang:
        return text

    model, tokenizer = get_model_and_tokenizer()

    src_nllb = get_nllb_code(source_lang)
    tgt_nllb = get_nllb_code(target_lang)

    # Set source language for tokenizer
    tokenizer.src_lang = src_nllb

    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)

    # Generate translation with target language forced
    translated_tokens = model.generate(
        **inputs,
        forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_nllb),
        max_new_tokens=512,
    )

    result = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
    return result


def translate_to_multiple(text: str, source_lang: str, target_languages: list[str]) -> dict:
    """
    Translate text into multiple target languages.
    
    Returns:
        dict mapping target_lang → translated_text
    """
    translations = {}
    for target_lang in target_languages:
        try:
            translations[target_lang] = translate_text(text, source_lang, target_lang)
        except Exception as e:
            print(f"⚠️ Translation to '{target_lang}' failed: {e}")
            translations[target_lang] = f"[Translation error: {target_lang}]"
    return translations
