# ═══════════════════════════════════════════════════════════════════
# LinguaMeet AI Service — Google Colab Test Notebook
# ═══════════════════════════════════════════════════════════════════
# Instructions:
#   1. Open a NEW Google Colab notebook (Runtime → Change runtime type → GPU T4)
#   2. Copy each CELL block below and paste into separate Colab cells
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
# CELL 2 — Clone your GitHub repo
# ───────────────────────────────────────────────────────────────────
import os, shutil

GITHUB_REPO = "https://github.com/Saurabh1127/Final-year.git"  # If private: "https://<TOKEN>@github.com/Saurabh1127/Final-year.git"
REPO_DIR    = "/content/Final-year"

# Remove existing directory to ensure a fresh, clean clone
if os.path.exists(REPO_DIR):
    shutil.rmtree(REPO_DIR)

print(f"📥 Cloning repository: {GITHUB_REPO} ...")
exit_code = os.system(f"git clone {GITHUB_REPO} {REPO_DIR}")

if exit_code != 0 or not os.path.exists(f"{REPO_DIR}/ai-service"):
    print("\n❌ ERROR: Failed to clone repository or 'ai-service' directory missing!")
    print("👉 If your GitHub repo is PRIVATE, edit GITHUB_REPO with a Personal Access Token:")
    print("   GITHUB_REPO = 'https://YOUR_TOKEN@github.com/Saurabh1127/Final-year.git'")
else:
    os.chdir(f"{REPO_DIR}/ai-service")
    print("✅ Repo cloned successfully!")
    print("Working directory:", os.getcwd())
    os.system("ls -la")



# ───────────────────────────────────────────────────────────────────
# CELL 3 — Install all dependencies
# ───────────────────────────────────────────────────────────────────
# In Jupyter/Colab, standard shell commands (!) ensure the packages
# are installed directly into the active Python environment's path.
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
    pyngrok

print("✅ All packages installed.")



# ───────────────────────────────────────────────────────────────────
# CELL 4 — Set environment variables (16GB T4 GPU Optimised)
# ───────────────────────────────────────────────────────────────────
import os

# High-Precision Stack for 16GB T4 GPU:
#   Whisper options: "small" (244M, 0.12s) or "large-v3" (1.55B, 0.25s SOTA accuracy)
#   NLLB options:    "facebook/nllb-200-distilled-600M" or "facebook/nllb-200-distilled-1.3B"
os.environ["WHISPER_MODEL"] = "small"   # Swap to "large-v3" for maximum accuracy
os.environ["NLLB_MODEL"]    = "facebook/nllb-200-distilled-600M"  # Swap to "1.3B" if desired
os.environ["USE_XTTS"]      = "false"

print("Environment configured:")
print(f"  WHISPER_MODEL = {os.environ['WHISPER_MODEL']}")
print(f"  NLLB_MODEL    = {os.environ['NLLB_MODEL']}")
print(f"  USE_XTTS      = {os.environ['USE_XTTS']}")


# ───────────────────────────────────────────────────────────────────
# CELL 5 — Pre-download Whisper model weights
# ───────────────────────────────────────────────────────────────────
import whisper
model_name = os.environ.get("WHISPER_MODEL", "small")
print(f"⬇️  Downloading Whisper '{model_name}' weights...")
m = whisper.load_model(model_name)
print(f"✅ Whisper '{model_name}' loaded.")
del m
import torch; torch.cuda.empty_cache()


# ───────────────────────────────────────────────────────────────────
# CELL 6 — Pre-download NLLB model weights
# ───────────────────────────────────────────────────────────────────
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

nllb_name = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
print(f"⬇️  Downloading NLLB '{nllb_name}' weights...")
tokenizer = AutoTokenizer.from_pretrained(nllb_name)
model     = AutoModelForSeq2SeqLM.from_pretrained(nllb_name)
print(f"✅ NLLB '{nllb_name}' loaded.")
del tokenizer, model
torch.cuda.empty_cache()


