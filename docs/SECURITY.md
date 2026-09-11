# SECURITY.md — Security Audit & Hardening Plan

# LinguaMeet — Security Specification

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Cross-references**: [ARCHITECTURE.md](file:///c:/Final%20Year/Final-year/docs/ARCHITECTURE.md), [API.md](file:///c:/Final%20Year/Final-year/docs/API.md)

---

## 1. Current Security Posture

**Overall assessment: ⚠️ NOT production-ready.**

The codebase has foundational security (password hashing, JWT auth, protected routes) but contains multiple vulnerabilities ranging from exposed API keys to missing input validation.

---

## 2. Vulnerability Inventory

### 2.1 Critical (Must Fix Before Any Deployment)

| ID | Vulnerability | Severity | File | Line(s) | Description |
|---|---|---|---|---|---|
| SEC-01 | **TURN API key in client JS** | 🔴 CRITICAL | [`useWebRTC.js`](file:///c:/Final%20Year/Final-year/client/src/hooks/useWebRTC.js) | 23-24 | Metered API key hardcoded in client-side JavaScript. Anyone can extract it from the browser dev tools and use it to generate TURN credentials, consuming bandwidth quota. |
| SEC-02 | **Sarvam API key hardcoded** | 🔴 CRITICAL | [`colab_test.py`](file:///c:/Final%20Year/Final-year/ai-service/colab_test.py) | 85 | Sarvam AI key `sk_up7c1rdn_zGiuPp7vz1uMyxcjbvVVJ7Fc` is committed in plain text. Anyone with repo access can use this paid API key. |

### 2.2 High (Fix in Phase 0)

| ID | Vulnerability | Severity | File | Line(s) | Description |
|---|---|---|---|---|---|
| SEC-03 | **CORS allows all origins** | 🟠 HIGH | [`server.js`](file:///c:/Final%20Year/Final-year/server/server.js) | 18-21 | `cors({ origin: true })` accepts requests from any origin. |
| SEC-04 | **CORS allows all origins (AI)** | 🟠 HIGH | [`main.py`](file:///c:/Final%20Year/Final-year/ai-service/app/main.py) | 120-126 | `allow_origins=["*"]` on FastAPI. |
| SEC-05 | **No rate limiting** | 🟠 HIGH | [`auth.js`](file:///c:/Final%20Year/Final-year/server/routes/auth.js) | — | Auth endpoints (register, login) have no rate limiting. Allows brute-force password attacks. |
| SEC-06 | **JWT secret may be weak** | 🟠 HIGH | `server/.env` | — | JWT secret strength unknown. If it's a simple string (e.g., "mysecret"), tokens can be forged. |
| SEC-07 | **No security headers** | 🟠 HIGH | [`server.js`](file:///c:/Final%20Year/Final-year/server/server.js) | — | No `helmet` middleware. Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. |

### 2.3 Medium

| ID | Vulnerability | Severity | File | Description |
|---|---|---|---|---|
| SEC-08 | **MongoDB credentials in .env** | 🟡 MEDIUM | `server/.env` | If `.env` was ever committed to version control, credentials are in git history. |
| SEC-09 | **Gemini API key in .env** | 🟡 MEDIUM | `server/.env` | Same concern as SEC-08. |
| SEC-10 | **No input length validation** | 🟡 MEDIUM | [`transcriptRoutes.js`](file:///c:/Final%20Year/Final-year/server/routes/transcriptRoutes.js) | `originalText` field accepts arbitrarily long strings. Could be abused for storage exhaustion. |
| SEC-11 | **No meeting access control** | 🟡 MEDIUM | [`meetings.js`](file:///c:/Final%20Year/Final-year/server/routes/meetings.js) | Any authenticated user can join any meeting by guessing the room code. No password or invite-only mechanism. |
| SEC-12 | **Socket.IO event validation** | 🟡 MEDIUM | [`meetingHandlers.js`](file:///c:/Final%20Year/Final-year/server/socket/meetingHandlers.js) | Socket events don't validate that the emitting user is actually a participant of the room they're targeting. |

### 2.4 Low

| ID | Vulnerability | Severity | File | Description |
|---|---|---|---|---|
| SEC-13 | **Room codes are guessable** | 🟢 LOW | [`Meeting.js`](file:///c:/Final%20Year/Final-year/server/models/Meeting.js) | 10-char lowercase alpha code = 26^10 ≈ 141 trillion combinations. Low risk but no rate limiting on code entry attempts. |
| SEC-14 | **No XSS sanitization** | 🟢 LOW | — | User-provided text (names, transcript text) is rendered in React, which auto-escapes JSX. However, if any `dangerouslySetInnerHTML` is used, XSS is possible. Currently safe (no raw HTML rendering found). |
| SEC-15 | **No CSRF protection** | 🟢 LOW | — | JWT Bearer auth is inherently CSRF-resistant (not sent in cookies). Currently safe. |

---

## 3. Authentication Security

### 3.1 Current Implementation

| Feature | Status | Details |
|---|---|---|
| Password hashing | ✅ | bcrypt with salt round 10 |
| Password minimum length | ✅ | 6 characters |
| JWT signing | ✅ | HS256, 7-day expiry |
| Token in Authorization header | ✅ | `Bearer <token>` |
| Token in Socket.IO handshake | ✅ | `auth.token` |
| Password field excluded from queries | ✅ | Mongoose `select: false` |
| Email uniqueness | ✅ | Unique index, case-insensitive |

### 3.2 Missing Security Features

| Feature | Status | Priority |
|---|---|---|
| Refresh tokens | ❌ | Post-MVP |
| Token revocation / blacklist | ❌ | Post-MVP |
| Email verification | ❌ | Post-MVP |
| Password reset flow | ❌ | Post-MVP |
| Account lockout after failed attempts | ❌ | Phase 0 (via rate limiting) |
| Password complexity requirements | ❌ | Nice to have |
| Session invalidation on password change | ❌ | Post-MVP |

---

## 4. Data Security

### 4.1 Data at Rest

| Data | Encrypted | Notes |
|---|---|---|
| Passwords in MongoDB | ✅ (hashed) | bcrypt with salt |
| User data in MongoDB | ⚠️ | MongoDB Atlas encrypts at rest by default (AES-256 for M10+). M0 free tier may not encrypt. |
| Transcripts in MongoDB | ⚠️ | Same as above |
| JWT secret in .env | ❌ | Plain text in env file |
| API keys in .env | ❌ | Plain text in env file |

### 4.2 Data in Transit

| Path | Encrypted | Notes |
|---|---|---|
| Client ↔ Server (dev) | ❌ | HTTP, not HTTPS |
| Client ↔ Server (prod) | ✅ | HTTPS via deployment platform |
| WebRTC media (P2P) | ✅ | DTLS/SRTP (always encrypted) |
| Server ↔ MongoDB Atlas | ✅ | TLS/SSL (Atlas enforces) |
| Server ↔ AI Service (Ngrok) | ✅ | HTTPS (Ngrok tunnel) |
| Server ↔ Gemini API | ✅ | HTTPS |
| AI Service ↔ Edge TTS | ✅ | HTTPS |

### 4.3 Audio Data Privacy

| Concern | Current State |
|---|---|
| Audio stored on server | ❌ No — audio chunks are transient (processed and discarded) |
| Audio stored on AI service | ❌ No — written to temp file, processed, deleted |
| Transcripts stored permanently | ✅ Yes — in MongoDB (by design, for meeting summary) |
| Audio sent to external APIs | ⚠️ Edge TTS and gTTS receive translated TEXT (not audio). Whisper runs locally. |
| User consent for recording | ❌ Not implemented — no consent flow |

---

## 5. Remediation Plan

### Phase 0: Immediate Fixes

| Task | Addresses | Implementation |
|---|---|---|
| **Move TURN key to server** | SEC-01 | Create `GET /api/turn-credentials` proxy endpoint. Move `METERED_API_KEY` to `server/.env`. Update `useWebRTC.js` to fetch from own backend. |
| **Rotate all exposed keys** | SEC-01, SEC-02, SEC-08, SEC-09 | Generate new keys for Metered, Sarvam, MongoDB, Gemini. Update `.env` files. |
| **Remove hardcoded Sarvam key** | SEC-02 | Replace hardcoded key in `colab_test.py` with env var reference. |
| **Generate strong JWT secret** | SEC-06 | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| **Add `.env.example` files** | SEC-08, SEC-09 | Create `.env.example` for server, client, ai-service with placeholder values. |
| **Restrict CORS** | SEC-03, SEC-04 | Server: `origin: ['http://localhost:5173', '<production-domain>']`. AI: keep `"*"` if accessed only by server. |
| **Add Helmet.js** | SEC-07 | `app.use(helmet())` — sets security headers. |
| **Add rate limiting** | SEC-05 | `app.use('/api/auth', rateLimit({ windowMs: 60000, max: 5 }))` |
| **Add input validation** | SEC-10 | Validate `originalText.length ≤ 5000`, `title.length ≤ 100`, `name.length ≤ 50`. |
| **Verify .gitignore** | SEC-08 | Ensure `.env` files are in `.gitignore` for all three services. |

### Post-MVP: Additional Hardening

| Task | Addresses | Phase |
|---|---|---|
| Meeting access validation on Socket events | SEC-12 | Phase 9 |
| Meeting password / invite-only option | SEC-11 | Post-MVP |
| Refresh token rotation | — | Post-MVP |
| Email verification | — | Post-MVP |
| Content Security Policy header | — | Post-MVP |
| Audit logging (who accessed what) | — | Post-MVP |

---

## 6. Dependency Security

### 6.1 Node.js Dependencies (server)

| Package | Version | Known Vulnerabilities |
|---|---|---|
| express | 4.x | None known for latest 4.x |
| jsonwebtoken | 9.x | None known |
| bcryptjs | 2.x | None known |
| mongoose | 8.x | None known |
| socket.io | 4.7.5 | None known |
| axios | 1.x | None known |
| cors | 2.x | None known |
| dotenv | 16.x | None known |

**Recommendation**: Run `npm audit` regularly and before each deployment.

### 6.2 Python Dependencies (ai-service)

| Package | Version | Notes |
|---|---|---|
| fastapi | 0.100+ | Well-maintained, no known issues |
| openai-whisper | latest | Academic project, infrequent updates |
| transformers | 4.x | Active development |
| edge-tts | latest | Unofficial library — uses undocumented Microsoft API |
| gTTS | latest | Uses Google Translate endpoint without official API key |
| torch | 2.x | Large dependency, well-maintained |

> [!WARNING]
> `edge-tts` and `gTTS` both use undocumented public APIs. These could be rate-limited or discontinued by Microsoft/Google at any time without notice. There is no SLA.

---

## 7. Threat Model (Simplified)

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brute-force login | Medium | Medium | Rate limiting (Phase 0) |
| API key theft from client code | High (currently) | High | Move keys to server (Phase 0) |
| Meeting eavesdropping (guessing room code) | Low | Medium | Rate limit join attempts, optional meeting password (Post-MVP) |
| XSS via transcript text | Low | Medium | React auto-escapes; no raw HTML rendering |
| Audio interception (P2P) | Very Low | High | WebRTC always encrypts media (DTLS/SRTP) |
| MongoDB injection | Low | High | Mongoose parameterizes queries |
| DDoS on server | Medium | High | Rate limiting + cloud provider DDoS protection |
| AI service abuse (free GPU) | Low | Medium | AI service not publicly exposed in target architecture |
