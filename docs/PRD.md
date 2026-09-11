# PRD.md — Product Requirements Document

# LinguaMeet — Real-Time Speech-to-Speech Translation Meeting Platform

**Version**: 1.0-draft  
**Date**: 2026-09-11  
**Status**: Pre-implementation planning

---

## 1. Product Overview

LinguaMeet is a web-based video conferencing platform that provides **real-time speech-to-speech translation** during meetings. Participants speak in their native languages and hear other speakers translated into their preferred language, with both translated audio playback and on-screen subtitles.

### 1.1 Problem Statement

Multilingual meetings require either a shared lingua franca (limiting participation for non-fluent speakers) or professional interpreters (expensive and limited in availability). LinguaMeet automates this by using AI-driven speech recognition, machine translation, and speech synthesis to deliver translations in near real-time.

### 1.2 Target Users

- Distributed teams across language barriers (primary)
- Academic collaboration groups (final-year thesis context)
- Informal multilingual conversations

### 1.3 Product Goal

Enable two or more people who speak different languages to have a natural conversation via video call, where each person hears the other in their own language.

---

## 2. Functional Requirements

### 2.1 Authentication

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-AUTH-01 | Users can register with name, email, and password | Must Have | ✅ Implemented |
| FR-AUTH-02 | Users can log in with email and password | Must Have | ✅ Implemented |
| FR-AUTH-03 | Sessions persist via JWT with 7-day expiry | Must Have | ✅ Implemented |
| FR-AUTH-04 | Users can set a preferred language at registration | Should Have | ⚠️ Schema exists, no UI |
| FR-AUTH-05 | Refresh tokens for session continuity | Nice to Have | ❌ Not implemented |

### 2.2 Meeting Management

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-MTG-01 | User can create a meeting room (generates shareable code) | Must Have | ✅ Implemented |
| FR-MTG-02 | User can join an existing meeting by room code | Must Have | ✅ Implemented |
| FR-MTG-03 | Meeting page shows all participants with video tiles | Must Have | ✅ Implemented |
| FR-MTG-04 | Host can end the meeting for all participants | Should Have | ❌ Not implemented |
| FR-MTG-05 | Meeting has a maximum participant limit (≤5 MVP, ≤25 V2) | Should Have | ❌ Not enforced |
| FR-MTG-06 | Room codes follow `abc-defg-hij` format (10 lowercase chars) | Must Have | ✅ Implemented |

### 2.3 Real-Time Communication

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-RTC-01 | Participants can see and hear each other via WebRTC | Must Have | ✅ Implemented (mesh) |
| FR-RTC-02 | User can toggle microphone on/off | Must Have | ✅ Implemented |
| FR-RTC-03 | User can toggle camera on/off | Must Have | ✅ Implemented |
| FR-RTC-04 | Active speaker is visually highlighted | Should Have | ✅ Implemented (glow effect) |
| FR-RTC-05 | Participant name and language badge shown on video tile | Must Have | ✅ Implemented |

### 2.4 Translation (Core Feature)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-TL-01 | **Speaker A's speech is translated and played as audio to Speaker B in B's preferred language** | Must Have | ❌ **Not implemented** — audio plays locally to speaker only |
| FR-TL-02 | **Subtitles of translated text are shown to the listener** | Must Have | ⚠️ Text broadcast exists, subtitle display exists, but only for self-translation |
| FR-TL-03 | User can select their preferred listening language during the meeting | Must Have | ❌ No UI — schema field exists but is not configurable at runtime |
| FR-TL-04 | Translation can be toggled on/off per participant | Must Have | ⚠️ Toggle exists but controls self-translation, not distributed translation |
| FR-TL-05 | Source language is auto-detected from speech (Whisper) | Must Have | ✅ Implemented in AI pipeline |
| FR-TL-06 | System supports ≥10 languages for translation | Must Have | ✅ 12 languages mapped in TTS voice map |
| FR-TL-07 | Bidirectional translation: A→B and B→A work simultaneously | Must Have | ❌ Not implemented as distributed |
| FR-TL-08 | Translation is deduplicated: same language listeners share one translation | Should Have | ❌ Not implemented |
| FR-TL-09 | End-to-end translation latency ≤4s for 80% of utterances | Should Have | ❌ Current estimate: 4-8s |
| FR-TL-10 | Original audio is ducked (reduced volume) when translated audio plays | Should Have | ⚠️ 10% ducking implemented for self-playback only |

