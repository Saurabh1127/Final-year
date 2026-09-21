# LinguaMeet UI/UX Redesign — Complete Implementation Plan

---

## Part I: Current Frontend Audit

### Repository Architecture

| Layer | Technology | Status |
|-------|-----------|--------|
| Build | Vite 8.1 + React 19 | ✅ Modern, keep |
| Routing | react-router-dom v7 | ✅ Working, keep |
| State | React Context (Auth + Socket) | ✅ Functional, keep |
| HTTP | Axios with JWT interceptor | ✅ Solid, keep |
| Realtime | Socket.IO Client v4 | ✅ Working, keep |
| Media | WebRTC (custom `useWebRTC` hook) | ✅ Working, keep |
| Audio | AudioWorklet-based VAD + WAV capture | ✅ Advanced, keep |
| Translation | `useSpeechTranslation` + `useTranslationReceiver` | ✅ Core feature, keep |
| Styling | Vanilla CSS with CSS custom properties | ✅ Good approach, restyle |
| Icons | Inline SVG | ⚠️ Inconsistent, needs system |
| Design Tokens | CSS variables in `index.css` | ⚠️ Exists but wrong palette |

### Current Route Map

| Route | Page | Component | Status |
|-------|------|-----------|--------|
| `/login` | Login | `pages/Login.jsx` | ✅ Works — needs restyle |
| `/register` | Register | `pages/Register.jsx` | ✅ Works — needs restyle |
| `/` | Home/Dashboard | `pages/Home.jsx` | ✅ Works — needs rebuild |
| `/meeting/:roomCode` | Meeting | `pages/Meeting.jsx` → `MeetingRoom.jsx` | ✅ Works — needs restyle |
| `/summary/:roomCode` | Post-Meeting Summary | `pages/SummaryPage.jsx` | ✅ Works — needs restyle |
| `*` | Redirect to `/` | — | ✅ Works |

### Current Component Inventory

| Component | Location | Action | Reason |
|-----------|----------|--------|--------|
| `AuthContext` | `context/AuthContext.jsx` | **KEEP** | Clean implementation, JWT + localStorage |
| `SocketContext` | `context/SocketContext.jsx` | **KEEP** | Clean Socket.IO management |
| `ProtectedRoute` | `components/Layout/ProtectedRoute.jsx` | **KEEP** | Simple and correct |
| `MeetingRoom` | `components/Meeting/MeetingRoom.jsx` | **REFACTOR** | 777-line monolith — needs decomposition + restyle |
| `ParticipantGrid` | `components/Meeting/ParticipantGrid.jsx` | **RESTYLE** | Logic is correct, layout needs redesign |
| `ParticipantTile` | `components/Meeting/ParticipantTile.jsx` | **RESTYLE** | Good functionality, needs reference-aligned design |
| `ControlBar` | `components/Meeting/ControlBar.jsx` | **RESTYLE** | Working controls, needs redesign to match reference toolbar |
| `LanguageSelector` | `components/Meeting/LanguageSelector.jsx` | **RESTYLE** | Functional but uses inline styles, has language data |
| `PreJoinScreen` | `components/Meeting/PreJoinScreen.jsx` | **REBUILD** | Missing device selectors, language settings, audio test from reference |
| `PipelineInspectorModal` | `components/Meeting/PipelineInspectorModal.jsx` | **RESTYLE** | Diagnostic feature — restyle only |
| `Login` | `pages/Login.jsx` | **RESTYLE** | Logic correct, UI needs reference alignment |
| `Register` | `pages/Register.jsx` | **RESTYLE** | Logic correct, UI needs reference alignment |
| `Home` | `pages/Home.jsx` | **REBUILD** | Currently a simple create/join page, needs full dashboard |
| `SummaryPage` | `pages/SummaryPage.jsx` | **RESTYLE** | AI summary is working, needs better layout |

### Current Hook Inventory

| Hook | Action | Reason |
|------|--------|--------|
| `useWebRTC` | **KEEP** | 264 lines, full ICE + TURN + signaling. Do not touch. |
| `useAudioCapture` | **KEEP** | Media capture with fallback. Working perfectly. |
| `useAudioVolume` | **KEEP** | Real-time speaking detection via Web Audio API. |
| `useSpeechTranslation` | **KEEP** | AudioWorklet-based VAD + WAV capture + Socket.IO transport. Core IP. |
| `useTranslationReceiver` | **KEEP** | Receives TTS audio + subtitles. Core IP. |

### Backend API Capabilities (What exists on the server)

| Endpoint | Method | Exists | Notes |
|----------|--------|--------|-------|
| `/api/auth/register` | POST | ✅ | name, email, password |
| `/api/auth/login` | POST | ✅ | email, password → JWT |
| `/api/auth/me` | GET | ✅ | Get current user |
| `/api/meetings` | POST | ✅ | Create meeting |
| `/api/meetings/:roomCode` | GET | ✅ | Get meeting details |
| `/api/meetings/:roomCode/language` | PUT | ✅ | Update target language |
| `/api/meetings/:roomCode/end` | POST | ✅ | End meeting (host only) |
| `/api/meetings/:roomCode/summarize` | POST | ✅ | Generate AI summary (Gemini) |
| `/api/meetings/:roomCode/summary` | GET | ✅ | Get cached summary |
| `/api/transcripts/:roomCode` | GET | ✅ | Get meeting transcripts |
| `/api/turn/credentials` | GET | ✅ | TURN server credentials |
| `/api/health` | GET | ✅ | Health check |

> [!IMPORTANT]
> **No backend for**: meeting history list, forgot/reset password, user settings update, notifications, contacts, scheduling meetings, chat. These features will be marked as **Future Work** in the frontend and shown as empty/coming-soon states.

### What Must NOT Be Touched

- `hooks/useWebRTC.js` — WebRTC signaling
- `hooks/useAudioCapture.js` — Media capture
- `hooks/useSpeechTranslation.js` — VAD + audio chunk pipeline
- `hooks/useTranslationReceiver.js` — TTS playback
- `hooks/useAudioVolume.js` — Speaking detection
- `workers/audio-processor.worklet.js` — AudioWorklet processor
- `services/api.js` — Axios instance
- `services/socket.js` — Socket.IO singleton
- `context/AuthContext.jsx` — Auth state (logic only; JSX may wrap with new shell)
- `context/SocketContext.jsx` — Socket state (logic only)

---

## Part II: Target Design System — LinguaMeet Design Language

### Color System

```css
/* ── Backgrounds ── */
--lm-bg-base:            #090A0F;   /* True obsidian */
--lm-bg-surface:         #12151E;   /* Elevated panels */
--lm-bg-surface-hover:   #1A1D2B;   /* Surface on hover */
--lm-bg-elevated:        #1E2130;   /* Cards, modals, dropdowns */
--lm-bg-input:           #0E1018;   /* Input fields */

/* ── Borders ── */
--lm-border:             rgba(255, 255, 255, 0.08);
--lm-border-subtle:      rgba(255, 255, 255, 0.05);
--lm-border-focus:       rgba(0, 212, 178, 0.5);

/* ── Primary Accent: Electric Mint / Teal ── */
--lm-accent:             #00D4B2;
--lm-accent-hover:       #00E8C4;
--lm-accent-muted:       rgba(0, 212, 178, 0.15);
--lm-accent-text:        #00D4B2;

/* ── Secondary Accent: Sky Blue (Telemetry) ── */
--lm-telemetry:          #38BDF8;
--lm-telemetry-muted:    rgba(56, 189, 248, 0.15);

/* ── Text ── */
--lm-text-primary:       #F8FAFC;
--lm-text-secondary:     #94A3B8;
--lm-text-disabled:      #475569;
--lm-text-inverse:       #0F172A;

/* ── Semantic ── */
--lm-success:            #34D399;
--lm-success-muted:      rgba(52, 211, 153, 0.15);
--lm-warning:            #FBBF24;
--lm-warning-muted:      rgba(251, 191, 36, 0.15);
--lm-danger:             #F87171;
--lm-danger-muted:       rgba(248, 113, 113, 0.15);
--lm-info:               #38BDF8;
--lm-info-muted:         rgba(56, 189, 248, 0.15);
--lm-offline:            #64748B;
--lm-degraded:           #FB923C;
```

