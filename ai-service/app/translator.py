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

# ── Indic Languages ──────────────────────────────────────────────────────────
INDIC_LANGS = {"hi", "mr", "ta", "te", "bn", "gu", "kn", "ml", "pa", "ur", "or", "as"}

# ── NLLB BCP-47 language code map (ISO 639-1 → NLLB) ────────────────────────
LANG_CODE_MAP: dict[str, str] = {
    "en": "eng_Latn", "hi": "hin_Deva", "fr": "fra_Latn", "es": "spa_Latn",
    "de": "deu_Latn", "ja": "jpn_Jpan", "zh": "zho_Hans", "ar": "arb_Arab",
    "pt": "por_Latn", "ru": "rus_Cyrl", "ko": "kor_Hang", "it": "ita_Latn",
    "nl": "nld_Latn", "tr": "tur_Latn", "vi": "vie_Latn", "th": "tha_Thai",
    "bn": "ben_Beng", "ta": "tam_Taml", "te": "tel_Telu", "mr": "mar_Deva",
    "ur": "urd_Arab", "gu": "guj_Gujr", "kn": "kan_Knda", "ml": "mal_Mlym",
    "pa": "pan_Guru", "sw": "swh_Latn", "pl": "pol_Latn", "uk": "ukr_Cyrl",
    "or": "ori_Orya", "as": "asm_Beng",
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
    "th": "Thai",       "or": "Odia",       "as": "Assamese",
}


def _get_device() -> str:
    if not _DEPS_AVAILABLE:
        return "cpu"
    if torch.cuda.is_available():
        print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} — NLLB (CTranslate2) on CUDA.")
        return "cuda"
    print("💻 No GPU — NLLB (CTranslate2) on CPU.")
    return "cpu"


def _resolve_model_path(model_name_or_path: str) -> str:
    """
    Ensure the path points to a valid CTranslate2 directory containing 'model.bin'.
    If a raw HuggingFace repository name is passed (e.g. 'facebook/nllb-200-distilled-1.3B'),
    this locates the converted INT8 folder or automatically converts it.
    """
    import subprocess

    # 1. Direct match with model.bin
    if os.path.isfile(os.path.join(model_name_or_path, "model.bin")):
        return model_name_or_path

    # 2. Check candidate local directories
    raw_name = model_name_or_path.split("/")[-1]
    candidates = [
        raw_name,
        raw_name + "-int8",
        "nllb-200-distilled-1.3B-int8",
        "nllb-200-distilled-600M-int8",
        os.path.join("/content", raw_name + "-int8"),
        os.path.join("/content", "nllb-200-distilled-1.3B-int8"),
        os.path.join("/content", "nllb-200-distilled-600M-int8"),
        os.path.join("/content/Final-year/ai-service", raw_name + "-int8"),
        os.path.join("/content/Final-year/ai-service", "nllb-200-distilled-1.3B-int8"),
        os.path.join("/content/Final-year/ai-service", "nllb-200-distilled-600M-int8"),
    ]

    for candidate in candidates:
        if os.path.isfile(os.path.join(candidate, "model.bin")):
            print(f"📁 Found converted CTranslate2 NLLB model at: '{candidate}'")
            return candidate

    # 3. If no converted directory exists, auto-convert it using ct2-transformers-converter
    target_dir = raw_name if "-int8" in raw_name else raw_name + "-int8"
    hf_source = model_name_or_path if "/" in model_name_or_path else f"facebook/{raw_name.replace('-int8', '')}"
    print(f"🔄 Converting HuggingFace '{hf_source}' to CTranslate2 INT8 in '{target_dir}'...")
    subprocess.run([
        "ct2-transformers-converter",
        "--model", hf_source,
        "--output_dir", target_dir,
        "--quantization", "int8",
        "--force"
    ], check=True)
    return target_dir