### 2.5 Transcription

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-TR-01 | All spoken text is transcribed and saved to the database | Must Have | ✅ Implemented |
| FR-TR-02 | Transcript sidebar shows real-time conversation log | Must Have | ✅ Implemented |
| FR-TR-03 | Each transcript entry shows speaker name, original text, translated text, and timestamp | Must Have | ✅ Implemented |

### 2.6 Meeting Summary

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-SUM-01 | AI-generated executive summary is produced when a meeting ends | Should Have | ✅ Implemented (Gemini 1.5 Flash) |
| FR-SUM-02 | Summary includes key topics and action items | Should Have | ✅ Implemented |
| FR-SUM-03 | Summary page is shown to participants after leaving | Should Have | ✅ Implemented |

---

## 3. Non-Functional Requirements

| ID | Requirement | Target | Status |
|---|---|---|---|
| NFR-01 | Translation latency (end-to-end) | ≤4s (P80), ≤6s (P95) | ❌ Not met — estimated 4-8s |
| NFR-02 | Video/audio latency (WebRTC) | ≤200ms (P95) | ✅ Met (peer-to-peer) |
| NFR-03 | Concurrent participants per meeting | ≤5 (MVP) | ⚠️ Not enforced, works via mesh ≤5 |
| NFR-04 | Browser support | Chrome 80+, Firefox 70+, Safari 14+, Edge 80+ | ⚠️ Safari MediaRecorder issue |
| NFR-05 | Audio quality | 16kHz mono, Opus codec | ✅ Configured |
| NFR-06 | Uptime for AI service | Best effort (Colab-dependent) | ❌ Ephemeral compute |
| NFR-07 | Data persistence | MongoDB Atlas (512MB free tier) | ✅ Configured |
| NFR-08 | Security — no API keys in client code | Required | ❌ TURN key exposed |

---

## 4. Open Product Decisions

These decisions affect the architecture and must be resolved before implementation resumes.

| # | Decision | Recommendation | Status |
|---|---|---|---|
| OD-1 | **Who initiates translation — speaker or listener?** | Listener-initiated: each participant selects their target language and receives translations of all other speakers | **ASSUMPTION: Listener-initiated** |
| OD-2 | **Should original audio be muted, ducked, or unchanged during translation playback?** | Ducked to 20% (configurable); option to fully mute | **ASSUMPTION: Ducked to 20%** |
| OD-3 | **Per-listener or global translation language?** | Per-listener: each participant independently chooses their language | **ASSUMPTION: Per-listener** |
| OD-4 | **Where does translation orchestration happen?** | Server-side: Node.js server receives audio, calls AI service, routes results to listeners | **ASSUMPTION: Server-orchestrated** |
| OD-5 | **Maximum meeting participants?** | 5 for MVP (mesh WebRTC limit), 25 for V2 (requires SFU) | **ASSUMPTION: 5 for MVP** |
| OD-6 | **Automatic or manual translation toggle?** | Manual toggle per participant for MVP | **ASSUMPTION: Manual** |
| OD-7 | **How long are meeting transcripts retained?** | Indefinitely for thesis; TTL-based for production | **ASSUMPTION: No deletion** |

> [!IMPORTANT]
> These are working assumptions, not confirmed product decisions. They are labeled as such in all downstream documents. If the product owner disagrees with any assumption, the affected architecture and implementation phases must be revised.

---

## 5. Out of Scope (MVP)

The following features are explicitly excluded from the MVP and deferred to post-MVP versions:

- Mobile-responsive layout
- Meeting recording and playback
- SFU for >5 participants (mediasoup/LiveKit)
- Voice cloning (XTTS-v2)
- Speaker identification/diarization
- CI/CD pipeline
- Docker containerization
- Admin dashboard
- User analytics
- Email verification
- Password reset flow
- File/screen sharing
- Chat messaging within meeting

---

## 6. Success Criteria

### MVP Done When:
1. Two participants can create/join a meeting
2. They see each other's video and hear original audio
3. When translation is enabled, Speaker A speaks Language X and Speaker B hears synthesized audio in Language Y
4. Subtitles appear on screen for translated speech
5. Bidirectional: both directions work simultaneously
6. Language can be changed during the meeting
7. Meeting summary is generated upon leaving
8. System degrades gracefully when AI service is unavailable (meeting continues, translation disabled)

### Quality Gates:
- Translation latency ≤6s for 80% of utterances
- No crashes during a 15-minute bilingual conversation
- Audio playback does not overlap or queue indefinitely
- All API keys are server-side only
