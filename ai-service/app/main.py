"""
LinguaMeet AI Service — Production-Ready FastAPI Server

Endpoints:
  GET  /health               — Service health + loaded model info
  GET  /api/languages        — Supported language list for UI
  POST /api/process-audio    — Full S2ST pipeline (REST multipart)
  WS   /ws/process-audio     — Full S2ST pipeline (WebSocket, real-time)
  GET  /demo                 — Standalone interactive test dashboard

Architecture:
  Whisper-small (STT) → NLLB-200-600M (NMT) → gTTS / XTTS-v2 (TTS)
  Auto-selects CUDA (Colab T4 / RTX 3050) or CPU (Ryzen 7 5800H).
"""

from __future__ import annotations

import json
import os
import time
import base64
from contextlib import asynccontextmanager
from typing import Any, Optional

# ── Optional: torch (GPU detection) ──────────────────────────────────────────
try:
    import torch as _torch  # type: ignore
    _TORCH_AVAILABLE: bool = True
except ImportError:
    _torch = None  # type: ignore
    _TORCH_AVAILABLE = False


def _cuda_available() -> bool:
    return _TORCH_AVAILABLE and _torch is not None and _torch.cuda.is_available()


# ── Optional: FastAPI stack (not installed locally) ───────────────────────────
# All names are stubbed in the except branch so the linter never sees
# undefined references in the endpoint function signatures below.
try:
    from fastapi import (  # type: ignore
        FastAPI,
        UploadFile,
        File,
        Form,
        WebSocket,
        WebSocketDisconnect,
    )
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
    from fastapi.responses import HTMLResponse  # type: ignore
    from dotenv import load_dotenv  # type: ignore
    _FASTAPI_AVAILABLE: bool = True

except ImportError:
    _FASTAPI_AVAILABLE = False

    # ── Stub class: awaitable & callable fallback for type-checkers ────────────
    class _Stub:  # type: ignore[no-redef]
        def __init__(self, *_a: Any, **_kw: Any) -> None: pass
        def __call__(self, *_a: Any, **_kw: Any) -> Any: return self
        def __getattr__(self, _name: str) -> Any: return self
        def __await__(self) -> Any:
            async def _dummy() -> Any: return self
            return _dummy().__await__()

    class WebSocketDisconnect(Exception):  # type: ignore[no-redef]
        pass

    def load_dotenv(*_a: Any, **_kw: Any) -> None: pass  # type: ignore[misc]

    FastAPI = _Stub  # type: ignore[misc,assignment]
    UploadFile = _Stub  # type: ignore[misc,assignment]
    CORSMiddleware = _Stub  # type: ignore[misc,assignment]
    HTMLResponse = _Stub  # type: ignore[misc,assignment]
    WebSocket = Any  # type: ignore[misc,assignment]

    # Descriptor stubs (File / Form return a default value when called)
    def File(*_a: Any, **_kw: Any) -> Any: return None  # type: ignore[misc]
    def Form(*_a: Any, **_kw: Any) -> Any: return None  # type: ignore[misc]


# ── Internal modules (always resolvable — no third-party deps) ────────────────
from .schemas import HealthResponse, LanguagesResponse
from .pipeline import engine
from .language_detect import get_supported_languages

load_dotenv()


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan — preload models at startup
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: "FastAPI"):  # type: ignore[valid-type]
    """FastAPI Lifespan manager. Lazy loads models on demand or preloads safely."""
    print("🚀 LinguaMeet AI Service initializing...")
    yield
    print("🛑 AI Service shutting down.")



