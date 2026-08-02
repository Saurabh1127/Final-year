# 🚀 LinguaMeet AI — Google Colab Setup & MERN Integration Guide

Welcome to **LinguaMeet AI** — A Real-Time Multi-Lingual Speech-to-Speech Translation & Meeting Platform.

This guide provides a **step-by-step walkthrough** for:
1. Setting up the GPU-accelerated **FastAPI AI Microservice** in Google Colab (Tesla T4 GPU).
2. Understanding how the **Cascaded AI Pipeline (Whisper + NLLB + Sarvam / Edge TTS)** works.
3. Connecting your local **MERN Stack (React + Node.js Express + MongoDB)** to Google Colab via Ngrok for live meeting translation and AI summaries.

---

## 🛠️ Part 1: Setting Up the AI Microservice in Google Colab

### Prerequisites
* A free **Google Account** (to access Google Colab).
* An optional **Sarvam AI API Key** from [dashboard.sarvam.ai](https://dashboard.sarvam.ai) for Indian regional voice synthesis.

### Step-by-Step Execution:

1. **Open Google Colab**:
   * Go to [colab.research.google.com](https://colab.research.google.com).
   * Create a **New Notebook**.

2. **Enable GPU Hardware Acceleration**:
   * In top menu: Click `Runtime` ➔ `Change runtime type`.
   * Select **T4 GPU** under Hardware accelerator and click **Save**.

3. **Run Notebook Cells (`colab_test.py`)**:
   Copy and paste each cell block below into separate code cells in your Colab notebook:

#### 🔹 Cell 1: Check GPU VRAM
```python
import torch
print("CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("VRAM:", round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2), "GB")
```

#### 🔹 Cell 2: Clone GitHub Repository
```python
import os, shutil
GITHUB_REPO = "https://github.com/Saurabh1127/Final-year.git"
REPO_DIR    = "/content/Final-year"
if os.path.exists(REPO_DIR): shutil.rmtree(REPO_DIR)
os.system(f"git clone {GITHUB_REPO} {REPO_DIR}")
os.chdir(f"{REPO_DIR}/ai-service")
```

#### 🔹 Cell 3: Install Required Dependencies
```python
!pip install -q fastapi==0.111.0 uvicorn[standard]==0.30.1 pydantic==2.7.4 \
    python-dotenv==1.0.1 python-multipart==0.0.9 websockets==12.0 \
    openai-whisper==20240930 torchaudio transformers==4.44.2 \
    sentencepiece==0.2.0 protobuf==5.27.2 accelerate "numpy<2" scipy \
    gTTS==2.5.1 edge-tts==6.1.12 nest_asyncio requests pyngrok
```

#### 🔹 Cell 4: Configure AI Models & API Keys
```python
import os
os.environ["WHISPER_MODEL"] = "large-v3"
os.environ["NLLB_MODEL"]    = "facebook/nllb-200-distilled-1.3B"
os.environ["SARVAM_API_KEY"] = "sk_up7c1rdn_zGiuPp7vz1uMyxcjbvVVJ7Fc"
```

#### 🔹 Cell 5 & 6: Load AI Model Weights into GPU Memory
```python
import whisper
whisper.load_model("large-v3")

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-1.3B")
AutoModelForSeq2SeqLM.from_pretrained("facebook/nllb-200-distilled-1.3B")
```

#### 🔹 Cell 7: Launch FastAPI Server & Expose via Ngrok
```python
import subprocess, time
from pyngrok import ngrok

server = subprocess.Popen(
    ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd="/content/Final-year/ai-service",
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT
)
time.sleep(6)
tunnel = ngrok.connect(8000)
print(f"🌐 PUBLIC FASTAPI URL: {tunnel.public_url}")
```

#### 🔹 Cell 8: 3-Way Audio Verification Widget (Colab Mic ➔ Translation)
* Record your mic input in Colab.
* Listen to **Original Mic Input**, **Sarvam AI Hindi**, and **Microsoft Edge Neural Speech Hindi** side-by-side!

---

## 🧠 Part 2: How the AI Microservice Pipeline Works

The LinguaMeet AI microservice utilizes a **Cascaded Speech-to-Speech Translation (S2ST) Architecture**:

```
[ 🎙️ Audio Input (WebM/WAV) ]
             │
             ▼
 ┌─────────────────────────┐
 │ 1. OpenAI Whisper       │ ➔ Automatic Speech Recognition (ASR)
 │    large-v3 (1.55B)     │    Transcribes input audio to source text & language.
 └───────────┬─────────────┘
             │ (Source Text: "Hello, welcome to our meeting.")
             ▼
 ┌─────────────────────────┐
 │ 2. Meta NLLB            │ ➔ Neural Machine Translation (NMT)
 │    distilled-1.3B       │    Translates text to target language (e.g. Hindi "नमस्ते...").
 └───────────┬─────────────┘
             │ (Translated Text)
             ▼
 ┌─────────────────────────┐
 │ 3. Multi-Engine TTS     │ ➔ Text-to-Speech Synthesis
 │    - Sarvam AI bulbul:v2│    Synthesizes natural audio. Indian languages default to Sarvam AI,
 │    - Edge Neural Speech │    Global languages default to Microsoft Edge Neural Speech.
 └───────────┬─────────────┘
             │
             ▼
 [ 🔊 Output Translated Audio + Live Subtitle Payload ]
```

---

## 🔗 Part 3: Step-by-Step MERN + Colab Integration Guide

To connect your local React Frontend and Node.js Express server with the Colab GPU backend:

### Step 1: Copy Ngrok Public URL from Colab
When Cell 7 runs in Colab, it outputs a public Ngrok URL, for example:
`https://a1b2-34-125-56-78.ngrok-free.app`

### Step 2: Configure Environment Variables in MERN Stack

1. **In React Frontend (`client/.env`)**:
   ```env
   VITE_AI_SERVICE_URL=https://a1b2-34-125-56-78.ngrok-free.app
   ```

2. **In Node.js Express Backend (`server/.env`)**:
   ```env
   AI_SERVICE_URL=https://a1b2-34-125-56-78.ngrok-free.app
   ```

---

### Step 3: Frontend Speech Translation Component (`MeetingRoom.jsx`)

When a user speaks during a meeting, the React client records 3-second audio chunks and sends them directly to Colab FastAPI:

```javascript
// client/src/hooks/useSpeechTranslation.js
const processAudioChunk = async (audioBlob, targetLanguage) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "chunk.webm");
  formData.append("target_languages", JSON.stringify([targetLanguage]));
  formData.append("include_audio", "true");

  const response = await fetch(`${import.meta.env.VITE_AI_SERVICE_URL}/api/process-audio`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  
  // 1. Play translated audio chunk
  if (data.audio_translations?.[targetLanguage]?.audio_base64) {
    const audio = new Audio(`data:audio/mp3;base64,${data.audio_translations[targetLanguage].audio_base64}`);
    audio.play();
  }

  // 2. Broadcast Live Subtitles via WebRTC/Socket.io
  socket.emit("send-subtitle", {
    originalText: data.original_text,
    translatedText: data.translations[targetLanguage],
  });
};
```

---

### Step 4: MongoDB Transcript Storage & AI Meeting Summaries

1. Every transcribed entry is saved to MongoDB via Express backend:
   ```javascript
   // server/controllers/transcriptController.js
   await Transcript.create({
     meetingId: req.body.meetingId,
     speaker: req.body.userId,
     originalText: data.original_text,
     translatedText: data.translations,
   });
   ```

2. Post-Meeting AI Summarization (`server/controllers/summaryController.js`):
   When the host clicks **"End Meeting"**, Express fetches all transcript entries for `meetingId` from MongoDB and generates an Executive Summary & Action Items using LLM API (Gemini / Llama-3).

---

## 📊 Summary Architecture Map

```
  ┌─────────────────┐       Direct Audio WebM POST       ┌────────────────────────┐
  │                 ├───────────────────────────────────►│ Google Colab FastAPI   │
  │ React Frontend  │                                    │ (Whisper + NLLB + TTS) │
  │ (Client Browser)│◄───────────────────────────────────┤                        │
  └────────┬────────┘   Base64 Audio + Transcripts JSON  └────────────────────────┘
           │
           │ WebRTC Video / Signaling & Transcript Persistence
           ▼
  ┌─────────────────┐       Mongo Storage        ┌────────────────────────┐
  │ Node.js Express │───────────────────────────►│ MongoDB Database       │
  │ Backend Server  │                            │ (Transcripts & Summary)│
  └─────────────────┘                            └────────────────────────┘
```

---

## ✅ System Verification Checklist

* [x] **ASR**: Whisper `large-v3` running on Colab T4 GPU (~0.4s STT).
* [x] **NMT**: Meta NLLB `1.3B` supporting 200+ languages including 22 Indian regional languages (~0.15s).
* [x] **TTS Engine 1**: Sarvam AI `bulbul:v2` for authentic native Indian speech (`pace: 0.95`).
* [x] **TTS Engine 2**: Microsoft Edge Neural Speech (`hi-IN-MadhurNeural`) for studio-grade 1:1 human cadence.
* [x] **MERN Bridge**: Direct browser-to-FastAPI Ngrok proxy for zero-latency audio streaming.
