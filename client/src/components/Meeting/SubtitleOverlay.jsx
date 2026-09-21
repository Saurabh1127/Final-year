import React from 'react';
import { getLanguageLabel } from './LanguageSelector';

/**
 * SubtitleOverlay
 * Centered floating subtitle container displaying live AI translated speech.
 * Redesigned per Phase 8:
 * - Prominent Language Header (e.g. "AI TRANSLATION • HINDI → ENGLISH")
 * - Original text (dim/italic) on top
 * - Translated text (bright white) below
 * - Latency pill & pipeline diagnostics inspector trigger
 * - Smooth CSS fade-in animation
 */
export function SubtitleOverlay({
  subtitle,
  onInspectDiagnostics,
}) {
  if (!subtitle) return null;

  const isSelf = subtitle.isSelf;
  const hasDiffTranslation = subtitle.originalText && subtitle.originalText !== subtitle.translatedText;
  const langLabel = getLanguageLabel(subtitle.lang);

  return (
    <div
      className="sam-subtitle-overlay"
      id="subtitle-overlay"
      role="region"
      aria-live="polite"
      aria-label="Live speech translation subtitle"
    >
      {/* ── Subtitle Top Bar: Language flow & Speaker ── */}
      <div className="sam-subtitle-overlay__header">
        <div className="sam-subtitle-overlay__header-left">
          <div className="sam-subtitle-overlay__lang-pill">
            <span className="sam-subtitle-overlay__lang-dot" />
            <span>
              {isSelf ? 'YOU (SPEECH INPUT)' : `TRANSLATED SUBTITLE • ${langLabel.toUpperCase()}`}
            </span>
          </div>

          <span className="sam-subtitle-overlay__speaker">
            {subtitle.speakerName}
          </span>
        </div>

        <div className="sam-subtitle-overlay__header-right">
          {subtitle.displayLatency && (
            <span className="sam-subtitle-overlay__latency" title="End-to-end translation latency">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{subtitle.displayLatency}</span>
            </span>
          )}

          {subtitle.diagnostics && onInspectDiagnostics && (
            <button
              type="button"
              className="sam-subtitle-overlay__inspect-btn"
              onClick={() => onInspectDiagnostics(subtitle)}
              title="Inspect neural translation pipeline diagnostics"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Diagnostics</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Subtitle Body: Dim original text + Bright translated text ── */}
      <div className="sam-subtitle-overlay__content">
        {isSelf ? (
          <p className="sam-subtitle-overlay__text-primary">
            &ldquo;{subtitle.originalText}&rdquo;
          </p>
        ) : (
          <>
            {hasDiffTranslation && (
              <p className="sam-subtitle-overlay__text-secondary">
                &ldquo;{subtitle.originalText}&rdquo;
              </p>
            )}
            <p className="sam-subtitle-overlay__text-primary">
              {subtitle.translatedText || subtitle.originalText}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SubtitleOverlay;
