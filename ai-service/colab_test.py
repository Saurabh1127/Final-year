# ═══════════════════════════════════════════════════════════════════
# LinguaMeet AI Service — Google Colab Test Notebook
# ═══════════════════════════════════════════════════════════════════
# Instructions for New Users / Evaluators:
#   1. Open a NEW Google Colab notebook (Runtime → Change runtime type → T4 GPU)
#   2. Copy each CELL block below into a separate Colab cell
#   3. Run cells one by one in order (Shift+Enter)
# ═══════════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────────
# CELL 1 — Check GPU availability (16GB VRAM on T4)
# ───────────────────────────────────────────────────────────────────
import torch
print("CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("VRAM:", round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2), "GB")
else:
    print("⚠️  No GPU detected. Go to Runtime → Change runtime type → T4 GPU")


# ───────────────────────────────────────────────────────────────────
# CELL 2 — Clone GitHub repository
# ───────────────────────────────────────────────────────────────────
import os, shutil

# Move out of the directory before deleting it (fixes getcwd error on 2nd run)
os.chdir('/content')

GITHUB_REPO = "https://github.com/Saurabh1127/Final-year.git"
REPO_DIR    = "/content/Final-year"

# Fresh clean clone
if os.path.exists(REPO_DIR):
    shutil.rmtree(REPO_DIR)

print(f"📥 Cloning repository: {GITHUB_REPO} ...")
exit_code = os.system(f"git clone {GITHUB_REPO} {REPO_DIR}")

if exit_code != 0 or not os.path.exists(f"{REPO_DIR}/ai-service"):
    print("\n❌ ERROR: Failed to clone repository or 'ai-service' directory missing!")
else:
    os.chdir(f"{REPO_DIR}/ai-service")
    print("✅ Repo cloned successfully!")
    print("Working directory:", os.getcwd())


# ───────────────────────────────────────────────────────────────────
# CELL 3 — Install all dependencies (AI, Web & TTS Engines)
# ───────────────────────────────────────────────────────────────────
# Server and web dependencies
!pip install -q fastapi uvicorn[standard] python-multipart websockets python-dotenv pyngrok

# AI, Translation, and TTS dependencies
!pip install -q faster-whisper transformers accelerate sentencepiece nest_asyncio gTTS edge-tts

print("✅ All packages installed cleanly.")


# ───────────────────────────────────────────────────────────────────
# CELL 4 — Configure AI Models & Engine Keys
# ───────────────────────────────────────────────────────────────────
import os

# ASR (STT) Model: faster-whisper uses CTranslate2 for 4-5x speedup
# Options: "tiny", "base", "small" (recommended), "medium", "large-v3"
# Note: "large-v3" uses ~4GB VRAM and is very slow. "small" uses ~500MB and is fast.
os.environ["WHISPER_MODEL"] = "small"

# NMT Model: Meta NLLB 1.3B or 600M (200+ languages including Indian languages)
# Note: "1.3B" uses ~2.6GB VRAM. "600M" uses ~1.2GB VRAM. Use 600M to avoid Colab crashes.
os.environ["NLLB_MODEL"]    = "facebook/nllb-200-distilled-600M"

os.environ["SARVAM_API_KEY"] = os.environ.get("SARVAM_API_KEY", "")

print("Environment configured:")
print(f"  WHISPER_MODEL  = {os.environ['WHISPER_MODEL']}")
print(f"  NLLB_MODEL     = {os.environ['NLLB_MODEL']}")
print(f"  SARVAM_API_KEY = {'CONFIGURED' if os.environ.get('SARVAM_API_KEY') else 'NOT SET'}")


# ───────────────────────────────────────────────────────────────────
# CELL 5 — Pre-download faster-whisper model weights (cache only)
# ───────────────────────────────────────────────────────────────────
# Only downloads to disk cache — does NOT load into RAM/VRAM.
# The FastAPI server loads it on startup via the lifespan handler.
from faster_whisper import WhisperModel
model_name = os.environ.get("WHISPER_MODEL", "small")
print(f"⬇️  Downloading faster-whisper '{model_name}' to cache...")
_fw = WhisperModel(model_name, device="cpu", compute_type="int8")
print(f"✅ faster-whisper '{model_name}' cached.")
del _fw
import torch; torch.cuda.empty_cache()
import gc; gc.collect()


# ───────────────────────────────────────────────────────────────────
# CELL 6 — Convert NLLB model to CTranslate2 INT8 format
# ───────────────────────────────────────────────────────────────────
import os
import subprocess

nllb_name = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
output_dir = nllb_name.split("/")[-1] + "-int8"

print(f"⬇️  Downloading and converting NLLB '{nllb_name}' to CTranslate2 INT8 format...")
if not os.path.exists(output_dir):
    subprocess.run([
        "ct2-transformers-converter",
        "--model", nllb_name,
        "--output_dir", output_dir,
        "--quantization", "int8",
        "--force"
    ], check=True)
    print(f"✅ NLLB '{nllb_name}' converted and saved to {output_dir}/")
else:
    print(f"✅ NLLB converted model already exists in {output_dir}/")

# Update env var to point to the converted model directory for the API
os.environ["NLLB_MODEL"] = output_dir
print(f"  NLLB_MODEL is now set to: {os.environ['NLLB_MODEL']}")


# ───────────────────────────────────────────────────────────────────
# CELL 7 — Start FastAPI server + expose via ngrok tunnel
# ───────────────────────────────────────────────────────────────────
import subprocess, time, os, getpass
from pyngrok import ngrok

# Ngrok now requires an authtoken for all free accounts.
token = os.environ.get("NGROK_AUTHTOKEN")
if not token:
    print("🔑 Please enter your ngrok Authtoken.")
    print("   (Get it for free at: https://dashboard.ngrok.com/get-started/your-authtoken)")
    token = input("Ngrok Authtoken (paste here and press Enter): ")

if token.strip():
    ngrok.set_auth_token(token.strip())
else:
    print("❌ No token provided. Ngrok tunnel will likely fail.")

# Write logs to a file to prevent stdout pipe buffer from filling up and freezing the server
log_file = open(f"{REPO_DIR}/ai-service/server.log", "w")
server = subprocess.Popen(
    ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd=f"{REPO_DIR}/ai-service",
    stdout=log_file,
    stderr=subprocess.STDOUT,
)

print("⏳ Starting FastAPI server on Colab T4 GPU...")
time.sleep(6)

try:
    tunnel     = ngrok.connect(8000)
    public_url = tunnel.public_url

    print("\n" + "═"*65)
    print("🌐  LINGUAMEET AI SERVICE IS LIVE & EXPOSED TO REACT FRONTE N D!")
    print("═"*65)
    print(f"\n  FastAPI Public URL → {public_url}")
    print(f"  Interactive Docs   → {public_url}/docs")
    print(f"  Health Check Status→ {public_url}/health")
    print(f"  WebSocket URL      → {public_url.replace('https','wss')}/ws/process-audio")
    print("═"*65)
except Exception as e:
    print("\n❌ Failed to start ngrok tunnel. Make sure your authtoken is correct.")
    print(str(e))


# ───────────────────────────────────────────────────────────────────
# CELL 8 — 3-Way Speech-to-Speech Audio Verification Widget
# ───────────────────────────────────────────────────────────────────
import sys, base64, requests, json
from IPython.display import HTML, Audio, display
import google.colab.output

TARGET_LANGS = ["hi"]

RECORD_JS = """
const sleep = time => new Promise(resolve => setTimeout(resolve, time));
const b2text = blob => new Promise(resolve => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});
var record = path => new Promise(async resolve => {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start();
  button = document.createElement('button');
  button.onclick = () => { recorder.stop(); };
  button.innerText = '🔴 STOP RECORDING';
  button.style = 'background: #f87171; color: white; border: none; padding: 14px 28px; font-size: 18px; font-weight: bold; border-radius: 8px; cursor: pointer; margin: 15px 0; display: block;';
  document.body.appendChild(button);
  while (recorder.state == 'recording') await sleep(100);
  stream.getTracks().forEach(track => track.stop());
  button.remove();
  blob = new Blob(chunks, { type: 'audio/webm' });
  text = await b2text(blob);
  resolve(text);
});
"""

print("🎙️ SPEAK ANY ENGLISH SENTENCE TO TEST SPEECH TRANSLATION:")
display(HTML("<script>" + RECORD_JS + "</script>"))
data = google.colab.output.eval_js("record()")
recorded_audio_bytes = base64.b64decode(data.split(',')[1])

print("\n🚀 Sending audio to FastAPI server for processing...")

# We send the request to the local FastAPI server instead of importing the engine.
# This prevents the notebook from loading a second copy of the AI models into VRAM!
response = requests.post(
    "http://localhost:8000/api/process-audio",
    files={"audio": ("test_audio.webm", recorded_audio_bytes, "audio/webm")},
    data={
        "meeting_id": "test_room",
        "user_id": "colab_tester",
        "speaker_name": "Colab User",
        "source_language": "auto",
        "target_languages": json.dumps(TARGET_LANGS),
        "include_audio": "true",
    }
)

if response.status_code != 200:
    print(f"❌ Server Error: {response.status_code}\n{response.text}")
else:
    result = response.json()
    hindi_text = result.get("translations", {}).get("hi", "")

print("\n" + "═"*65)
print(f"📝 ORIGINAL SPOKEN TEXT [{result.get('source_language','?').upper()}]: \"{result.get('original_text','')}\"")
print(f"🌐 TRANSLATED HINDI TEXT: \"{hindi_text}\"")
print("═"*65)

print("\n🔊 3-WAY AUDIO COMPARISON:")

print("\n" + "─"*65)
print("🎤 1. YOUR ORIGINAL RECORDED VOICE")
print("─"*65)
display(Audio(data=recorded_audio_bytes, autoplay=False))

print("\n" + "─"*65)
print("🔊 2. AI TRANSLATED VOICE (Returned from API)")
print("─"*65)

audio_b64 = result.get("audio_base64")
if audio_b64:
    audio_bytes = base64.b64decode(audio_b64)
    display(Audio(data=audio_bytes, autoplay=False))
else:
    print("⚠️ No audio returned from API.")

lat = result.get("latency", {})
print("\n" + "═"*65)
print(f"⚡ LATENCY: STT={lat.get('asr_seconds')}s | NMT={lat.get('nmt_seconds')}s | TOTAL={lat.get('total_seconds')}s")
print("═"*65)


# ───────────────────────────────────────────────────────────────────
# CELL 9 — Stop server when done testing
# ───────────────────────────────────────────────────────────────────
# ngrok.kill()
# server.terminate()
# print("✅ Server stopped.")