# ─────────────────────────────────────────────────────────────────────────────
# FastAPI application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LinguaMeet AI Service",
    description=(
        "Unified Speech-to-Speech Translation Pipeline — "
        "Whisper-small (STT) · NLLB-200-600M (NMT) · gTTS / XTTS-v2 (TTS)"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — wildcard + credentials is forbidden by spec; use allow_origin_regex
# for ngrok tunnels so no manual URL updates are needed on Colab.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health and loaded model configuration."""
    return HealthResponse(
        status="ok",
        service="linguameet-ai-service",
        whisper_model=os.getenv("WHISPER_MODEL", "small"),
        nllb_model=os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M"),
        tts_engine="xtts_v2" if os.getenv("USE_XTTS", "false").lower() == "true" else "gtts",
        device="cuda" if _cuda_available() else "cpu",
        voice_retention_active=os.getenv("USE_XTTS", "false").lower() == "true",
        timestamp=time.time(),
    )


@app.get("/api/languages", response_model=LanguagesResponse)
async def list_languages() -> LanguagesResponse:
    """Return supported language codes and display names for the UI dropdown."""
    return LanguagesResponse(languages=get_supported_languages())


@app.post("/api/process-audio")
async def process_audio(
    audio: UploadFile = File(...),  # type: ignore[assignment]
    meeting_id: str = Form(...),  # type: ignore[assignment]
    user_id: str = Form(...),  # type: ignore[assignment]
    speaker_name: Optional[str] = Form("Anonymous"),  # type: ignore[assignment]
    source_language: Optional[str] = Form(None),  # type: ignore[assignment]
    target_languages: str = Form('["en"]'),  # type: ignore[assignment]
    include_audio: str = Form("true"),  # type: ignore[assignment]
) -> dict:
    """
    Full S2ST pipeline via HTTP multipart form upload.
    Returns transcription, translations, TTS audio (base64), and latency metrics.
    """
    audio_bytes: bytes = await audio.read()

    try:
        targets: list[str] = json.loads(target_languages)
    except (json.JSONDecodeError, ValueError):
        targets = ["en"]

    try:
        return engine.process(
            audio_bytes=audio_bytes,
            target_languages=targets,
            source_language=source_language,
            user_id=user_id,
            speaker_name=speaker_name or "Anonymous",
            meeting_id=meeting_id,
            include_audio=include_audio.strip().lower() == "true",
        )
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {
            "error": str(exc),
            "original_text": "[Pipeline Error]",
            "source_language": "unknown",
            "translations": {},
            "audio_translations": {},
            "speaker_id": user_id,
            "meeting_id": meeting_id,
            "timestamp": time.time(),
            "latency": {"asr_seconds": 0, "nmt_seconds": 0, "tts_seconds": 0, "total_seconds": 0},
            "voice_retention": {"enabled": False, "engine": "xtts_v2", "status": "error"},
        }



# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/process-audio")
async def websocket_process_audio(websocket: WebSocket) -> None:
    """
    Real-time bi-directional WebSocket for audio streaming.

    Client sends JSON:
        {
            "audio_base64": "<base64 audio bytes>",
            "meeting_id": "...",
            "user_id": "...",
            "source_language": "auto",
            "target_languages": ["hi", "fr"],
            "include_audio": true
        }

    Server responds with the full pipeline result as JSON.
    """
    await websocket.accept()
    print(f"🔌 WebSocket connected: {websocket.client}")

    try:
        while True:
            raw: str = await websocket.receive_text()

            try:
                payload: dict = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON payload."})
                continue

            audio_b64: str = payload.get("audio_base64", "")
            if not audio_b64:
                await websocket.send_json({"error": "Missing 'audio_base64' in payload."})
                continue

            try:
                audio_bytes = base64.b64decode(audio_b64)
            except Exception:
                await websocket.send_json({"error": "Invalid base64 audio data."})
                continue

            result = engine.process(
                audio_bytes=audio_bytes,
                target_languages=payload.get("target_languages", ["en"]),
                source_language=payload.get("source_language"),
                user_id=payload.get("user_id", "unknown"),
                speaker_name=payload.get("speaker_name", "Anonymous"),
                meeting_id=payload.get("meeting_id", "unknown"),
                include_audio=payload.get("include_audio", True),
            )

            await websocket.send_json(result)

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected: {websocket.client}")
    except Exception as exc:
        print(f"⚠️  WebSocket error: {exc}")
        try:
            await websocket.send_json({"error": str(exc)})
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Interactive Test Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/demo", response_class=HTMLResponse)
async def demo_dashboard() -> Any:
    """
    Standalone web UI to test the full S2ST pipeline.
    Open http://localhost:8000/demo (local) or <ngrok-url>/demo (Colab).
    """
    langs = get_supported_languages()
    lang_options = "\n".join(
        f'<option value="{c}">{n} ({c})</option>' for c, n in langs.items()
    )
    lang_checkboxes = "\n".join(
        f'<label class="lc"><input type="checkbox" value="{c}"'
        f'{" checked" if c in ("hi","fr","es") else ""}> {n}</label>'
        for c, n in langs.items()
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LinguaMeet — AI Test Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
:root{{
  --bg:#0a0a0f;--surface:#12121a;--card:#1a1a26;--border:#2a2a3e;
  --accent:#7c5cfc;--accent2:#5ce0e6;--success:#4ade80;
  --danger:#f87171;--text:#e8e8f0;--muted:#8888a8;--r:14px;
}}
body{{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:24px}}
h1{{font-size:1.9rem;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--accent2));
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}}
.sub{{color:var(--muted);font-size:.9rem;margin-bottom:32px;text-align:center}}
.badge{{display:inline-block;padding:2px 9px;border-radius:999px;font-size:.73rem;font-weight:600;
        background:rgba(124,92,252,.15);color:var(--accent);border:1px solid rgba(124,92,252,.3)}}