#### Semantic Color Usage

| Concept | Color | Token |
|---------|-------|-------|
| Human communication, translation, active states, primary actions | Mint `#00D4B2` | `--lm-accent` |
| System, AI, network, telemetry, processing | Blue `#38BDF8` | `--lm-telemetry` |
| Errors, disconnect, danger, call termination | Red `#F87171` | `--lm-danger` |
| Warning, degraded state, pending | Amber `#FBBF24` | `--lm-warning` |
| Success, connected, healthy | Green `#34D399` | `--lm-success` |

### Typography

```css
--lm-font-primary:   'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--lm-font-mono:      'JetBrains Mono', 'Fira Code', 'Courier New', monospace;

/* Scale */
--lm-text-xs:    0.75rem;    /* 12px — timestamps, badges */
--lm-text-sm:    0.8125rem;  /* 13px — captions, labels */
--lm-text-base:  0.875rem;   /* 14px — body, inputs */
--lm-text-md:    1rem;        /* 16px — subheadings */
--lm-text-lg:    1.125rem;   /* 18px — section titles */
--lm-text-xl:    1.5rem;     /* 24px — page titles */
--lm-text-2xl:   2rem;       /* 32px — hero */
--lm-text-3xl:   2.5rem;     /* 40px — landing display */
--lm-text-4xl:   3.5rem;     /* 56px — landing hero */
```

### Spacing

```css
--lm-space-1:  4px;
--lm-space-2:  8px;
--lm-space-3:  12px;
--lm-space-4:  16px;
--lm-space-5:  20px;
--lm-space-6:  24px;
--lm-space-8:  32px;
--lm-space-10: 40px;
--lm-space-12: 48px;
--lm-space-16: 64px;
--lm-space-20: 80px;
```

### Border Radius

```css
--lm-radius-sm:   4px;   /* Badges, small pills */
--lm-radius-md:   8px;   /* Inputs, buttons, cards */
--lm-radius-lg:   12px;  /* Panels, modals */
--lm-radius-xl:   16px;  /* Video tiles */
--lm-radius-full: 9999px; /* Avatars, pills */
```

### Motion System

