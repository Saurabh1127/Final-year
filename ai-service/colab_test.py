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
!pip install -q \
    fastapi==0.111.0 \
    uvicorn[standard]==0.30.1 \
    pydantic==2.7.4 \
    python-dotenv==1.0.1 \
    python-multipart==0.0.9 \
    websockets==12.0 \
    openai-whisper==20240930 \
    torchaudio \
    transformers==4.44.2 \
    sentencepiece==0.2.0 \
    protobuf==5.27.2 \
    accelerate \
    "numpy<2" \
    scipy \
    gTTS==2.5.1 \
    edge-tts==6.1.12 \
    nest_asyncio \
    requests \
    pyngrok

print("✅ All packages installed cleanly.")


# ───────────────────────────────────────────────────────────────────
# CELL 4 — Configure AI Models & Engine Keys
# ───────────────────────────────────────────────────────────────────
import os

# ASR (STT) Model: "small" (0.12s) or "large-v3" (SOTA 1.55B precision)
os.environ["WHISPER_MODEL"] = "large-v3"

# NMT Model: Meta NLLB 1.3B (200+ languages including 22 Indian scheduled languages)
os.environ["NLLB_MODEL"]    = "facebook/nllb-200-distilled-1.3B"

# Optional: Sarvam AI Sovereign Indian TTS Key (Leave empty to use Microsoft Edge Neural TTS)
os.environ["SARVAM_API_KEY"] = "sk_up7c1rdn_zGiuPp7vz1uMyxcjbvVVJ7Fc"

print("Environment configured:")
print(f"  WHISPER_MODEL  = {os.environ['WHISPER_MODEL']}")
print(f"  NLLB_MODEL     = {os.environ['NLLB_MODEL']}")
print(f"  SARVAM_API_KEY = {'CONFIGURED' if os.environ.get('SARVAM_API_KEY') else 'NOT SET'}")


# ───────────────────────────────────────────────────────────────────
# CELL 5 — Pre-download Whisper model weights
# ───────────────────────────────────────────────────────────────────
import whisper
model_name = os.environ.get("WHISPER_MODEL", "large-v3")
print(f"⬇️  Loading Whisper '{model_name}' weights...")
m = whisper.load_model(model_name)
print(f"✅ Whisper '{model_name}' loaded successfully.")
del m
import torch; torch.cuda.empty_cache()


# ───────────────────────────────────────────────────────────────────
# CELL 6 — Pre-download NLLB model weights
# ───────────────────────────────────────────────────────────────────
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

nllb_name = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-1.3B")
print(f"⬇️  Loading NLLB '{nllb_name}' weights...")
tokenizer = AutoTokenizer.from_pretrained(nllb_name)
model     = AutoModelForSeq2SeqLM.from_pretrained(nllb_name)
print(f"✅ NLLB '{nllb_name}' loaded successfully.")
del tokenizer, model
torch.cuda.empty_cache()


# ───────────────────────────────────────────────────────────────────
# CELL 7 — Start FastAPI server + expose via ngrok tunnel
# ───────────────────────────────────────────────────────────────────
import subprocess, time
from pyngrok import ngrok

server = subprocess.Popen(
    ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd=f"{REPO_DIR}/ai-service",
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)

print("⏳ Starting FastAPI server on Colab T4 GPU...")
time.sleep(6)

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


# ───────────────────────────────────────────────────────────────────
# CELL 8 — 3-Way Speech-to-Speech Audio Verification Widget
# ───────────────────────────────────────────────────────────────────
import sys, base64, importlib
from IPython.display import HTML, Audio, display
import google.colab.output

os.chdir('/content/Final-year/ai-service')
sys.path.append('/content/Final-year/ai-service')

!git pull > /dev/null 2>&1
import app.tts
importlib.reload(app.tts)
from app.pipeline import engine
from app.tts import synthesize_sarvam_tts, synthesize_edge_tts

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

print("\n🚀 Processing Speech-to-Speech Translation Pipeline...")

result = engine.process(
    audio_bytes=recorded_audio_bytes,
    target_languages=TARGET_LANGS,
    source_language="auto",
    include_audio=False,
)

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
print("🇮🇳 2. SARVAM AI (bulbul:v2 — Anushka Voice)")
print("─"*65)
try:
    sarvam_bytes = synthesize_sarvam_tts(hindi_text, "hi")
    display(Audio(data=sarvam_bytes, autoplay=False))
except Exception as e:
    print(f"⚠️ Sarvam error: {e}")

print("\n" + "─"*65)
print("🎙️ 3. MICROSOFT EDGE NEURAL SPEECH (hi-IN-MadhurNeural)")
print("─"*65)
try:
    edge_bytes = synthesize_edge_tts(hindi_text, "hi")
    display(Audio(data=edge_bytes, autoplay=False))
except Exception as e:
    print(f"⚠️ Edge TTS error: {e}")

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
