import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Transcripts.css';

/**
 * Transcripts
 * Dedicated transcript archive and inspection page within AppShell.
 * Allows users to search and review live meeting transcripts, multilingual
 * speech utterances, and link directly to AI-generated meeting summaries.
 */
export function Transcripts() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const cleanCode = roomCode.trim().replace(/^#/, '');
    if (!cleanCode) return;

    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      setActiveCode(cleanCode);

      const res = await api.get(`/transcripts/${cleanCode}`);
      setTranscripts(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || `No transcripts found for #${cleanCode}`);
      setTranscripts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (transcripts.length === 0) return;
    const formatted = transcripts
      .map((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const translations = Object.entries(t.translations || {})
          .map(([lang, text]) => `  [${lang.toUpperCase()}] ${text}`)
          .join('\n');
        return `[${time}] ${t.speakerName}:\n  ${t.originalText}\n${translations}`;
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="sam-transcripts-page" aria-label="Meeting transcripts explorer">
      <div className="sam-transcripts-container">
        {/* ── Page Header ── */}
        <header className="sam-transcripts-header">
          <div className="sam-transcripts-title-wrap">
            <div className="sam-transcripts-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h1 className="sam-transcripts-title">Meeting Transcripts</h1>
              <p className="sam-transcripts-subtitle">
                Inspect, search, and export dual-language transcript records across your Samvada sessions.
              </p>
            </div>
          </div>
        </header>

        {/* ── Search & Room Code Lookup Card ── */}
        <div className="sam-transcripts-search-card">
          <form onSubmit={handleSearch} className="sam-transcripts-search-row">
            <div className="sam-transcripts-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-transcripts-search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="sam-transcripts-input"
                placeholder="Enter meeting code (e.g. 1a2b-3c4d)..."
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                aria-label="Room code"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !roomCode.trim()}
              className="sam-transcripts-search-btn"
              aria-label="Find transcript"
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Lookup Transcript</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="sam-summary-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Meeting Metadata Bar (When searched) ── */}
        {searched && activeCode && transcripts.length > 0 && (
          <div className="sam-transcripts-meta-card">
            <div className="sam-transcripts-meta-info">
              <span className="sam-transcripts-room-badge">#{activeCode}</span>
              <span className="sam-transcripts-count-label">
                <strong>{transcripts.length}</strong> speech utterances recorded
              </span>
            </div>

            <div className="sam-transcripts-meta-actions">
              <button
                type="button"
                className="sam-transcripts-action-link"
                onClick={handleCopyTranscript}
                title="Copy entire formatted transcript"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ color: '#00D4B2' }}>Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>Copy All</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="sam-transcripts-action-link sam-transcripts-action-link--summary"
                onClick={() => navigate(`/summary/${activeCode}`)}
                title="View full AI-generated executive briefing"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>View AI Summary</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Transcript Entries Feed ── */}
        {transcripts.length > 0 ? (
          <main className="sam-transcripts-feed">
            {transcripts.map((entry, idx) => (
              <article key={entry._id || idx} className="sam-transcripts-entry-card">
                <div className="sam-transcripts-entry-header">
                  <span className="sam-transcripts-entry-speaker">{entry.speakerName}</span>
                  <div className="sam-transcripts-entry-meta">
                    {entry.sourceLanguage && (
                      <span className="sam-summary-transcript-lang">
                        {entry.sourceLanguage.toUpperCase()}
                      </span>
                    )}
                    <span>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="sam-transcripts-entry-original">{entry.originalText}</p>

                {entry.translations && Object.entries(entry.translations).length > 0 && (
                  <div className="sam-transcripts-entry-trans">
                    {Object.entries(entry.translations).map(([lang, text]) => (
                      <p key={lang} className="sam-transcripts-entry-trans-item">
                        <span className="sam-transcripts-tag">[{lang.toUpperCase()}]</span>
                        <span>{text}</span>
                      </p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </main>
        ) : !loading && (
          <div className="sam-transcripts-empty">
            <div className="sam-transcripts-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h2 className="sam-transcripts-empty-title">
              {searched ? 'No Transcripts Found' : 'Browse Meeting Transcripts'}
            </h2>
            <p className="sam-transcripts-empty-desc">
              {searched
                ? `No speech transcripts were recorded for #${activeCode}. Make sure participants were speaking with speech translation enabled.`
                : 'Enter any Samvada meeting room code above to review complete spoken dialogue, multilingual translations, and generated summaries.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transcripts;