```css
--lm-duration-fast:  120ms;
--lm-duration-base:  200ms;
--lm-duration-slow:  350ms;
--lm-easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--lm-easing-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### Breakpoints

| Name | Width | Use |
|------|-------|-----|
| Mobile | `≤ 640px` | Single column, bottom sheet panels |
| Tablet | `641px – 1024px` | 2-column grid, collapsible sidebar |
| Laptop | `1025px – 1440px` | Full layout with sidebar |
| Desktop | `> 1440px` | Wide layout, max-width container |

### Z-Index Scale

```css
--lm-z-base:      1;
--lm-z-header:    100;
--lm-z-sidebar:   200;
--lm-z-dropdown:  300;
--lm-z-overlay:   400;
--lm-z-modal:     500;
--lm-z-toast:     600;
--lm-z-tooltip:   700;
```

---

## Part III: Complete Screen Inventory

### Public Screens

| # | Screen | Status | Action |
|---|--------|--------|--------|
| 1 | Landing Page | **NEW** | Currently no public landing page — users go straight to login |
| 2 | Login | Exists | **RESTYLE** — add password visibility, remember me, forgot password link, social login UI |
| 3 | Signup | Exists | **RESTYLE** — add terms checkbox, better validation feedback |
| 4 | Forgot Password | **NEW** | No backend support — create UI with "Coming Soon" |
| 5 | Reset Password | **NEW** | No backend support — create UI with "Coming Soon" |

### Authenticated Screens

| # | Screen | Status | Action |
|---|--------|--------|--------|
| 6 | Dashboard | Partial (`Home.jsx`) | **REBUILD** — currently a hero + create/join. Need sidebar, recent meetings, quick actions, language prefs |
| 7 | Create Meeting | Not separate | **NEW** — modal or page with title, type, language settings |
| 8 | Join Meeting | Inline in Home | **RESTYLE** — extract into proper flow |
| 9 | Pre-Join Screen | Exists | **REBUILD** — add device selectors, language settings, audio test, remember settings |
| 10 | Meeting Room | Exists | **REFACTOR + RESTYLE** — decompose 777-line monolith, redesign header/toolbar/grid |
| 11 | Participants Panel | Inline in MeetingRoom | **NEW** — separate panel component with search, host controls |
| 12 | Transcript Panel | Inline sidebar in MeetingRoom | **RESTYLE** — tabs (Transcript/Participants/Chat), better layout |
| 13 | Post-Meeting Summary | Exists (`SummaryPage.jsx`) | **RESTYLE** — align with design system |
| 14 | Meeting History | **NEW** | No dedicated page — needs API: `GET /api/meetings` (user's meetings). Server has Meeting model with status/timestamps |
| 15 | Transcripts Page | **NEW** | Full transcript browser — server has `GET /api/transcripts/:roomCode` |
| 16 | Settings | **NEW** | Language, audio/video, account. No backend for user update yet |
| 17 | Notifications | **NEW** | No backend — create UI shell with mock states |

---

## Part IV: Screen-by-Screen Design Specifications

### 4.1 Landing Page (NEW)

**Purpose:** Public marketing page that communicates LinguaMeet's value proposition.

**Layout:**
- Full-width, scrolling page
- Nav: Logo + Features / How It Works / Use Cases / Pricing + Sign In + Get Started (mint CTA)
- Hero: "Meet Without Language Barriers" + subtitle + primary CTA (Get Started Free) + secondary CTA (Watch Demo) + animated globe/world visualization with floating language labels
- Stats bar: "50+ Languages" / "<1s Target Latency" / "Real-time Speech-to-Speech"
- How It Works: 4-step vertical flow: Speak → Understand → Translate → Connect
- Use Cases: Cards for international teams, education, interviews, remote collaboration
- Product demo: Stylized meeting screenshot/visual
- Footer: Logo, product links, legal, social

**Data:** Static content, no API calls.

**Responsive:** Stack to single column on mobile, hamburger nav, smaller hero text.

**Accessibility:** Semantic HTML5 sections, proper heading hierarchy, skip-to-content link.

---

### 4.2 Login

**Purpose:** Authenticate existing users.

**Layout (from reference):**
- Centered card on obsidian background
- Logo + "LinguaMeet" + "Welcome Back" + "Sign in to continue to LinguaMeet"
- Email input with icon
- Password input with visibility toggle
- Remember me checkbox + "Forgot password?" link
- "Sign In" primary button (full width, mint)
- Divider: "or continue with"
- Google + GitHub social buttons (UI only — no backend yet, marked disabled/coming-soon)
- "Don't have an account? Create one" footer

**Components:** `AuthCard`, `InputField` (with icon + visibility), `Checkbox`, `Button`, `SocialButton`, `Divider`

**States:** Default → Typing → Loading → Success (redirect) → Error (inline alert)

**Validation:** Email format, password ≥ 6 chars, required fields.

**Existing code to preserve:** `useAuth().login()`, `Navigate` redirect when authenticated.

---

### 4.3 Signup

**Purpose:** Create new account.

**Layout:** Same `AuthCard` frame as Login.
- "Create your account" subtitle
- Name, Email, Password, Confirm Password inputs
- Terms checkbox: "I agree to Terms of Service"
- "Create Account" button
- "Already have an account? Sign in" footer

**States:** Same as Login + password mismatch validation.

**Existing code to preserve:** `useAuth().register()`.

---

### 4.4 Dashboard (REBUILD from `Home.jsx`)

**Purpose:** Central hub after login.

**Layout (from reference):**
- **Sidebar** (left, 240px): Logo, nav items (Home, Meetings, Transcripts, Contacts*, Settings), user avatar + name at bottom
- **Main content area:**
  - Greeting: "Good evening, {name} 👋" + "Break barriers. Build connections."
  - **Quick Actions row** (3 cards): Start a Meeting (instant) / Join a Meeting (code input) / Schedule Meeting* (future)
  - **Recent Meetings** section: List of meeting cards showing title, date, participant avatars, participant count, language badge
  - **Your Languages** sidebar card: Spoken Language, Preferred Translation Language, Edit Preferences link
- **Empty states:** "No meetings yet" illustration when no meeting history

**Data sources:**
- User info: `useAuth().user` (name, email, preferredLanguage)
- Recent meetings: New API needed `GET /api/meetings?userId=x` — if backend doesn't support, show empty state with note
- Socket connection: `useSocket().connected`

**Components to create:** `AppShell`, `Sidebar`, `SidebarItem`, `QuickActionCard`, `MeetingCard`, `LanguagePreferencesCard`, `EmptyState`, `Avatar`, `Badge`

> [!WARNING]
> The current backend does **not** have a "list user's meetings" endpoint. The dashboard should gracefully show an empty state for recent meetings. We will add a `GET /api/meetings` endpoint in a later phase if needed, or implement it as part of this redesign.

---

### 4.5 Create Meeting (NEW — modal or side panel)

**Purpose:** Create a new meeting with configuration.

**Layout (from reference):**
- Tabs: Create / Join
- Meeting Title input
- Meeting Type selector: Video + Audio / Audio Only / Transcription Only
- Language Settings: My Spoken Language (auto-detect or selector) / My Preferred Language (target)
- Language badge pills showing selected languages
- "Create Meeting" primary button (mint)
- "Advanced Settings" collapsible

**Data:** `POST /api/meetings` — currently sends `{ title }`. Add spoken language and type as local config passed to pre-join.

---

### 4.6 Pre-Join Screen (REBUILD)

**Purpose:** Device testing and language configuration before entering meeting.

**Layout (from reference):**
- Split: Video preview (left) + Settings (right)
- Camera preview with mirror
- Device selectors: Camera dropdown, Microphone dropdown
- Test Audio: Audio visualizer waveform
- Language Settings: Spoken Language / Preferred Language dropdowns
- "Remember settings for future meetings" checkbox
- "Join Meeting" primary button (mint, full width)
- Mic/Camera toggle buttons overlaid on preview

**Components to create:** `DeviceSelector`, `AudioVisualizer`, `PreJoinPreview`

**States:** Camera blocked, Mic blocked, Device unavailable, Joining, Connection failure

**Existing code to preserve:** `useAudioCapture()`, `localStream`, `toggleMute`, `toggleVideo`, video ref attachment.

**New functionality:** `navigator.mediaDevices.enumerateDevices()` for camera/mic dropdowns.

---

### 4.7 Main Meeting Interface (REFACTOR + RESTYLE)

> [!IMPORTANT]
> This is the most critical screen. The current `MeetingRoom.jsx` is a 777-line monolith containing header, grid, transcript sidebar, subtitle overlay, translating indicator, leave modal, and diagnostics modal. It must be decomposed.

**Layout (from reference):**

**Header bar** (top, full width):
- Left: Logo + "LIVE" badge (red dot) + meeting timer (monospace `00:24:17`) + latency badge (`42ms`, blue telemetry) + "AI Translating" status pill
- Right: Meeting mode label + Settings icon + Speaker View / Grid View toggle

**Video Grid** (center):
- Responsive 2×2 grid (for 4 participants)
- Each tile: Video, name badge (bottom-left), language flow badge (e.g., "Hindi → English", mint), translation subtitle overlay (bottom of tile)
- Speaking indicator: Mint border glow
- Camera-off: Avatar initial on dark surface

**Translation Subtitle Overlay** (bottom of grid area):
- Source language → target language
- Original text
- Translated text
- Fade animation, 4s auto-dismiss

**Meeting Toolbar** (bottom, centered):
- Mic toggle / Camera toggle / Share Screen* / Translate toggle / Captions toggle / More menu / Leave (red pill)
- Each button: circle icon with label below

**Right Panel** (collapsible):
- Tabs: Transcript / Participants / Chat*
- Transcript: Live messages with speaker, timestamp, original text, language badge, translated text
- Participants: Search, list with avatar, name, host badge, mic/camera/language status
- Chat: Future work

**Decomposition plan for `MeetingRoom.jsx`:**

```
MeetingRoom.jsx (orchestrator — ~150 lines)
├── MeetingHeader.jsx         (logo, timer, status, AI state)
├── ParticipantGrid.jsx       (existing — restyle)
│   └── ParticipantTile.jsx   (existing — restyle)
├── MeetingToolbar.jsx        (rebuilt from ControlBar)
├── SubtitleOverlay.jsx       (extracted from MeetingRoom)
├── TranslationStatus.jsx     (translating indicator)
├── RightPanel.jsx            (new — tabbed container)
│   ├── TranscriptPanel.jsx   (extracted from MeetingRoom sidebar)
│   ├── ParticipantsPanel.jsx (new)
│   └── ChatPanel.jsx         (future — placeholder)
├── LeaveModal.jsx            (extracted)
└── PipelineInspectorModal.jsx (existing — restyle)
```

**Video Grid Responsive Behavior:**

| Participants | Desktop Layout | Mobile Layout |
|---|---|---|
| 1 | Full screen, centered | Full screen |
| 2 | 2 columns, 1 row | 2 stacked |
| 3 | 2 columns (1 + 2) | 3 stacked |
| 4 | 2 × 2 grid | 2 × 2 (smaller) |
| 5+ | Auto-fit grid, min 240px | Scrollable list |

---

### 4.8 Translation UI System

**Translation States:**

| State | Visual | Color | Duration |
|-------|--------|-------|----------|
| Listening | `● Listening` — small pulse dot | Mint `#00D4B2` | While mic active |
| Processing | `✦ Processing` — rotating icon | Blue `#38BDF8` | During STT |
| Translating | `✦ Translating` — shimmer | Blue `#38BDF8` | During NMT |
| Speaking | `♫ Playing` — audio wave | Mint `#00D4B2` | During TTS playback |
| Complete | (dismiss) | — | Auto-fade 4s |
| Delayed | `⏳ Delayed` | Amber `#FBBF24` | If >3s processing |
| Error | `✕ Translation failed` | Red `#F87171` | Until dismissed |

**Subtitle Overlay Design:**
```
┌──────────────────────────────────┐
│  Hindi → English                 │  ← Language flow (mint, small)
│  "मुझे लगता है कि हमें डिज़ाइन  │  ← Original text (dim)
│  कल अंतिम रूप देना चाहिए।"      │
│                                  │
│  "I think we should finalize     │  ← Translated text (bright)
│  the design tomorrow."           │
└──────────────────────────────────┘
```

---

### 4.9 Settings Page (NEW)