def get_translator_and_tokenizer():
    """Load CTranslate2 NLLB model + tokenizer once and cache them (singleton)."""
    global _translator, _tokenizer
    if _translator is None or _tokenizer is None:
        if not _DEPS_AVAILABLE:
            raise RuntimeError("ctranslate2, transformers and torch are not installed. Run on Colab.")
        
        raw_model_path = os.getenv("NLLB_MODEL", "nllb-200-distilled-600M-int8")
        model_path = _resolve_model_path(raw_model_path)
        device = _get_device()
        print(f"🌐 Loading CTranslate2 NLLB '{model_path}' on {device.upper()} ...")
        
        # Ensure tokenizer loads from the same directory or fallback to HF hub
        try:
            _tokenizer = AutoTokenizer.from_pretrained(model_path)
        except Exception:
            try:
                _tokenizer = AutoTokenizer.from_pretrained(raw_model_path)
            except Exception:
                _tokenizer = AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M")
            
        compute_type = "int8_float16" if device == "cuda" else "int8"

        # ── Phase 11: CTranslate2 thread tuning ──────────────────────────────
        # inter_threads: number of independent translation pipelines running in parallel.
        #   GPU: 1 — the GPU handles parallelism internally; multiple pipelines fight for VRAM.
        #   CPU: 2 — allows 2 requests to overlap on the Ryzen 7 5800H (8 cores).
        # intra_threads: threads within a single pipeline (matrix ops, attention).
        #   GPU: 4 — enough for T4's compute units; more threads add scheduling overhead.
        #   CPU: 4 — optimal for 8-core Ryzen without over-subscribing.
        if device == "cuda":
            inter_threads = 1
            intra_threads = 4
        else:
            inter_threads = 2
            intra_threads = 4

        _translator = ctranslate2.Translator(
            model_path,
            device=device,
            compute_type=compute_type,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )
        print(f"✅ NLLB (CTranslate2) ready. "
              f"[inter_threads={inter_threads}, intra_threads={intra_threads}]")
    return _translator, _tokenizer


def get_nllb_code(iso: str) -> str:
    """Map ISO 639-1 → NLLB BCP-47 code. Falls back to English."""
    return LANG_CODE_MAP.get(iso, "eng_Latn")


def translate_text(text: str, src: str, tgt: str) -> str:
    """
    Translate text from src language to tgt language using CTranslate2 NLLB-200.
    """
    if not text or not text.strip():
        return ""
    if src == tgt:
        return text  # No-op

    try:
        translator, tokenizer = get_translator_and_tokenizer()
        tokenizer.src_lang = get_nllb_code(src)
        source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        target_prefix = [get_nllb_code(tgt)]
        results = translator.translate_batch(
            [source],
            target_prefix=[target_prefix],
            beam_size=2,
            max_decoding_length=128,
            repetition_penalty=1.1,
        )
        target = results[0].hypotheses[0][1:]
        return tokenizer.decode(tokenizer.convert_tokens_to_ids(target))
    except Exception as nllb_exc:
        print(f"⚠️ NLLB translation failed: {nllb_exc}")
        return text


def translate_to_multiple(text: str, src: str, targets: list[str]) -> dict[str, str]:
    """
    Translate text to multiple target languages using CTranslate2 NLLB-200 batching.
    """
    out: dict[str, str] = {}
    if not targets:
        return out
    if not text or not text.strip():
        for lang in targets:
            out[lang] = ""
        return out

    # Handle target == src directly
    remaining_targets = []
    for tgt in targets:
        if tgt == src:
            out[tgt] = text
        else:
            remaining_targets.append(tgt)

    if not remaining_targets:
        return out

    try:
        translator, tokenizer = get_translator_and_tokenizer()
        tokenizer.src_lang = get_nllb_code(src)
        source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))

        source_batch = [source] * len(remaining_targets)
        target_prefixes = [[get_nllb_code(tgt)] for tgt in remaining_targets]

        # Phase 13: Fast greedy/narrow-beam decoding (beam_size=2, capped length) for 40-70ms latency
        results = translator.translate_batch(
            source_batch,
            target_prefix=target_prefixes,
            beam_size=2,
            max_decoding_length=128,
            repetition_penalty=1.1,
        )

        for i, tgt in enumerate(remaining_targets):
            target_tokens = results[i].hypotheses[0][1:]
            out[tgt] = tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens))
    except Exception as exc:
        print(f"⚠️ NLLB Batch translation failed: {exc}")
        for tgt in remaining_targets:
            if tgt not in out:
                out[tgt] = text  # Graceful fallback to source text

    return out

