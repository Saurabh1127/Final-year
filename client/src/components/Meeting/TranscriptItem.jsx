import React from 'react';
import { getLanguageLabel } from './LanguageSelector';

/**
 * TranscriptItem
 * Represents a single speech utterance in the live transcript feed.
 * Displays speaker identity, timestamp, original transcript,
 * and high-contrast neural translations.
 */
export function TranscriptItem({
  entry,
  onInspectDiagnostics,
  targetLanguage = 'en',
}) {
  if (!entry) return null;

  const {
    speakerName = 'Participant',
    originalText = '',
    translations = {},
    timestamp = Date.now(),
    diagnostics = null,
  } = entry;

  const timeFormatted = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const targetLabel = getLanguageLabel(targetLanguage);
  const targetTranslation = translations?.[targetLanguage];

  // Get other translations if any
  const otherTranslations = Object.entries(translations || {}).filter(
    ([lang]) => lang !== targetLanguage
  );

  const initial = speakerName.charAt(0).toUpperCase() || 'U';

  return (
    <article className="sam-transcript-item" aria-label={`Utterance by ${speakerName}`}>
      {/* ── Item Header ── */}
      <div className="sam-transcript-item__header">
        <div className="sam-transcript-item__author">
          <div className="sam-transcript-item__avatar" aria-hidden="true">
            {initial}
          </div>
          <div className="sam-transcript-item__meta">
            <span className="sam-transcript-item__name">{speakerName}</span>
            <span className="sam-transcript-item__time">{timeFormatted}</span>
          </div>
        </div>

        {diagnostics && onInspectDiagnostics && (
          <button
            type="button"
            className="sam-transcript-item__inspect-btn"
            onClick={() => onInspectDiagnostics(entry)}
            title="Inspect ASR & translation diagnostics"
            aria-label="Inspect diagnostics"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>Telemetry</span>
          </button>
        )}
      </div>

      {/* ── Spoken Original Text ── */}
      {originalText && (
        <div className="sam-transcript-item__original-wrap">
          <span className="sam-transcript-item__label">Spoken:</span>
          <p className="sam-transcript-item__original">{originalText}</p>
        </div>
      )}

      {/* ── Primary Target Translation ── */}
      {targetTranslation && (
        <div className="sam-transcript-item__target-wrap">
          <div className="sam-transcript-item__target-header">
            <span className="sam-transcript-item__target-badge">
              {targetLabel} (Target)
            </span>
          </div>
          <p className="sam-transcript-item__target-text">{targetTranslation}</p>
        </div>
      )}

      {/* ── Additional Language Translations (if multi-cast) ── */}
      {otherTranslations.length > 0 && (
        <div className="sam-transcript-item__others">
          {otherTranslations.map(([lang, text]) => (
            <div key={lang} className="sam-transcript-item__other-row">
              <span className="sam-transcript-item__lang-tag">[{lang.toUpperCase()}]</span>
              <span className="sam-transcript-item__other-text">{text}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default TranscriptItem;