**Sections:**
1. **Account** — Name, email (read-only for now, no backend update API)
2. **Language** — Spoken Language (with auto-detect toggle), Preferred Translation Language, Additional languages (pill selector)
3. **Audio & Video** — Camera preview, mic selector, speaker test
4. **Notifications** — Future work
5. **Privacy** — Future work

**Layout:** Sidebar nav (Account / Language / Audio & Video / Notifications / Privacy) + content area.

---

### 4.10 Meeting History (NEW)

**Purpose:** Browse past meetings.

**Layout:**
- Search bar
- Filter: All Meetings / dropdown
- Meeting list: title, date, participant avatars, count, language badges, View action
- Empty state when no meetings

**Data:** Requires `GET /api/meetings` endpoint. If unavailable, show empty state.

---

### 4.11 Notifications (NEW)

**Purpose:** System notification center.

**Layout (from reference):**
- "Mark all read" link
- List: icon + title + description + time ago
- Types: Meeting Invite, Translation Ready, AI Service Update, Meeting Reminder

**Data:** No backend — UI shell only.

---

### 4.12 Mobile Responsive View

**Meeting screen mobile behavior:**
- Video grid: Single prominent speaker + small thumbnail strip
- Toolbar: Fixed bottom, icons only (no labels), 5 essential controls
- Transcript: Bottom sheet drawer (swipe up)
- Participants: Bottom sheet drawer
- Header: Compact — timer + status dot only
- Language selector: Bottom sheet

**Dashboard mobile:**
- Sidebar → hamburger menu
- Quick actions: Stack vertically
- Recent meetings: Full-width cards

---

## Part V: Component Architecture

### Primitive Components (NEW)

| Component | Responsibility | Props | Variants |
|-----------|---------------|-------|----------|
| `Button` | All button interactions | `variant`, `size`, `icon`, `loading`, `disabled` | `primary`, `secondary`, `ghost`, `danger`, `icon-only` |
| `IconButton` | Circular icon actions | `icon`, `active`, `danger`, `size`, `tooltip` | `default`, `active`, `muted`, `danger` |
| `Input` | Text/email/password fields | `type`, `icon`, `error`, `label`, `showPassword` | `default`, `focus`, `error`, `disabled` |
| `Select` | Dropdown select | `options`, `value`, `label`, `icon` | `default`, `compact` |
| `Badge` | Status labels | `variant`, `size`, `dot` | `mint`, `blue`, `red`, `amber`, `gray` |
| `Avatar` | User avatar | `name`, `src`, `size`, `status` | `sm`, `md`, `lg` |
| `Card` | Container card | `variant`, `padding` | `surface`, `elevated`, `interactive` |
| `Modal` | Dialog overlay | `isOpen`, `onClose`, `title`, `size` | `sm`, `md`, `lg` |
| `Drawer` | Slide-in panel | `isOpen`, `onClose`, `position`, `title` | `right`, `bottom` |
| `Toast` | Notification toast | `message`, `variant`, `duration` | `success`, `error`, `warning`, `info` |
| `Tabs` | Tab navigation | `tabs`, `activeTab`, `onChange` | `default`, `pills` |
| `StatusIndicator` | Semantic dot | `status`, `label`, `pulse` | `online`, `offline`, `warning`, `speaking` |
| `Divider` | Section separator | `label`, `orientation` | `horizontal`, `vertical` |

### Feature Components

| Component | Responsibility |
|-----------|---------------|
| `AppShell` | Sidebar + header + content layout for authenticated pages |
| `Sidebar` | Navigation sidebar with items, user avatar, collapse |
| `MeetingHeader` | Logo, LIVE badge, timer, AI status, network indicator |
| `MeetingToolbar` | Bottom control bar with all meeting controls |
| `ParticipantGrid` | Responsive video tile grid |
| `ParticipantTile` | Individual video tile with overlays |
| `SubtitleOverlay` | Floating translation caption |
| `TranslationStatus` | AI pipeline state indicator |
| `RightPanel` | Tabbed panel for transcript/participants/chat |
| `TranscriptPanel` | Live transcript feed |
| `TranscriptItem` | Individual transcript entry |
| `ParticipantsPanel` | Participant list with controls |
| `ChatPanel` | Chat (future — empty state) |
| `LanguageSelector` | Language dropdown with flags |
| `DeviceSelector` | Camera/mic device picker |
| `AudioVisualizer` | Audio level visualization |
| `MeetingTimer` | Duration counter |
| `ConnectionIndicator` | Network quality display |
| `PreJoinPreview` | Camera preview with controls |
| `MeetingCard` | Meeting item for dashboard/history |
| `QuickActionCard` | Dashboard action button |
| `EmptyState` | Empty state illustration + message |
| `NotificationItem` | Notification list item |

### Component State Matrix

| Component | Default | Hover | Active | Disabled | Loading | Error |
|-----------|---------|-------|--------|----------|---------|-------|
| Button (primary) | Mint bg | Lighter mint + slight lift | Scale 0.98 | 50% opacity | Spinner | — |
| Button (danger) | Red bg | Lighter red | Scale 0.98 | 50% opacity | Spinner | — |
| IconButton (mic) | Surface bg | Lighten | Mint bg | Gray | — | Red bg (muted) |
| Input | Subtle bg + border | — | Mint border + glow | Gray text | — | Red border + message |
| Select | Subtle bg + border | — | Mint border | Gray | — | Red border |
| ParticipantTile | Surface bg | — | Mint border (speaking) | — | Shimmer | Error overlay |
| MeetingCard | Surface bg | Border lighten + slight lift | — | — | Skeleton | Error text |
| Badge | Muted bg | — | — | — | — | — |

---

## Part VI: Real-Time State Design

### Connection States

| State | Visual | Indicator |
|-------|--------|-----------|
| Connected | Green dot, no label | `StatusIndicator` in header |
| Connecting | Blue dot, pulse, "Connecting..." | `StatusIndicator` + label |
| Reconnecting | Amber dot, pulse, "Reconnecting..." | `StatusIndicator` + label |
| Poor connection | Amber dot, "Poor connection" | `StatusIndicator` + label |
| Disconnected | Red dot, "Disconnected" | `StatusIndicator` + banner |

### AI Translation States

| State | Icon | Color | Label |
|-------|------|-------|-------|
| Ready | `●` | Mint | "AI Ready" |
| Listening | `●` pulse | Mint | "Listening" |
| Processing | `✦` spin | Blue | "Processing" |
| Translating | `✦` shimmer | Blue | "Translating" |
| Speaking | `♫` | Mint | "Speaking" |
| Delayed | `⏳` | Amber | "Delayed" |
| Error | `✕` | Red | "Error" |

### Participant States

| State | Indicator |
|-------|-----------|
| Speaking | Mint border glow on tile |
| Silent | No border |
| Muted | Mic-off icon in info bar |
| Camera off | Avatar shown |
| Reconnecting | Amber shimmer overlay |
| Left | Tile removed with fade |

---

## Part VII: Responsive Design Strategy

### Meeting Screen (Most Critical)

| Breakpoint | Grid | Toolbar | Panels | Header |
|------------|------|---------|--------|--------|
| Desktop (>1024) | 2×2 grid + right panel | Bottom bar with labels | Side panel | Full header |
| Tablet (641-1024) | 2×2 grid, panel overlays | Bottom bar, icons only | Overlay drawer | Compact |
| Mobile (≤640) | 1 large + thumbnail strip | Bottom bar, 5 icons | Bottom sheet | Timer + dot only |

### Dashboard

| Breakpoint | Sidebar | Quick Actions | Meetings |
|------------|---------|---------------|----------|
| Desktop | Fixed 240px | 3 across | List |
| Tablet | Collapsible | 3 across | List |
| Mobile | Hamburger | Stack | Cards |