header{{text-align:center;margin-bottom:32px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1180px;margin:0 auto}}
@media(max-width:780px){{.grid{{grid-template-columns:1fr}}}}
.card{{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:22px}}
.card h2{{font-size:.95rem;font-weight:600;color:var(--accent2);margin-bottom:16px}}
label.field{{display:block;font-size:.8rem;font-weight:500;color:var(--muted);margin:12px 0 5px}}
label.field:first-child{{margin-top:0}}
select,input[type=text]{{width:100%;background:var(--surface);border:1px solid var(--border);
  color:var(--text);padding:9px 13px;border-radius:8px;font-size:.88rem;font-family:inherit;
  outline:none;transition:border-color .2s}}
select:focus,input:focus{{border-color:var(--accent)}}
.lang-wrap{{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px}}
.lc{{display:flex;align-items:center;gap:5px;background:var(--surface);border:1px solid var(--border);
     border-radius:8px;padding:5px 9px;cursor:pointer;font-size:.8rem;transition:border-color .15s}}
.lc:hover{{border-color:var(--accent)}}
.lc input{{accent-color:var(--accent);cursor:pointer}}
.dz{{border:2px dashed var(--border);border-radius:10px;padding:28px;text-align:center;
    color:var(--muted);font-size:.83rem;cursor:pointer;transition:all .2s;margin-top:6px}}
.dz:hover,.dz.dragover{{border-color:var(--accent);background:rgba(124,92,252,.05)}}
.dz.has-file{{border-color:var(--success);color:var(--success)}}
.btn{{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:10px;
     font-size:.88rem;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:inherit}}
.btn-primary{{background:linear-gradient(135deg,var(--accent),#5a3de8);color:#fff;
              width:100%;justify-content:center;margin-top:18px}}
.btn-primary:hover{{opacity:.88;transform:translateY(-1px)}}
.btn-primary:disabled{{opacity:.4;cursor:not-allowed;transform:none}}
.btn-rec{{background:var(--surface);border:1px solid var(--border);color:var(--text);
          padding:9px 16px;border-radius:8px;margin-top:6px;font-family:inherit;font-size:.83rem}}
.btn-rec.on{{border-color:var(--danger);color:var(--danger);animation:pulse 1s infinite}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.6}}}}
.status{{text-align:center;padding:11px;border-radius:10px;margin-top:14px;font-size:.86rem;font-weight:500}}
.s-idle{{background:rgba(136,136,168,.1);color:var(--muted)}}
.s-proc{{background:rgba(124,92,252,.1);color:var(--accent)}}
.s-done{{background:rgba(74,222,128,.1);color:var(--success)}}
.s-err{{background:rgba(248,113,113,.1);color:var(--danger)}}
.rbox{{background:var(--surface);border:1px solid var(--border);border-radius:10px;
       padding:14px;margin-top:12px;font-size:.88rem;line-height:1.6;min-height:52px}}
.rlabel{{font-size:.73rem;font-weight:600;text-transform:uppercase;letter-spacing:.07em;
         color:var(--muted);margin-bottom:7px}}
.lr{{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:13px;margin-top:9px}}
.lrh{{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}}
.pill{{background:rgba(92,224,230,.12);color:var(--accent2);border-radius:999px;
       padding:2px 9px;font-size:.76rem;font-weight:600}}
