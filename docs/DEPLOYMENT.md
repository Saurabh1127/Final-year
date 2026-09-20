# DEPLOYMENT.md — Deployment & Operations Guide

# SAMVADA — Deployment & Operations

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [ARCHITECTURE.md](file:///c:/Final%20Year/Final-year/docs/ARCHITECTURE.md), [SECURITY.md](file:///c:/Final%20Year/Final-year/docs/SECURITY.md)

---

## 1. Services Overview

SAMVADA consists of three independently deployable services:

| Service | Runtime | Port | GPU Required | Stateful |
|---|---|---|---|---|
| **Client** | Static files (Vite build) | 5173 (dev) | No | No |
| **Server** | Node.js 20+ | 5000 | No | Yes (Socket.IO connections) |
| **AI Service** | Python 3.10+ | 8000 | Yes (recommended) | Yes (loaded ML models) |

---

## 2. Local Development Setup

### 2.1 Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Server + client |
| npm | 9+ | Package management |
| Python | 3.10+ | AI service (Colab alternative) |
| MongoDB Atlas account | — | Database |
| Google Colab (free) | — | GPU compute for AI service |

### 2.2 Client Setup

```powershell
cd client
npm install
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_AI_SERVICE_URL=<ngrok-url-from-colab>
```

Start dev server:
```powershell
npm run dev
# → Vite dev server at http://localhost:5173
```

### 2.3 Server Setup

```powershell
cd server
npm install
```

Create `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
JWT_SECRET=<generate-with-crypto.randomBytes(64).toString('hex')>
AI_SERVICE_URL=<ngrok-url-from-colab>
GEMINI_API_KEY=<your-gemini-api-key>
METERED_API_KEY=<your-metered-api-key>
```

Start dev server:
```powershell
npm run dev
# → Express + Socket.IO at http://localhost:5000
```

### 2.4 AI Service Setup (Google Colab)

**Detailed guide**: [`ai-service/COLAB_INTEGRATION_GUIDE.md`](file:///c:/Final%20Year/Final-year/ai-service/COLAB_INTEGRATION_GUIDE.md)

Summary:
1. Open a new Google Colab notebook with GPU runtime (T4)
2. Clone the repository or upload `ai-service/` directory
3. Install dependencies:
```python
!pip install fastapi uvicorn python-multipart torch transformers openai-whisper \
    edge-tts gTTS pyngrok python-dotenv pydantic
```
4. Set up Ngrok tunnel:
```python
from pyngrok import ngrok
ngrok.set_auth_token("<your-ngrok-auth-token>")
tunnel = ngrok.connect(8000, "http")
print(f"AI Service URL: {tunnel.public_url}")
```
5. Start the server:
```python
!cd ai-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
6. Copy the Ngrok URL to `VITE_AI_SERVICE_URL` (client) and `AI_SERVICE_URL` (server)

### 2.5 Concurrent Startup (Root-level)

```powershell
# From repository root
npm run dev
# Uses concurrently to start both client and server
```

**`package.json` scripts** (root):
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "install:all": "npm install --prefix server && npm install --prefix client"
  }
}
```

---

## 3. Environment Variables Reference

### 3.1 Client (`client/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5000` | Node.js server URL |
| `VITE_AI_SERVICE_URL` | Yes | `https://abc123.ngrok-free.app` | AI service URL (Ngrok for Colab) |

### 3.2 Server (`server/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP server port |
| `MONGO_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/samvada` | MongoDB connection string |
| `JWT_SECRET` | Yes | `a3f8c2...` (64-byte hex) | JWT signing secret |
| `AI_SERVICE_URL` | Yes | `https://abc123.ngrok-free.app` | AI service URL |
| `GEMINI_API_KEY` | Yes | `AIza...` | Google Gemini API key |
| `METERED_API_KEY` | Yes* | `abc123...` | Metered TURN API key (*after Phase 0) |

### 3.3 AI Service (`ai-service/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `WHISPER_MODEL` | No | `small` | Whisper model size |
| `NLLB_MODEL` | No | `facebook/nllb-200-distilled-600M` | NLLB model identifier |
| `USE_SARVAM` | No | `false` | Enable Sarvam AI TTS |
| `SARVAM_API_KEY` | If USE_SARVAM | `sk_...` | Sarvam AI API key |
| `USE_XTTS` | No | `false` | Enable XTTS-v2 (non-functional) |

---

## 4. Production Deployment

### 4.1 Option A: Platform-as-a-Service

| Service | Platform | Tier | Cost |
|---|---|---|---|
| Client (static) | Vercel / Netlify / Cloudflare Pages | Free | $0 |
| Server (Node.js) | Railway / Render / DigitalOcean App Platform | Starter ($5-7/mo) | ~$7/mo |
| AI Service (GPU) | RunPod (persistent pod, T4) | Community | ~$144/mo |
| Database | MongoDB Atlas | M0 (free) or M10 ($57/mo) | $0-57/mo |
| TURN Server | Metered.ca | Free tier (500GB/mo) | $0 |

**Total MVP cost**: ~$7/mo (server) + $0 (free AI via Colab) = **$7/mo**  
**Total with dedicated GPU**: ~$7 + $144 + $0 = **$151/mo**

### 4.2 Option B: Docker Compose (Self-hosted or VPS)

> [!NOTE]
> Docker files do not exist yet. They are planned for Phase 11.

**Planned `docker-compose.yml` structure**:
```yaml
version: '3.8'
services:
  client:
    build: ./client
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://server:5000
    depends_on:
      - server

  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=${MONGO_URI}
      - JWT_SECRET=${JWT_SECRET}
      - AI_SERVICE_URL=http://ai-service:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - METERED_API_KEY=${METERED_API_KEY}
    depends_on:
      - ai-service

  ai-service:
    build: ./ai-service
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - WHISPER_MODEL=small
      - NLLB_MODEL=facebook/nllb-200-distilled-600M
```

### 4.3 Client Build

```powershell
cd client
npm run build
# Output: dist/ directory with static files
```

**Vite production build** generates:
- `dist/index.html` — entry point
- `dist/assets/` — bundled JS, CSS, images
- Optimized, minified, tree-shaken

Serve with any static file server (Nginx, Caddy, Cloudflare Pages, Vercel).

### 4.4 Server Production

**Process manager**: PM2 (recommended)

```powershell
npm install -g pm2

# Start
pm2 start server.js --name samvada-server

# Cluster mode (multiple instances)
pm2 start server.js --name samvada-server -i max

# Auto-restart on crash
pm2 startup
pm2 save
```

**PM2 ecosystem file** (`ecosystem.config.js` — TO BE CREATED):
```javascript
module.exports = {
  apps: [{
    name: 'samvada-server',
    script: 'server.js',
    instances: 1,           // Single instance for Socket.IO (no Redis)
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    max_memory_restart: '512M',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
  }],
};
```

> [!IMPORTANT]
> Socket.IO requires sticky sessions or a Redis adapter for multiple Node.js instances. For MVP (single instance), fork mode is sufficient. For scaling, add `socket.io-redis` adapter.

---

## 5. AI Service Deployment (Dedicated GPU)

### 5.1 RunPod (Recommended for Persistent GPU)

1. Create a RunPod account
2. Deploy a **Community Cloud** pod:
   - GPU: NVIDIA T4 (16GB VRAM)
   - Container: `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`
   - Disk: 20GB
   - Expose port 8000
3. SSH into the pod:
```bash
git clone <repo-url>
cd Final-year/ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
4. RunPod provides a public URL for the exposed port
5. Set `AI_SERVICE_URL` to the RunPod URL

**Cost**: ~$0.20/hr (T4 Community) = ~$144/mo if running 24/7

### 5.2 Google Colab (Free, Ephemeral)

See Section 2.4 above. Limitations:
- Session times out after ~12 hours of inactivity
- GPU availability not guaranteed
- Ngrok URL changes every session
- Requires manual restart

**Use for**: Development, demos, thesis evaluation

### 5.3 Local GPU (If Available)

If the development machine has an NVIDIA GPU with ≥4GB VRAM:
```powershell
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Set `AI_SERVICE_URL=http://localhost:8000` in both client and server `.env`.

---

## 6. MongoDB Atlas Setup

### 6.1 Free Tier (M0)

1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free M0 cluster
3. Create a database user with password
4. Whitelist IP addresses (or `0.0.0.0/0` for development)
5. Get connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/samvada`
6. Set as `MONGO_URI` in `server/.env`

**M0 Limits**:
- 512 MB storage
- 500 connections
- Shared infrastructure
- No encryption at rest (M10+ required)

### 6.2 Collections Created Automatically

Mongoose creates collections on first document insertion:
- `users` — on first registration
- `meetings` — on first meeting creation
- `transcripts` — on first transcript save

No manual collection creation required.

---

## 7. Metered TURN Server

### 7.1 Setup

1. Create account at [metered.ca](https://www.metered.ca)
2. Create an application (e.g., "samvada")
3. Get API key from dashboard
4. Set as `METERED_API_KEY` in `server/.env` (after Phase 0 moves it from client)

### 7.2 Free Tier Limits

- 500 GB/month relay bandwidth
- Sufficient for development and small-scale use
- Overage: $0.10/GB

---

## 8. Monitoring & Health Checks

### 8.1 Health Endpoints

| Service | Endpoint | What It Checks |
|---|---|---|
| Server | `GET /api/health` | Express is running |
| AI Service | `GET /health` | FastAPI + model status |

### 8.2 Recommended Monitoring (Post-MVP)

| Tool | Purpose | Cost |
|---|---|---|
| PM2 Dashboard | Node.js process monitoring | Free (local) |
| UptimeRobot | HTTP uptime monitoring | Free (50 monitors) |
| MongoDB Atlas Monitoring | Database metrics | Free (basic) |
| Console JSON logs + grep | Log analysis | Free |

---

## 9. Troubleshooting

### 9.1 Common Issues

| Problem | Cause | Solution |
|---|---|---|
| "AI service URL undefined" on startup | `AI_SERVICE_URL` not set in `.env` | Set the Ngrok/RunPod URL in `server/.env` |
| CORS error on client | Server CORS not configured for client URL | Add client URL to CORS `origin` array |
| "Authentication error: Token missing" on Socket.IO | Token not passed in handshake | Ensure `auth: { token }` in Socket.IO client options |
| Ngrok URL changed | Colab session restarted | Copy new Ngrok URL to both `.env` files, restart server |
| "torch not installed" in AI service | Running locally without GPU setup | Use Colab instead, or `pip install torch` |
| First AI request is very slow (~30s) | Models loading into memory | Normal on cold start. Subsequent requests are fast. |
| WebRTC video not showing | TURN server credentials invalid or expired | Check Metered API key, verify TURN endpoint |
| MongoDB connection timeout | IP not whitelisted in Atlas | Add current IP or `0.0.0.0/0` in Atlas Network Access |

### 9.2 Log Locations

| Service | Log Source | Access |
|---|---|---|
| Client | Browser developer console | F12 → Console tab |
| Server | stdout/stderr (console.log) | Terminal running `npm run dev` |
| Server (PM2) | `~/.pm2/logs/` | `pm2 logs samvada-server` |
| AI Service | stdout (uvicorn) | Terminal or Colab output cell |
| MongoDB | Atlas Dashboard → Activity tab | MongoDB Atlas web UI |

---

## 10. Backup & Recovery

### 10.1 Database Backup

MongoDB Atlas M0 does not support point-in-time backups. Options:
- **Manual export**: `mongodump --uri="<MONGO_URI>" --out=./backup/`
- **Atlas M10+**: Automated daily backups
- For thesis: manual export before demo

### 10.2 Code

- Git repository is the single source of truth
- Ensure `.env` files are documented in `.env.example` (not committed)
- Tag releases before demos: `git tag v1.0-demo`

### 10.3 AI Models

Models are downloaded from HuggingFace Hub on first load and cached locally. No backup needed — they can be re-downloaded.