---

## Part VIII: Accessibility Strategy

- **Focus management:** Visible focus rings using `--lm-accent` on all interactive elements
- **Keyboard nav:** Tab through all controls, Enter/Space to activate, Escape to close modals
- **ARIA labels:** All buttons (especially icon-only), modals, panels, live regions for subtitles
- **`aria-live="polite"`:** Subtitle overlay, translation status, toast notifications
- **Contrast:** WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- **Touch targets:** Minimum 44×44px for all mobile touch targets
- **Reduced motion:** `prefers-reduced-motion` media query disables all animations
- **Screen reader:** Meeting controls announce state changes ("Microphone muted", "Camera off")

---

## Part IX: Performance Strategy

### Critical Performance Rules

1. **Never re-render the entire meeting grid** when a transcript arrives or translation status changes — use separate state slices
2. **Memoize `ParticipantTile`** — only re-render when its own props change (stream, speaking, muted, video)
3. **Memoize `TranscriptItem`** — transcript list should use virtualization for 200+ entries
4. **Speaking indicator uses `requestAnimationFrame`** — already implemented in `useAudioVolume`, keep
5. **Subtitle overlay** is a separate positioned element — does not cause grid re-render
6. **Socket event handlers** use `useCallback` with stable references — already implemented, keep
7. **CSS animations** for speaking border glow instead of JS-driven state updates
8. **Lazy-load** landing page sections, settings page, meeting history

---

## Part X: Implementation Phases

---

### Phase 0 — Design Tokens & Reset

**Objective:** Replace the current Google Meet-inspired design tokens with LinguaMeet's obsidian/mint system.

**Why:** Every subsequent phase depends on the correct color palette, typography, and spacing being in place.

**Files affected:**
- `client/src/index.css` — **MODIFY** (replace `:root` variables, update reset)
- `client/index.html` — **MODIFY** (add Inter + JetBrains Mono font links)

**Implementation:**
1. Replace all CSS custom properties in `:root` with the LinguaMeet design tokens
2. Update body background to `#090A0F`
3. Add `prefers-reduced-motion` media query
4. Update scrollbar colors
5. Add Google Fonts import for Inter (wght 300-700)
6. Keep all utility classes but update their values

**Risks:** Every existing component will immediately look different. This is expected.

**Definition of Done:**
- [ ] `--lm-*` tokens defined and replace all `--color-*` tokens
- [ ] Body background is `#090A0F`
- [ ] Font is Inter
- [ ] Existing app still renders (may look rough until components are restyled)

---

### Phase 1 — UI Primitives

**Objective:** Build the reusable component library that every screen depends on.

**Why:** Without a consistent primitive set, every page will have ad-hoc implementations.

**Components to create:**
- `src/components/ui/Button.jsx` + `Button.css`
- `src/components/ui/IconButton.jsx`
- `src/components/ui/Input.jsx` + `Input.css`
- `src/components/ui/Select.jsx`
- `src/components/ui/Badge.jsx`
- `src/components/ui/Avatar.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/Modal.jsx`
- `src/components/ui/Drawer.jsx`
- `src/components/ui/Toast.jsx` + `ToastContext.jsx`
- `src/components/ui/Tabs.jsx`
- `src/components/ui/StatusIndicator.jsx`
- `src/components/ui/Divider.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/Skeleton.jsx`

**Dependencies:** Phase 0 (design tokens)

**Definition of Done:**
- [ ] All primitive components render correctly with design tokens
- [ ] Each component supports all listed variants
- [ ] Each component has proper ARIA attributes
- [ ] Each component is responsive

---

### Phase 2 — Application Shell

**Objective:** Create the authenticated layout wrapper with sidebar navigation.

**Why:** The dashboard, settings, meeting history, and transcripts all share the same shell.

**Components to create:**
- `src/components/Layout/AppShell.jsx` + `AppShell.css`
- `src/components/Layout/Sidebar.jsx`
- `src/components/Layout/SidebarItem.jsx`
- `src/components/Layout/Topbar.jsx` (for mobile — replaces sidebar)

**Files modified:**
- `src/App.jsx` — wrap authenticated routes with `AppShell`
- `src/pages/Home.jsx` — remove its own nav, rely on shell