.metrics{{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}}
.metric{{flex:1;min-width:72px;background:var(--surface);border:1px solid var(--border);
         border-radius:8px;padding:9px;text-align:center}}
.mv{{font-size:1.15rem;font-weight:700;color:var(--accent)}}
.ml{{font-size:.7rem;color:var(--muted);margin-top:3px}}
.spin{{display:inline-block;width:14px;height:14px;border:2px solid rgba(124,92,252,.3);
       border-top-color:var(--accent);border-radius:50%;animation:sp .7s linear infinite}}
@keyframes sp{{to{{transform:rotate(360deg)}}}}
audio{{width:100%;margin-top:7px;border-radius:8px}}
</style>
</head>
<body>
<header>
  <h1>🌐 LinguaMeet AI Service</h1>
  <p class="sub">Test Dashboard — Whisper-small · NLLB-200-600M · gTTS <span class="badge">v2.0</span></p>
</header>
<div class="grid">
  <div>
    <div class="card">
      <h2>🎙️ Audio Input</h2>
      <label class="field">Source Language</label>
      <select id="srcLang">
        <option value="auto">🔍 Auto-detect (Whisper)</option>
        {lang_options}
      </select>
      <label class="field">Target Languages</label>
      <div class="lang-wrap" id="tgtBoxes">{lang_checkboxes}</div>
      <label class="field" style="margin-top:18px">Record from Microphone</label>
      <div>
        <button class="btn btn-rec" id="recBtn" onclick="toggleRec()">⏺ Start Recording</button>
        <span id="recTimer" style="margin-left:9px;color:var(--muted);font-size:.8rem"></span>
      </div>
      <label class="field" style="margin-top:18px">— or — Upload Audio File</label>
      <div class="dz" id="dz" onclick="document.getElementById('af').click()">
        <div>📂 Click or drag &amp; drop audio file</div>
        <div style="font-size:.76rem;margin-top:3px">WAV · MP3 · WebM · OGG · M4A</div>
        <input type="file" id="af" accept="audio/*" style="display:none" onchange="onFile(this)"/>
      </div>
      <label class="field">Meeting ID</label>
      <input type="text" id="meetingId" value="demo-meeting-001"/>
      <label class="field">User / Speaker ID</label>
      <input type="text" id="userId" value="speaker-01"/>
      <button class="btn btn-primary" id="goBtn" onclick="run()" disabled>🚀 Translate Speech</button>
      <div class="status s-idle" id="statusBar">Ready — record or upload audio, then click Translate.</div>
    </div>
  </div>
  <div>
    <div class="card">
      <h2>📝 Transcription (Whisper-small)</h2>
      <div class="rbox">
        <div class="rlabel">Detected Language: <span id="detLang" style="color:var(--accent2)">—</span></div>
        <div id="sttOut" style="color:var(--muted);font-style:italic">Transcription appears here…</div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>🌐 Translations (NLLB-200) + 🔈 Audio (gTTS)</h2>
      <div id="tOut" style="color:var(--muted);font-style:italic;font-size:.88rem">Translations appear here after processing…</div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>⚡ Pipeline Latency</h2>
      <div class="metrics">
        <div class="metric"><div class="mv" id="mSTT">—</div><div class="ml">STT</div></div>
        <div class="metric"><div class="mv" id="mNMT">—</div><div class="ml">NMT</div></div>
        <div class="metric"><div class="mv" id="mTTS">—</div><div class="ml">TTS</div></div>
        <div class="metric"><div class="mv" id="mTOT">—</div><div class="ml">Total</div></div>
      </div>
    </div>
  </div>