# ───────────────────────────────────────────────────────────────────
# CELL 7 — Start FastAPI server + expose via ngrok
# ───────────────────────────────────────────────────────────────────
import subprocess, time
from pyngrok import ngrok, conf

# Optional: add your ngrok auth token for stable URLs (free at ngrok.com)
# conf.get_default().auth_token = "YOUR_NGROK_TOKEN"

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

print("\n" + "═"*60)
print("🌐  LINGUAMEET AI SERVICE IS LIVE!")
print("═"*60)
print(f"\n  Demo Dashboard → {public_url}/demo")
print(f"  API Docs       → {public_url}/docs")
print(f"  Health Check   → {public_url}/health")
print(f"  WebSocket URL  → {public_url.replace('https','wss')}/ws/process-audio")
print("\n  Open Demo Dashboard in your browser to test!")
print("═"*60)


# ───────────────────────────────────────────────────────────────────
# CELL 8 — In-Colab Microphone Recorder & Live Pipeline Verification
#   (Record your voice directly inside Colab and hear translation!)
# ───────────────────────────────────────────────────────────────────
from IPython.display import HTML, Audio, display
import google.colab.output
import base64, requests, json

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
  button.style = 'background: #f87171; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 8px; cursor: pointer; margin: 10px 0;';
  document.body.appendChild(button);
  while (recorder.state == 'recording') await sleep(100);
  stream.getTracks().forEach(track => track.stop());
  button.remove();
  blob = new Blob(chunks, { type: 'audio/webm' });
  text = await b2text(blob);
  resolve(text);
});
"""

def record_user_voice():
    display(HTML("<script>" + RECORD_JS + "</script>"))
    print("🎙️ Click 'STOP RECORDING' when you finish speaking...")
    data = google.colab.output.eval_js("record()")
    binary = base64.b64decode(data.split(',')[1])
    with open('/tmp/recorded_voice.webm', 'wb') as f:
        f.write(binary)
    print("✅ Voice recorded successfully!")

# 1. Record voice from browser mic inside Colab
record_user_voice()

# 2. Target languages for translation
TARGET_LANGS = ["hi", "fr", "es", "de", "ja"]

# 3. Send audio to FastAPI pipeline
print("\n🚀 Sending recorded speech to AI pipeline...")
with open('/tmp/recorded_voice.webm', 'rb') as f:
    resp = requests.post(
        "http://localhost:8000/api/process-audio",
        files={"audio": ("voice.webm", f, "audio/webm")},
        data={
            "meeting_id": "colab-mic-test",
            "user_id": "user-voice",
            "source_language": "auto",
            "target_languages": json.dumps(TARGET_LANGS),
            "include_audio": "true",
        },
        timeout=120,
    )

res = resp.json()

# 4. Display Results
print("\n" + "═"*60)
print(f"📝 1. SPOKEN TEXT TRANSCRIPTION [{res.get('source_language','?').upper()}]:")
print(f"   👉 \"{res.get('original_text','')}\"")
print("═"*60)

print("\n🌐 2. TRANSLATED TEXT & 🔈 3. AUDIO PLAYBACK:")
for lang, text in res.get("translations", {}).items():
    print(f"\n🔹 Language [{lang.upper()}]:")
    print(f"   Text: \"{text}\"")
    
    audio_info = res.get("audio_translations", {}).get(lang)
    if audio_info and audio_info.get("audio_base64"):
        audio_bytes = base64.b64decode(audio_info["audio_base64"])
        display(Audio(data=audio_bytes, autoplay=False))

lat = res.get("latency", {})
print("\n" + "═"*60)
print(f"⚡ Latency Breakdown: STT={lat.get('asr_seconds')}s | NMT={lat.get('nmt_seconds')}s | TTS={lat.get('tts_seconds')}s | Total={lat.get('total_seconds')}s")
print("═"*60)


# ───────────────────────────────────────────────────────────────────
# CELL 9 — Stop server when done testing
# ───────────────────────────────────────────────────────────────────
ngrok.kill()
server.terminate()
print("✅ Server stopped.")