**Implementation:**
1. `AppShell` renders sidebar + main content area
2. Sidebar: Logo, nav items (Home, Meetings, Transcripts, Settings), user avatar at bottom, collapse on tablet
3. Mobile: Hamburger menu overlay
4. Meeting page does NOT use AppShell (it's fullscreen)

**Definition of Done:**
- [ ] Sidebar renders with correct nav items
- [ ] Active route is highlighted with mint
- [ ] Sidebar collapses to icons on tablet
- [ ] Hamburger menu on mobile
- [ ] User avatar and name displayed at bottom

---

### Phase 3 — Authentication Screens

**Objective:** Restyle Login and Register to match the reference design.

**Why:** First impression of the product. Must look polished.

**Files modified:**
- `src/pages/Login.jsx` — **RESTYLE** (use new primitives, add password visibility, remember me, social buttons UI)
- `src/pages/Register.jsx` — **RESTYLE** (use new primitives, add terms checkbox)
- `src/pages/Auth.css` — **RESTYLE** (new color system, remove decorative orbs, cleaner background)

**New components:**
- `src/pages/ForgotPassword.jsx` — **NEW** (UI only, submit shows "Coming Soon" toast)
- `src/pages/ResetPassword.jsx` — **NEW** (UI only)

**Routes added to `App.jsx`:**
- `/forgot-password` → `ForgotPassword`
- `/reset-password` → `ResetPassword`

**Existing code to preserve:**
- `useAuth().login()` and `useAuth().register()` calls
- Form submission logic
- Error handling

**Definition of Done:**
- [ ] Login matches reference card design (centered, logo, social buttons)
- [ ] Password visibility toggle works
- [ ] Remember me checkbox renders (functional storage optional)
- [ ] Signup has terms checkbox
- [ ] Forgot/reset password pages exist with proper UI
- [ ] All validation states work (error alerts, loading spinner)
- [ ] Responsive on mobile

---

### Phase 4 — Landing Page

**Objective:** Create a public marketing page that communicates the product.

**Why:** The current app has no public page — users need to understand the product before signing up.

**New files:**
- `src/pages/Landing.jsx` + `Landing.css`
- `src/components/Landing/Hero.jsx`
- `src/components/Landing/Features.jsx`
- `src/components/Landing/HowItWorks.jsx`
- `src/components/Landing/UseCases.jsx`
- `src/components/Landing/Footer.jsx`
- `src/components/Landing/LandingNav.jsx`

**Route:** `/` for unauthenticated users → Landing. Authenticated users → Dashboard.

**App.jsx change:** Conditional root route based on `isAuthenticated`.

**Definition of Done:**
- [ ] Landing page renders with all sections from reference
- [ ] Nav with logo, links, Sign In, Get Started (mint CTA)
- [ ] Hero section with compelling headline
- [ ] Stats section
- [ ] How It Works section
- [ ] Use Cases section
- [ ] Footer
- [ ] Responsive on all breakpoints
- [ ] Proper SEO (title, meta description, heading hierarchy)

---

### Phase 5 — Dashboard

**Objective:** Transform the Home page into a proper dashboard.

**Why:** The dashboard is where users spend time between meetings.

**Files modified:**
- `src/pages/Home.jsx` → `src/pages/Dashboard.jsx` — **REBUILD**
- `src/pages/Home.css` → `src/pages/Dashboard.css` — **REBUILD**

**New components:**
- `src/components/Dashboard/QuickActionCard.jsx`
- `src/components/Dashboard/MeetingCard.jsx`
- `src/components/Dashboard/LanguagePreferencesCard.jsx`
- `src/components/Dashboard/RecentMeetings.jsx`
- `src/components/Dashboard/CreateMeetingModal.jsx`
- `src/components/Dashboard/JoinMeetingModal.jsx`

**Implementation:**
1. Greeting section with user name
2. Quick actions: Start Meeting / Join Meeting / Schedule (disabled, future)
3. Recent Meetings: List with MeetingCard components (empty state initially since no list API)
4. Language Preferences card: Shows user's `preferredLanguage`, link to settings

**Data:** `useAuth().user`, `POST /api/meetings` for creation, `GET /api/meetings/:code` for joining.

**Existing code to preserve:**
- `handleCreateMeeting` logic
- `handleJoinMeeting` logic
- Socket connection status display

**Definition of Done:**
- [ ] Dashboard renders with greeting, quick actions, recent meetings section
- [ ] Create meeting works via modal
- [ ] Join meeting works via modal
- [ ] Empty state shown when no recent meetings
- [ ] Language preferences card displays correctly
- [ ] Responsive layout

---

### Phase 6 — Pre-Join Screen

**Objective:** Rebuild the pre-join experience to match the reference.

**Why:** Pre-join is the last screen before a meeting — needs to feel professional.

**Files modified:**
- `src/components/Meeting/PreJoinScreen.jsx` — **REBUILD**

**New components:**
- `src/components/Meeting/DeviceSelector.jsx`
- `src/components/Meeting/AudioVisualizer.jsx`

**Implementation:**
1. Split layout: Video preview (left 60%) + Settings panel (right 40%)
2. Camera preview with mirror, mic/camera toggle overlays
3. Device selectors: Camera + Microphone dropdowns using `navigator.mediaDevices.enumerateDevices()`
4. Test Audio section with waveform visualization
5. Language Settings: Spoken Language / Preferred Language
6. "Remember settings for future meetings" checkbox
7. "Join Meeting" mint button

**Existing code to preserve:**
- Video ref attachment
- `useAudioCapture` integration
- `handleJoin` → `setHasJoinedLobby(true)`

**Definition of Done:**
- [ ] Split layout matches reference
- [ ] Device selectors enumerate available devices
- [ ] Audio visualizer shows mic input levels
- [ ] Language selectors use LanguageSelector component
- [ ] Join button works and enters meeting
- [ ] Responsive: stack vertically on mobile

---

### Phase 7 — Meeting UI (Core)

**Objective:** Decompose and restyle the meeting room to match the reference.

**Why:** This is the product's core screen. Must be excellent.

**Files heavily modified:**
- `src/components/Meeting/MeetingRoom.jsx` — **REFACTOR** (extract components, reduce to ~150 lines)
- `src/pages/Meeting.css` — **RESTYLE** (complete rewrite with new tokens)

**New components:**
- `src/components/Meeting/MeetingHeader.jsx` — Logo, LIVE badge, timer, AI status, network
- `src/components/Meeting/MeetingToolbar.jsx` — Rebuilt from ControlBar
- `src/components/Meeting/SubtitleOverlay.jsx` — Extracted subtitle rendering
- `src/components/Meeting/TranslationStatus.jsx` — AI pipeline state
- `src/components/Meeting/LeaveModal.jsx` — Extracted leave confirmation

**Modified components:**
- `src/components/Meeting/ParticipantGrid.jsx` — **RESTYLE** (new grid CSS)
- `src/components/Meeting/ParticipantTile.jsx` — **RESTYLE** (new tile design with language flow badge)
- `src/components/Meeting/ControlBar.jsx` → renamed to `MeetingToolbar.jsx` — **RESTYLE** (new toolbar with labels, translate/captions buttons)

**Existing code preservation (CRITICAL):**
- All `useEffect` hooks for socket events — KEEP in `MeetingRoom.jsx`
- All WebRTC integration — KEEP unchanged
- All translation hooks (`useSpeechTranslation`, `useTranslationReceiver`) — KEEP
- All `handleSubtitle`, `handleTranscriptEntry` callbacks — KEEP
- All state management — KEEP, just pass as props to extracted components

**Implementation sequence:**
1. Create `MeetingHeader` component, extract header JSX
2. Create `MeetingToolbar` (from `ControlBar`), add translate/captions buttons
3. Create `SubtitleOverlay`, extract subtitle JSX
4. Create `TranslationStatus`, extract translating indicator
5. Create `LeaveModal`, extract leave confirmation
6. Restyle `ParticipantGrid` CSS
7. Restyle `ParticipantTile` — add language flow badge, redesign info bar
8. Update `MeetingRoom.jsx` to compose extracted components
9. Rewrite `Meeting.css` with new design tokens

**Risks:** Breaking existing meeting functionality. Mitigate by extracting one component at a time and testing after each.

**Definition of Done:**
- [ ] Meeting room decomposes into ≤8 components
- [ ] `MeetingRoom.jsx` is ≤200 lines
- [ ] Header shows logo, LIVE, timer, network status, AI state
- [ ] Video grid renders correctly for 1-4+ participants
- [ ] Speaking border glow works (mint)
- [ ] Toolbar has all controls with proper icons
- [ ] Subtitle overlay renders translations
- [ ] Leave modal works for both host and participant
- [ ] ALL EXISTING FUNCTIONALITY PRESERVED (audio, video, translation, WebRTC)

---

### Phase 8 — Translation UX

**Objective:** Elevate translation from a secondary widget to a first-class feature.

**Why:** Translation is LinguaMeet's core differentiator.

**Implementation:**
1. **Translation status indicator** in header — shows AI pipeline state with semantic colors
2. **Language flow badges** on participant tiles — "Hindi → English" (mint)
3. **Subtitle overlay redesign** — language header, original text (dim), translated text (bright), fade animation
4. **Translation toggle** in toolbar — prominent position, mint when active
5. **Live Translation pill** in transcript panel header — "Live Translation: English (Me)"

**Files affected:**
- `MeetingHeader.jsx` — add TranslationStatus component
- `ParticipantTile.jsx` — add language flow badge
- `SubtitleOverlay.jsx` — redesign
- `MeetingToolbar.jsx` — prominent translate button

**Existing code preserved:** All subtitle callbacks, translation hook integration, diagnostics.

**Definition of Done:**
- [ ] Translation status clearly visible in header
- [ ] Language flow badge shows on each participant tile
- [ ] Subtitle overlay matches reference design
- [ ] Translation toggle is prominent in toolbar
- [ ] All translation functionality works (capture → STT → NMT → TTS → subtitle)

---

### Phase 9 — Panels (Transcript, Participants, Chat)

**Objective:** Create the right-side panel system with tabs.

**Why:** Reference shows a tabbed panel for transcript, participants, and chat.

**New components:**
- `src/components/Meeting/RightPanel.jsx` — Tabbed container
- `src/components/Meeting/TranscriptPanel.jsx` — Rebuilt from inline sidebar
- `src/components/Meeting/TranscriptItem.jsx` — Individual entry
- `src/components/Meeting/ParticipantsPanel.jsx` — Participant list
- `src/components/Meeting/ChatPanel.jsx` — Future (empty state)

**Implementation:**
1. `RightPanel` uses `Tabs` component: Transcript ({count}) / Participants ({count}) / Chat
2. `TranscriptPanel`: Translation selector header, scrollable feed, speaker/timestamp/language/text
3. `ParticipantsPanel`: Search input, participant list with avatar, name, host badge, mic/camera status, language
4. `ChatPanel`: Empty state "Chat coming soon"

**Data sources:** `transcriptLog` state, `participants` state from `MeetingRoom.jsx`.

**Mobile behavior:** Bottom sheet drawer instead of side panel.

**Definition of Done:**
- [ ] Right panel opens/closes with animation
- [ ] Tabs switch correctly
- [ ] Transcript shows entries with correct formatting
- [ ] Participants shows correct list with statuses
- [ ] Chat shows empty state
- [ ] Mobile: bottom sheet behavior
- [ ] Panel does not cause meeting grid re-renders

---

### Phase 10 — Post-Meeting Summary & Transcripts

**Objective:** Restyle the SummaryPage and create a Transcripts page.

**Files modified:**
- `src/pages/SummaryPage.jsx` — **RESTYLE** (use design system components)
- `src/pages/Summary.css` — **RESTYLE** (new tokens)

**New files:**
- `src/pages/Transcripts.jsx` + `Transcripts.css` — **NEW** (browse transcripts across meetings)

**Route added:** `/transcripts` → `Transcripts` (inside AppShell)

**Definition of Done:**
- [ ] Summary page uses new design tokens
- [ ] Executive summary, key topics, action items styled correctly
- [ ] Transcript log styled with new tokens
- [ ] Transcripts page exists (empty state if no data)

---

### Phase 11 — Meeting History

**Objective:** Create a Meeting History page.

**New files:**
- `src/pages/MeetingHistory.jsx` + `MeetingHistory.css`

**Route:** `/meetings` → `MeetingHistory` (inside AppShell)

**Implementation:** Empty state since backend lacks list endpoint. Design with proper search, filters, and card layout for when data becomes available.

**Definition of Done:**
- [ ] Meeting History page renders with empty state
- [ ] Search and filter UI present
- [ ] Ready for data when backend adds list endpoint

---

### Phase 12 — Settings & Notifications

**Objective:** Create Settings and Notification pages.

**New files:**
- `src/pages/Settings.jsx` + `Settings.css`
- `src/components/Settings/AccountSettings.jsx`
- `src/components/Settings/LanguageSettings.jsx`
- `src/components/Settings/AudioVideoSettings.jsx`
- `src/components/Notifications/NotificationCenter.jsx`
- `src/components/Notifications/NotificationItem.jsx`

**Routes:**
- `/settings` → `Settings`
- Notifications: dropdown from topbar, not a separate page

**Implementation:**
- Settings tabs: Account / Language / Audio & Video / Notifications / Privacy
- Language settings: Spoken language dropdown, preferred language, additional languages with pill tags
- Audio & Video: Camera preview, mic selector, test audio
- Account: Display name and email (read-only without update API)
- Notifications: Dropdown in AppShell header showing mock items

**Definition of Done:**
- [ ] Settings page renders with correct sections
- [ ] Language preferences can be changed locally
- [ ] Audio/video settings show device preview
- [ ] Notification dropdown renders

---

### Phase 13 — Responsive Polish

**Objective:** Ensure all screens work on mobile and tablet.

**Implementation:**
1. Audit every screen at 640px, 768px, 1024px, 1440px
2. Meeting screen: mobile-specific video grid, bottom toolbar, sheet panels
3. Dashboard: stack layout, hamburger nav
4. Auth: full-width card on mobile
5. Settings: tab navigation → accordion on mobile

**Definition of Done:**
- [ ] All screens pass visual inspection at all breakpoints
- [ ] Touch targets ≥ 44px on mobile
- [ ] No horizontal scroll on any screen
- [ ] Meeting controls accessible on mobile

---

### Phase 14 — Accessibility

**Objective:** WCAG AA compliance across the application.

**Implementation:**
1. Add `aria-label` to all icon-only buttons
2. Add `role="dialog"` and `aria-modal` to all modals
3. Add `aria-live="polite"` to subtitle overlay and toasts
4. Focus trap in modals
5. Keyboard navigation through meeting controls
6. Focus visible rings
7. Color contrast audit
8. Screen reader testing with meeting controls

**Definition of Done:**
- [ ] All interactive elements have keyboard access
- [ ] All icon buttons have ARIA labels
- [ ] Modals have focus trapping
- [ ] Subtitle overlay announces to screen readers
- [ ] Color contrast passes WCAG AA

---

### Phase 15 — Visual QA

**Objective:** Compare implementation against reference image.

**Checklist:**
- [ ] Color palette matches spec (`#090A0F` bg, `#12151E` surfaces, `#00D4B2` accent)
- [ ] Typography uses Inter, correct sizes, correct weights
- [ ] Spacing is consistent (8px grid)
- [ ] Border radius matches spec (4/8/12/16px)
- [ ] No arbitrary colors — all from design tokens
- [ ] Visual hierarchy matches reference
- [ ] Meeting UI proportions match reference
- [ ] Cards have `1px` borders, no excessive shadows
- [ ] Landing page matches reference energy
- [ ] Dashboard matches reference information architecture

---

### Phase 16 — Functional QA

**Objective:** Ensure all existing functionality survives the redesign.

**Test matrix:**

| Feature | Test |
|---------|------|
| Login | Email + password → JWT stored → redirect |
| Register | Name + email + password → account created → redirect |
| Create meeting | Button → API call → navigate to `/meeting/:code` |
| Join meeting | Code input → API verify → navigate to meeting |
| Pre-join | Camera preview works, mic/camera toggles work |
| WebRTC | 2+ participants connect, audio plays |
| Translation | Enable → speak → STT → NMT → TTS → subtitle appears |
| Transcript | Live transcript entries appear in sidebar |
| Subtitle overlay | Shows and auto-dismisses |
| Diagnostics | Inspector modal opens with correct data |
| Leave meeting | Confirmation modal → navigate to summary |
| End meeting (host) | Ends for all participants |
| Summary | AI summary generates and displays |
| Rename | Participant can rename inline |
| Socket reconnection | Reconnects after disconnect |

**Definition of Done:**
- [ ] All tests in matrix pass
- [ ] No console errors during meeting flow
- [ ] Translation pipeline works end-to-end

---

## Part XI: Implementation Dependency Graph

```
Phase 0: Design Tokens
    ↓
Phase 1: UI Primitives
    ↓
Phase 2: Application Shell
    ↓
    ├── Phase 3: Authentication ──────── (can parallel with 4)
    ├── Phase 4: Landing Page ─────────── (can parallel with 3)
    ↓
Phase 5: Dashboard
    ↓
Phase 6: Pre-Join Screen
    ↓
Phase 7: Meeting UI (Core) ←── CRITICAL PATH
    ↓
Phase 8: Translation UX
    ↓
Phase 9: Panels (Transcript/Participants/Chat)
    ↓
    ├── Phase 10: Summary & Transcripts ── (can parallel with 11, 12)
    ├── Phase 11: Meeting History ──────── (can parallel with 10, 12)
    ├── Phase 12: Settings & Notifications (can parallel with 10, 11)
    ↓
Phase 13: Responsive Polish
    ↓
Phase 14: Accessibility
    ↓
Phase 15: Visual QA
    ↓
Phase 16: Functional QA
```

---

## Part XII: Frontend File Structure (Target)

```
src/
├── components/
│   ├── ui/                    # Primitive components
│   │   ├── Button.jsx
│   │   ├── IconButton.jsx
│   │   ├── Input.jsx
│   │   ├── Select.jsx
│   │   ├── Badge.jsx
│   │   ├── Avatar.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   ├── Drawer.jsx
│   │   ├── Toast.jsx
│   │   ├── Tabs.jsx
│   │   ├── StatusIndicator.jsx
│   │   ├── Divider.jsx
│   │   ├── EmptyState.jsx
│   │   └── Skeleton.jsx
│   ├── Layout/                # Shell components
│   │   ├── AppShell.jsx
│   │   ├── Sidebar.jsx
│   │   ├── SidebarItem.jsx
│   │   ├── Topbar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── Meeting/               # Meeting feature
│   │   ├── MeetingRoom.jsx    # Orchestrator (refactored)
│   │   ├── MeetingHeader.jsx  # NEW
│   │   ├── MeetingToolbar.jsx # Rebuilt from ControlBar
│   │   ├── ParticipantGrid.jsx
│   │   ├── ParticipantTile.jsx
│   │   ├── SubtitleOverlay.jsx # Extracted
│   │   ├── TranslationStatus.jsx # NEW
│   │   ├── RightPanel.jsx     # NEW
│   │   ├── TranscriptPanel.jsx # Extracted
│   │   ├── TranscriptItem.jsx  # NEW
│   │   ├── ParticipantsPanel.jsx # NEW
│   │   ├── ChatPanel.jsx       # NEW (future)
│   │   ├── PreJoinScreen.jsx   # Rebuilt
│   │   ├── DeviceSelector.jsx  # NEW
│   │   ├── AudioVisualizer.jsx # NEW
│   │   ├── LanguageSelector.jsx
│   │   ├── LeaveModal.jsx      # Extracted
│   │   └── PipelineInspectorModal.jsx
│   ├── Dashboard/             # Dashboard feature
│   │   ├── QuickActionCard.jsx
│   │   ├── MeetingCard.jsx
│   │   ├── LanguagePreferencesCard.jsx
│   │   ├── RecentMeetings.jsx
│   │   ├── CreateMeetingModal.jsx
│   │   └── JoinMeetingModal.jsx
│   ├── Landing/               # Landing page feature
│   │   ├── LandingNav.jsx
│   │   ├── Hero.jsx
│   │   ├── Features.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── UseCases.jsx
│   │   └── Footer.jsx
│   ├── Settings/              # Settings feature
│   │   ├── AccountSettings.jsx
│   │   ├── LanguageSettings.jsx
│   │   └── AudioVideoSettings.jsx
│   └── Notifications/        # Notifications
│       ├── NotificationCenter.jsx
│       └── NotificationItem.jsx
├── context/
│   ├── AuthContext.jsx        # KEEP
│   ├── SocketContext.jsx      # KEEP
│   └── ToastContext.jsx       # NEW
├── hooks/
│   ├── useWebRTC.js           # KEEP — DO NOT MODIFY
│   ├── useAudioCapture.js     # KEEP — DO NOT MODIFY
│   ├── useAudioVolume.js      # KEEP — DO NOT MODIFY
│   ├── useSpeechTranslation.js # KEEP — DO NOT MODIFY
│   ├── useTranslationReceiver.js # KEEP — DO NOT MODIFY
│   └── useMediaDevices.js     # NEW — enumerate devices
├── pages/
│   ├── Landing.jsx            # NEW
│   ├── Login.jsx              # RESTYLE
│   ├── Register.jsx           # RESTYLE
│   ├── ForgotPassword.jsx     # NEW
│   ├── ResetPassword.jsx      # NEW
│   ├── Dashboard.jsx          # REBUILD (from Home.jsx)
│   ├── Meeting.jsx            # KEEP (thin wrapper)
│   ├── SummaryPage.jsx        # RESTYLE
│   ├── MeetingHistory.jsx     # NEW
│   ├── Transcripts.jsx        # NEW
│   └── Settings.jsx           # NEW
├── services/
│   ├── api.js                 # KEEP
│   └── socket.js              # KEEP
├── styles/
│   ├── tokens.css             # NEW — design tokens only
│   ├── reset.css              # NEW — CSS reset
│   ├── utilities.css          # NEW — utility classes
│   └── components/            # NEW — component-level CSS
│       ├── button.css
│       ├── input.css
│       ├── card.css
│       ├── meeting.css
│       └── ...
├── workers/
│   └── audio-processor.worklet.js # KEEP — DO NOT MODIFY
├── App.jsx                    # MODIFY (new routes, conditional landing)
├── App.css                    # MODIFY
├── index.css                  # MODIFY (imports new token/reset/utility files)
└── main.jsx                   # KEEP
```

---

## Part XIII: Acceptance Criteria

### Visual
- [ ] Consistent design tokens — no arbitrary colors anywhere
- [ ] `#090A0F` background, `#12151E` surfaces, `#00D4B2` accent throughout
- [ ] Consistent spacing on 4/8px grid
- [ ] All component states implemented (default, hover, active, disabled, loading, error)
- [ ] Reference design language reproduced in layout, hierarchy, and density
- [ ] No excessive glassmorphism, gradients, glow, or decorative elements

### Functional
- [ ] Authentication works (login, register, protected routes, logout)
- [ ] Meeting creation works
- [ ] Meeting joining works (code input + navigate)
- [ ] WebRTC peer connections establish (audio + video)
- [ ] Translation pipeline works (capture → STT → NMT → TTS → subtitle)
- [ ] Transcript logging works (live sidebar + post-meeting)
- [ ] AI summary generation works (Gemini)
- [ ] Participant management works (join, leave, rename, media toggle)
- [ ] Socket.IO reconnection works

### Responsive
- [ ] Desktop (>1440px) — full layout
- [ ] Laptop (1025-1440px) — standard layout
- [ ] Tablet (641-1024px) — collapsible panels
- [ ] Mobile (≤640px) — mobile-specific meeting UI

### Accessibility
- [ ] Keyboard navigation on all interactive elements
- [ ] Focus visible rings
- [ ] ARIA labels on icon buttons
- [ ] `aria-live` on dynamic content
- [ ] WCAG AA contrast ratios
- [ ] Touch targets ≥ 44px

### Performance
- [ ] No unnecessary meeting grid re-renders on transcript/translation events
- [ ] Video remains smooth during translation
- [ ] Transcript updates don't block UI
- [ ] Translation state changes don't freeze interface
- [ ] Lazy-loaded routes for non-critical pages

---

## Part XIV: Final Answer

> **If I were responsible for taking the current LinguaMeet frontend and transforming it into the product shown by the reference image, without breaking existing meeting and translation functionality, this is the exact sequence I would perform:**

```
 1. Design Tokens          — Replace color palette, typography, spacing
 2. UI Primitives          — Build Button, Input, Badge, Modal, etc.
 3. Application Shell      — Sidebar, navigation, responsive shell
 4. Authentication         — Restyle Login/Register, add Forgot Password
 5. Landing Page           — Public marketing page
 6. Dashboard              — Rebuild Home into proper dashboard
 7. Pre-Join Screen        — Add device selectors, language, audio test
 8. Meeting UI Core        — Decompose MeetingRoom, restyle grid + toolbar
 9. Translation UX         — Subtitle overlay, status indicators, language flow
10. Panels                 — Transcript/Participants/Chat tabbed panel
11. Summary & Transcripts  — Restyle post-meeting pages
12. Meeting History        — New page (empty state until backend ready)
13. Settings & Notifications — New pages
14. Responsive Polish      — Mobile/tablet audit for all screens
15. Accessibility          — Keyboard, ARIA, contrast, reduced motion
16. Visual QA              — Compare against reference image
17. Functional QA          — Verify all existing features work
```

> [!IMPORTANT]
> **Phase 7 (Meeting UI Core) and Phase 8 (Translation UX) are on the critical path.** They must be done carefully with incremental extraction from the 777-line `MeetingRoom.jsx` monolith, testing after each component extraction to ensure WebRTC, Socket.IO, and translation functionality remain intact.

This plan is designed so that after each phase, the application is in a working state. No phase breaks existing functionality — they only add or restyle.
