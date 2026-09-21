import React, { useState, useEffect, useRef } from 'react';
import LanguageSelector, { getLanguageLabel } from './LanguageSelector';

/**
 * MeetingHeader
 * Top navigation bar for the active meeting room.
 * Displays meeting branding, LIVE status, timer, network health,
 * title/code copy, AI translation status indicator, and controls.
 */
export function MeetingHeader({
  meetingTitle = 'Untitled Meeting',
  roomCode = '',
  participantCount = 1,
  connected = true,
  copyToast = false,
  onCopyLink,
  sourceLanguage = 'auto',
  setSourceLanguage,
  targetLanguage = 'hi',
  onLanguageChange,
  translationEnabled = false,
  setTranslationEnabled,
  isTranslating = false,
  isPending = false,
  isReceiving = false,
  showTranscript = false,
  setShowTranscript,
  transcriptCount = 0,
  onOpenDiagnostics,
  onOpenParticipants,
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTimer = (totalSeconds) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`;
  };

  const srcName = getLanguageLabel(sourceLanguage);
  const tgtName = getLanguageLabel(targetLanguage);

  return (
    <header className="sam-meeting-header" id="meeting-header">
      <div className="sam-meeting-header__inner">
        {/* ── Left: Branding, LIVE indicator, Timer, Meeting Info ── */}
        <div className="sam-meeting-header__left">
          {/* Logo & LIVE Badge */}
          <div className="sam-meeting-header__brand-group">
            <div className="sam-meeting-header__logo" title="Samvada Multilingual Video">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
                <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="16" cy="16" r="3.5" fill="currentColor" />
              </svg>
            </div>

            <div className="sam-meeting-header__live-pill">
              <span className="sam-meeting-header__live-dot" />
              <span>LIVE</span>
            </div>

            <div className="sam-meeting-header__timer" title="Meeting duration" id="meeting-timer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTimer(elapsed)}</span>
            </div>
          </div>

          <div className="sam-meeting-header__divider" />

          {/* Meeting Title & Room Code Copy */}
          <div className="sam-meeting-header__info-group">
            <h1 className="sam-meeting-header__title" title={meetingTitle}>
              {meetingTitle}
            </h1>

            <button
              type="button"
              className="sam-meeting-header__code-btn"
              onClick={onCopyLink}
              title="Click to copy meeting invite link"
              id="btn-copy-link"
              aria-label={`Copy meeting room code #${roomCode}`}
            >
              <span>#{roomCode}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {copyToast ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </>
                )}
              </svg>
            </button>

            {copyToast && (
              <span className="sam-meeting-header__toast" id="copy-toast">
                Copied!
              </span>
            )}

            {/* Participant Count */}
            <div
              className={`sam-meeting-header__count-badge ${onOpenParticipants ? 'sam-meeting-header__count-badge--clickable' : ''}`}
              id="participant-count"
              onClick={onOpenParticipants}
              title={onOpenParticipants ? 'Click to view participants roster' : 'Participants in meeting'}
              role={onOpenParticipants ? 'button' : undefined}
              tabIndex={onOpenParticipants ? 0 : undefined}
              aria-label={`${participantCount} attendees in meeting`}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onOpenParticipants) {
                  e.preventDefault();
                  onOpenParticipants();
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{participantCount}</span>
            </div>

            {/* Network Indicator */}
            <div
              className={`sam-meeting-header__network ${connected ? 'sam-meeting-header__network--online' : 'sam-meeting-header__network--offline'}`}
              id="network-indicator"
              title={connected ? 'Realtime WebRTC & Socket connected' : 'Connection interrupted. Reconnecting...'}
            >
              <span className="sam-meeting-header__network-dot" />
              {!connected && <span className="sam-meeting-header__network-label">Reconnecting</span>}
            </div>
          </div>
        </div>

        {/* ── Center / Prominent AI Translation Status Indicator ── */}
        <div className="sam-meeting-header__center">
          <div
            className={`sam-ai-pipeline-status ${
              isTranslating
                ? 'sam-ai-pipeline-status--asr'
                : isPending
                ? 'sam-ai-pipeline-status--nmt'
                : isReceiving
                ? 'sam-ai-pipeline-status--tts'
                : translationEnabled
                ? 'sam-ai-pipeline-status--active'
                : 'sam-ai-pipeline-status--idle'
            }`}
            id="header-translation-status"
            title="Real-time status of Whisper ASR, NLLB-200 translation, and Edge-TTS synthesis"
          >
            {isTranslating ? (
              <>
                <span className="sam-ai-pipeline-status__dot sam-ai-pipeline-status__dot--asr" />
                <span className="sam-ai-pipeline-status__text">
                  <strong>ASR Active:</strong> Streaming Voice…
                </span>
              </>
            ) : isPending ? (
              <>
                <span className="sam-ai-pipeline-status__spinner" />
                <span className="sam-ai-pipeline-status__text">
                  <strong>NMT:</strong> Translating ({srcName} → {tgtName})…
                </span>
              </>
            ) : isReceiving ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span className="sam-ai-pipeline-status__text">
                  <strong>TTS:</strong> Synthesizing Audio…
                </span>
              </>
            ) : translationEnabled ? (
              <>
                <span className="sam-ai-pipeline-status__dot sam-ai-pipeline-status__dot--active" />
                <span className="sam-ai-pipeline-status__text">
                  AI Translation: <strong>{srcName} → {tgtName}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="sam-ai-pipeline-status__dot sam-ai-pipeline-status__dot--idle" />
                <span className="sam-ai-pipeline-status__text">
                  AI Pipeline: <strong>Ready</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Right: AI Language Pipeline & View Controls ── */}
        <div className="sam-meeting-header__right">
          {/* Language Selectors */}
          <div className="sam-meeting-header__lang-controls">
            <LanguageSelector
              currentLanguage={sourceLanguage}
              onChange={setSourceLanguage}
              disabled={isTranslating}
              label="Speak:"
              includeAuto={true}
            />

            <LanguageSelector
              currentLanguage={targetLanguage}
              onChange={onLanguageChange}
              disabled={isTranslating}
              label="Listen in:"
            />
          </div>

          {/* AI Translation Toggle Button */}
          <button
            type="button"
            id="btn-toggle-translation"
            className={`sam-meeting-header__action-btn ${
              translationEnabled
                ? 'sam-meeting-header__action-btn--trans-active'
                : 'sam-meeting-header__action-btn--trans-idle'
            }`}
            onClick={() => setTranslationEnabled((prev) => !prev)}
            title={translationEnabled ? 'Stop real-time translation' : 'Start real-time speech translation'}
            aria-label={translationEnabled ? 'Stop real-time AI speech translation' : 'Start real-time AI speech translation'}
          >
            {isTranslating ? (
              <>
                <span className="sam-meeting-header__pulse-dot" />
                <span>Streaming…</span>
              </>
            ) : isPending ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" fill="none" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" fill="none" />
                </svg>
                <span>Translating…</span>
              </>
            ) : isReceiving ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span>Playing…</span>
              </>
            ) : translationEnabled ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>Stop AI</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>Translate</span>
              </>
            )}
          </button>

          {/* Transcript Drawer Toggle */}
          <button
            type="button"
            id="btn-toggle-transcript"
            className={`sam-meeting-header__action-btn ${showTranscript ? 'sam-meeting-header__action-btn--active' : ''}`}
            onClick={() => setShowTranscript((prev) => !prev)}
            title="Toggle live dual-language transcript"
            aria-label="Toggle live dual-language transcript drawer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Transcript {transcriptCount > 0 ? `(${transcriptCount})` : ''}</span>
          </button>

          {/* Diagnostics Inspector Button */}
          <button
            type="button"
            id="btn-toggle-diagnostics"
            className="sam-meeting-header__action-btn"
            onClick={onOpenDiagnostics}
            title="Inspect Whisper ASR, NLLB translation, and Edge-TTS diagnostics"
            aria-label="Inspect AI speech translation pipeline diagnostics"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="sam-meeting-header__hide-mobile">Telemetry</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default MeetingHeader;
