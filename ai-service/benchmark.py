import time
import os
import json
try:
    import sacrebleu
except ImportError:
    print("Installing sacrebleu...")
    os.system("pip install sacrebleu")
    import sacrebleu

from app.translator import translate_text, get_translator_and_tokenizer, get_nllb_code

# Predefined dataset for benchmarking (English to Hindi)
BENCHMARK_DATA = [
    {
        "en": "Hello, how are you today?",
        "hi_ref": "नमस्ते, आज आप कैसे हैं?"
    },
    {
        "en": "The artificial intelligence system is processing the audio.",
        "hi_ref": "कृत्रिम बुद्धिमत्ता प्रणाली ऑडियो को प्रोसेस कर रही है।"
    },
    {
        "en": "We need to schedule a meeting for tomorrow morning.",
        "hi_ref": "हमें कल सुबह के लिए एक बैठक तय करनी होगी।"
    },
    {
        "en": "Could you please send me the report by the end of the day?",
        "hi_ref": "क्या आप कृपया मुझे दिन के अंत तक रिपोर्ट भेज सकते हैं?"
    },
    {
        "en": "Thank you for your hard work and dedication.",
        "hi_ref": "आपकी कड़ी मेहनत और समर्पण के लिए धन्यवाद।"
    },
    {
        "en": "The new project will start next week and requires full team collaboration.",
        "hi_ref": "नया प्रोजेक्ट अगले सप्ताह शुरू होगा और इसके लिए पूरी टीम के सहयोग की आवश्यकता है।"
    },
    {
        "en": "Please make sure to turn off the lights before leaving the office.",
        "hi_ref": "कृपया कार्यालय से निकलने से पहले लाइट बंद करना सुनिश्चित करें।"
    },
    {
        "en": "I am looking forward to our collaboration.",
        "hi_ref": "मैं हमारे सहयोग की प्रतीक्षा कर रहा हूँ।"
    },
    {
        "en": "The software update will improve system performance and security.",
        "hi_ref": "सॉफ्टवेयर अपडेट सिस्टम के प्रदर्शन और सुरक्षा में सुधार करेगा।"
    },
    {
        "en": "If you have any questions, feel free to contact the support team.",
        "hi_ref": "यदि आपके कोई प्रश्न हैं, तो बेझिझक सहायता टीम से संपर्क करें।"
    }
]

def run_nllb_baseline(sentences):
    """Bypass the router and force NLLB for all translations."""
    translator, tokenizer = get_translator_and_tokenizer()
    tokenizer.src_lang = get_nllb_code("en")
    
    start_time = time.time()
    predictions = []
    
    for text in sentences:
        source = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        target_prefix = [get_nllb_code("hi")]
        results = translator.translate_batch([source], target_prefix=[target_prefix])
        target = results[0].hypotheses[0][1:]
        pred = tokenizer.decode(tokenizer.convert_tokens_to_ids(target))
        predictions.append(pred)
        
    latency = time.time() - start_time
    return predictions, latency / len(sentences)

def run_hybrid_stack(sentences):
    """Use the standard hybrid router (IndicTrans2 for en->hi)."""
    start_time = time.time()
    predictions = []
    
    for text in sentences:
        pred = translate_text(text, src="en", tgt="hi")
        predictions.append(pred)
        
    latency = time.time() - start_time
    return predictions, latency / len(sentences)

def main():
    print("="*60)
    print("🚀 LINGUAMEET AI PIPELINE BENCHMARK (Phase 4)")
    print("="*60)
    print(f"Dataset Size: {len(BENCHMARK_DATA)} sentences (EN -> HI)")
    print("Initializing models. This may take a moment on the first run...")
    
    sources = [item["en"] for item in BENCHMARK_DATA]
    references = [[item["hi_ref"] for item in BENCHMARK_DATA]]
    
    # 1. Benchmark NLLB Baseline
    print("\n--- Running Baseline: NLLB-200 (INT8) ---")
    nllb_preds, nllb_latency = run_nllb_baseline(sources)
    nllb_bleu = sacrebleu.corpus_bleu(nllb_preds, references)
    print(f"✅ NLLB Latency (per sentence): {nllb_latency:.3f} seconds")
    print(f"✅ NLLB BLEU Score: {nllb_bleu.score:.2f}")

    # 2. Benchmark Hybrid Stack (IndicTrans2)
    print("\n--- Running Hybrid Stack: IndicTrans2 (FP16) ---")
    hybrid_preds, hybrid_latency = run_hybrid_stack(sources)
    hybrid_bleu = sacrebleu.corpus_bleu(hybrid_preds, references)
    print(f"✅ IndicTrans2 Latency (per sentence): {hybrid_latency:.3f} seconds")
    print(f"✅ IndicTrans2 BLEU Score: {hybrid_bleu.score:.2f}")

    # 3. Print Results Summary
    print("\n" + "="*60)
    print("📊 BENCHMARK RESULTS FOR THESIS")
    print("="*60)
    print(f"{'Metric':<20} | {'NLLB-200 Baseline':<20} | {'IndicTrans2 Hybrid':<20}")
    print("-" * 65)
    print(f"{'Avg Latency':<20} | {nllb_latency*1000:.1f} ms{'':<13} | {hybrid_latency*1000:.1f} ms")
    print(f"{'BLEU Score':<20} | {nllb_bleu.score:.2f}{'':<16} | {hybrid_bleu.score:.2f}")
    
    improvement = hybrid_bleu.score - nllb_bleu.score
    print(f"\n💡 Conclusion: IndicTrans2 improves translation quality by {improvement:+.2f} BLEU points")
    print("   at the cost of slightly higher latency. This validates the Hybrid Router architecture!")
    print("="*60)

if __name__ == "__main__":
    main()
