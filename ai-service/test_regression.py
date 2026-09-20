"""
SAMVADA AI Pipeline — Regression Test Script
================================================
Run from Colab or any machine with access to the AI service URL.

Usage:
    python test_regression.py [AI_SERVICE_URL]

If no URL is provided, defaults to http://localhost:8000.

This script:
  1. Generates a synthetic 2-second English speech WAV (440Hz tone — Whisper recognises silence/noise)
  2. Sends it to /api/process-audio with target=["hi"]
  3. Prints STT output, Hindi translation, latency breakdown, and resource info
  4. Saves results to regression_baseline.json for comparison after changes
"""

import json
import os
import sys
import time
import struct
import math

try:
    import requests
except ImportError:
    print("❌ pip install requests")
    sys.exit(1)


def generate_wav(duration_s: float = 2.0, sample_rate: int = 16000, freq: float = 440.0) -> bytes:
    """Generate a simple WAV file with a sine wave tone."""
    num_samples = int(sample_rate * duration_s)
    data_size = num_samples * 2  # 16-bit = 2 bytes per sample
    file_size = 44 + data_size

    buf = bytearray(file_size)
    # RIFF header
    struct.pack_into('<4sI4s', buf, 0, b'RIFF', file_size - 8, b'WAVE')
    # fmt chunk
    struct.pack_into('<4sIHHIIHH', buf, 12, b'fmt ', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
    # data chunk header
    struct.pack_into('<4sI', buf, 36, b'data', data_size)
    # audio samples
    offset = 44
    for i in range(num_samples):
        sample = int(math.sin(2 * math.pi * freq * i / sample_rate) * 0.5 * 32767)
        struct.pack_into('<h', buf, offset, sample)
        offset += 2
    return bytes(buf)


def run_test(base_url: str):
    print(f"\n{'='*65}")
    print(f"🔬 SAMVADA Regression Test")
    print(f"   AI Service: {base_url}")
    print(f"{'='*65}\n")

    # 1. Health check
    print("1️⃣  Health check...")
    try:
        r = requests.get(f"{base_url}/health", headers={"ngrok-skip-browser-warning": "true"}, timeout=10)
        health = r.json()
        print(f"   Status:  {health.get('status')}")
        print(f"   Whisper: {health.get('whisper_model')}")
        print(f"   NLLB:    {health.get('nllb_model')}")
        print(f"   TTS:     {health.get('tts_engine')}")
        print(f"   Device:  {health.get('device')}")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return

    # 2. Send test audio
    print("\n2️⃣  Sending test audio (2s WAV tone → EN→HI)...")
    wav_bytes = generate_wav(duration_s=2.0)

    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {
        "meeting_id": "regression-test",
        "user_id": "test-user",
        "speaker_name": "RegressionBot",
        "source_language": "en",
        "target_languages": json.dumps(["hi"]),
        "include_audio": "true",
        "mime_type": "audio/wav",
    }

    t0 = time.time()
    try:
        r = requests.post(
            f"{base_url}/api/process-audio",
            files=files,
            data=data,
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=60,
        )
        wall_time = round(time.time() - t0, 3)
        result = r.json()
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return

    # 3. Print results
    print(f"\n3️⃣  Results:")
    print(f"   STT text:     \"{result.get('original_text', '')}\"")
    print(f"   Source lang:   {result.get('source_language', '?')}")
    print(f"   Hindi text:   \"{result.get('translations', {}).get('hi', '')}\"")

    lat = result.get("latency", {})
    print(f"\n   ⚡ Latency:")
    print(f"      STT:   {lat.get('asr_seconds', '?')}s")
    print(f"      NMT:   {lat.get('nmt_seconds', '?')}s")
    print(f"      TTS:   {lat.get('tts_seconds', '?')}s")
    print(f"      Total: {lat.get('total_seconds', '?')}s")
    print(f"      Wall:  {wall_time}s (includes network)")

    has_audio = bool(result.get("audio_translations", {}).get("hi", {}).get("audio_base64"))
    print(f"\n   🔈 Hindi audio: {'✅ Present' if has_audio else '❌ Missing'}")

    if result.get("error"):
        print(f"\n   ⚠️  Error: {result['error'][:200]}")

    # 4. Save baseline
    baseline = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "ai_service_url": base_url,
        "health": health,
        "original_text": result.get("original_text", ""),
        "source_language": result.get("source_language", ""),
        "hindi_translation": result.get("translations", {}).get("hi", ""),
        "has_hindi_audio": has_audio,
        "latency": lat,
        "wall_time_seconds": wall_time,
    }

    out_path = os.path.join(os.path.dirname(__file__), "regression_baseline.json")
    with open(out_path, "w") as f:
        json.dump(baseline, f, indent=2)
    print(f"\n   💾 Baseline saved to: {out_path}")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("AI_SERVICE_URL", "http://localhost:8000")
    run_test(url)
