import React, { useState, useRef, useEffect } from 'react';
import TranscriptItem from './TranscriptItem';
import { getLanguageLabel } from './LanguageSelector';

/**
 * TranscriptPanel
 * Full-featured transcript feed panel for the right-side drawer.
 * Includes search filtering, copy-all export, live translation pill,
 * and auto-scrolling live speech feed.
 */
export function TranscriptPanel({
  transcriptLog = [],
  targetLanguage = 'en',
  onInspectDiagnostics,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const feedEndRef = useRef(null);
  const containerRef = useRef(null);
  const userScrolledUpRef = useRef(false);

  const targetLabel = getLanguageLabel(targetLanguage);

  // Auto-scroll to bottom on new transcripts if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptLog.length]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user is more than 80px from bottom, consider them scrolled up
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    userScrolledUpRef.current = !isAtBottom;
  };

  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter transcript entries
  const filteredLog = transcriptLog.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const speakerMatch = entry.speakerName?.toLowerCase().includes(q);
    const originalMatch = entry.originalText?.toLowerCase().includes(q);
    const translationMatch = Object.values(entry.translations || {}).some((t) =>
      t?.toLowerCase().includes(q)
    );
    return speakerMatch || originalMatch || translationMatch;
  });

  // Copy transcript to clipboard
  const handleCopyTranscript = async () => {
    if (transcriptLog.length === 0) return;

    const formatted = transcriptLog
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const trans = Object.entries(entry.translations || {})
          .map(([lang, text]) => `  [${lang.toUpperCase()}] ${text}`)
          .join('\n');
        return `[${time}] ${entry.speakerName}:\n  ${entry.originalText}\n${trans}`;
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2200);
    } catch (err) {
      console.error('Failed to copy transcript', err);
    }
  };

  return (
    <div className="sam-transcript-panel" aria-label="Meeting live transcript panel">
      {/* ── Subheader Controls ── */}
      <div className="sam-transcript-panel__top">
        <div className="sam-transcript-panel__status-row">
          <div className="sam-transcript-panel__pill" title={`All dialogue translated live into ${targetLabel}`}>
            <span className="sam-transcript-panel__pill-dot" />
            <span>
              Live Translation: <strong>{targetLabel} (Me)</strong>
            </span>
          </div>

          {transcriptLog.length > 0 && (
            <button
              type="button"
              className="sam-transcript-panel__action-btn"
              onClick={handleCopyTranscript}
              title="Copy entire formatted transcript"
              aria-label="Copy transcript"
            >
              {copySuccess ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ color: '#00D4B2' }}>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>Export</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Search Bar */}
        {transcriptLog.length > 2 && (
          <div className="sam-transcript-panel__search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-transcript-panel__search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="sam-transcript-panel__search-input"
              placeholder="Filter by speaker or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter transcript"
            />
            {searchQuery && (
              <button
                type="button"
                className="sam-transcript-panel__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable Feed ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="sam-transcript-panel__feed"
      >
        {filteredLog.length === 0 ? (
          <div className="sam-transcript-panel__empty">
            <div className="sam-transcript-panel__empty-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            {searchQuery ? (
              <>
                <p className="sam-transcript-panel__empty-title">No matching utterances</p>
                <p className="sam-transcript-panel__empty-desc">
                  No transcripts matched &quot;{searchQuery}&quot;. Clear search to view all.
                </p>
              </>
            ) : (
              <>
                <p className="sam-transcript-panel__empty-title">Ready for Live Speech</p>
                <p className="sam-transcript-panel__empty-desc">
                  As participants speak, their words and real-time neural translations will stream here chronologically.
                </p>
                <div className="sam-transcript-panel__empty-hint">
                  Listening in <strong>{targetLabel}</strong>
                </div>
              </>
            )}
          </div>
        ) : (
          filteredLog.map((entry, idx) => (
            <TranscriptItem
              key={entry.id || idx}
              entry={entry}
              targetLanguage={targetLanguage}
              onInspectDiagnostics={onInspectDiagnostics}
            />
          ))
        )}
        <div ref={feedEndRef} />
      </div>

      {/* ── Scroll to Bottom Pill (if user scrolled up) ── */}
      {userScrolledUpRef.current && transcriptLog.length > 3 && (
        <button
          type="button"
          className="sam-transcript-panel__scroll-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to newest transcript"
        >
          <span>Jump to latest</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ── Reference Spec Match: Real-time AI Translation Footer Card ── */}
      <div className="sam-transcript-panel__ai-card">
        <div className="sam-transcript-panel__ai-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div className="sam-transcript-panel__ai-info">
          <span className="sam-transcript-panel__ai-title">Real-time AI Translation</span>
          <span className="sam-transcript-panel__ai-sub">Multiple languages. Natural voice. &lt; 1s</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sam-transcript-panel__ai-arrow" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

export default TranscriptPanel;