</div>
<script>
let blob=null,mr=null,chunks=[],ri=null,rs=0,rec=false;
const dz=document.getElementById('dz');
dz.addEventListener('dragover',e=>{{e.preventDefault();dz.classList.add('dragover')}});
dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
dz.addEventListener('drop',e=>{{e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0])}});
function onFile(i){{if(i.files[0])setFile(i.files[0])}}
function setFile(f){{blob=f;dz.classList.add('has-file');dz.innerHTML=`<div>✅ ${{f.name}}</div><div style="font-size:.76rem;margin-top:3px">${{(f.size/1024).toFixed(1)}} KB</div>`;document.getElementById('goBtn').disabled=false}}
async function toggleRec(){{rec?stopRec():await startRec()}}
async function startRec(){{
  try{{
    const s=await navigator.mediaDevices.getUserMedia({{audio:true}});
    chunks=[];mr=new MediaRecorder(s);
    mr.ondataavailable=e=>chunks.push(e.data);
    mr.onstop=()=>{{blob=new Blob(chunks,{{type:'audio/webm'}});s.getTracks().forEach(t=>t.stop());document.getElementById('goBtn').disabled=false;const b=document.getElementById('recBtn');b.textContent=`✅ Recorded ${{rs}}s`;b.classList.remove('on')}};
    mr.start();rec=true;rs=0;const b=document.getElementById('recBtn');b.textContent='⏹ Stop Recording';b.classList.add('on');
    ri=setInterval(()=>{{rs++;document.getElementById('recTimer').textContent=rs+'s'}},1000);
  }}catch(e){{setStatus('err','Mic error: '+e.message)}}
}}
function stopRec(){{if(mr&&rec){{mr.stop();rec=false;clearInterval(ri);document.getElementById('recTimer').textContent=''}}}}
async function run(){{
  if(!blob){{setStatus('err','No audio selected.');return}}
  const tgts=[...document.querySelectorAll('#tgtBoxes input:checked')].map(c=>c.value);
  if(!tgts.length){{setStatus('err','Select at least one target language.');return}}
  setStatus('proc','<span class="spin"></span>&nbsp; Processing… Whisper → NLLB → gTTS');
  document.getElementById('goBtn').disabled=true;
  const fd=new FormData();
  fd.append('audio',blob,'audio.webm');
  fd.append('meeting_id',document.getElementById('meetingId').value||'demo');
  fd.append('user_id',document.getElementById('userId').value||'user');
  fd.append('source_language',document.getElementById('srcLang').value==='auto'?'':document.getElementById('srcLang').value);
  fd.append('target_languages',JSON.stringify(tgts));
  fd.append('include_audio','true');
  try{{
    const res=await fetch('/api/process-audio',{{method:'POST',body:fd}});
    if(!res.ok)throw new Error('HTTP '+res.status+': '+await res.text());
    showResults(await res.json());setStatus('done','✅ Pipeline complete!');
  }}catch(e){{setStatus('err','❌ '+e.message)}}
  finally{{document.getElementById('goBtn').disabled=false}}
}}
function showResults(d){{
  document.getElementById('detLang').textContent=(d.source_language||'?').toUpperCase();
  const so=document.getElementById('sttOut');so.textContent=d.original_text||'(no speech detected)';so.style.fontStyle='normal';so.style.color='var(--text)';
  const tc=document.getElementById('tOut');tc.innerHTML='';
  for(const[code,txt]of Object.entries(d.translations||{{}})){{
    const a=d.audio_translations&&d.audio_translations[code];
    const aHtml=a&&a.audio_base64?`<audio controls src="data:${{a.mime_type}};base64,${{a.audio_base64}}"></audio>`:'';
    const div=document.createElement('div');div.className='lr';
    div.innerHTML=`<div class="lrh"><span class="pill">${{code.toUpperCase()}}</span><span style="font-size:.76rem;color:var(--muted)">${{a?.engine||'gtts'}}</span></div><div style="font-size:.88rem">${{txt||'<em style="color:var(--muted)">empty</em>'}}</div>${{aHtml}}`;
    tc.appendChild(div);
  }}
  const lat=d.latency||{{}};
  document.getElementById('mSTT').textContent=lat.asr_seconds!=null?lat.asr_seconds.toFixed(2)+'s':'—';
  document.getElementById('mNMT').textContent=lat.nmt_seconds!=null?lat.nmt_seconds.toFixed(2)+'s':'—';
  document.getElementById('mTTS').textContent=lat.tts_seconds!=null?lat.tts_seconds.toFixed(2)+'s':'—';
  document.getElementById('mTOT').textContent=lat.total_seconds!=null?lat.total_seconds.toFixed(2)+'s':'—';
}}
function setStatus(t,m){{const b=document.getElementById('statusBar');b.className='status s-'+t;b.innerHTML=m}}
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


if __name__ == "__main__":
    try:
        import uvicorn  # type: ignore
        uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
    except ImportError:
        print("uvicorn not installed. Run: pip install 'uvicorn[standard]'")
