import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Summary.css';

/**
 * SummaryPage
 * Post-meeting intelligence briefing for Samvada conferences.
 * Renders automated executive summary, key topics, interactive action items,
 * and full dual-language transcript logs.
 */
export function SummaryPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [showTranscript, setShowTranscript] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // 1. Fetch cached summary if available
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/meetings/${roomCode}/summary`);
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch {
      // No cached summary yet — will generate on demand
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  // 2. Fetch meeting transcript logs
  const loadTranscripts = useCallback(async () => {
    try {
      const res = await api.get(`/transcripts/${roomCode}`);
      setTranscripts(res.data?.data || []);
    } catch {
      setTranscripts([]);
    }
  }, [roomCode]);

  useEffect(() => {
    loadSummary();
    loadTranscripts();
  }, [loadSummary, loadTranscripts]);

  // 3. Generate summary on demand
  const generateSummary = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await api.post(`/meetings/${roomCode}/summarize`);
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate summary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleActionItem = (idx) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = summary?.actionItems?.length || 0;

  const handleCopySummary = () => {
    if (!summary) return;
    const text = `Executive Summary (${roomCode}):\n${summary.executiveSummary}\n\nKey Topics:\n${summary.keyTopics?.join(', ')}\n\nAction Items:\n${summary.actionItems?.map((a) => `- ${a}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  if (loading) {
    return (
      <div className="sam-summary-page">
        <div className="sam-summary-container">
          <div className="sam-summary-loading-box">
            <div className="sam-summary-bouncing-dots">
              <span className="sam-summary-dot" />
              <span className="sam-summary-dot" />
              <span className="sam-summary-dot" />
            </div>
            <p className="sam-summary-loading-title">Retrieving Meeting Intelligence…</p>
            <p className="sam-summary-loading-sub">Fetching transcripts and cached AI briefings for #{roomCode}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sam-summary-page" aria-label="Meeting summary and transcripts page">
      <div className="sam-summary-container">
        {/* ── Top Header Bar ── */}
        <header className="sam-summary-header">
          <div className="sam-summary-header__left">
            <button
              type="button"
              id="btn-back-home"
              onClick={() => navigate('/')}
              className="sam-summary-header__back-btn"
              aria-label="Back to dashboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Dashboard</span>
            </button>

            <div className="sam-summary-header__title-wrap">
              <h1 className="sam-summary-header__title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 12h6m-6 4h6" />
                </svg>
                <span>Meeting Intelligence</span>
              </h1>
              <span className="sam-summary-header__room-pill">#{roomCode}</span>
            </div>
          </div>

          <div className="sam-summary-header__right">
            <button
              type="button"
              id="btn-generate-summary"
              onClick={generateSummary}
              disabled={generating || transcripts.length === 0}
              title={transcripts.length === 0 ? 'No transcript records available to summarize' : 'Generate automated AI briefing'}
              className="sam-summary-btn-generate"
              aria-label="Generate AI summary"
            >
              {generating ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                  <span>Synthesizing Insights…</span>
                </>
              ) : summary ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>Regenerate Summary</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                  <span>Generate AI Summary</span>
                </>
              )}
            </button>
          </div>
        </header>

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

        {/* ── Generating Banner ── */}
        {generating && (
          <div className="sam-summary-loading-box">
            <div className="sam-summary-bouncing-dots">
              <span className="sam-summary-dot" />
              <span className="sam-summary-dot" />
              <span className="sam-summary-dot" />
            </div>
            <p className="sam-summary-loading-title">Analyzing Multilingual Dialogue</p>
            <p className="sam-summary-loading-sub">
              Extracting key decisions, executive summaries, and action assignments…
            </p>
          </div>
        )}

        {/* ── Empty State (No Summary Yet) ── */}
        {!summary && !generating && (
          <div className="sam-summary-empty-card">
            <div className="sam-summary-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            <h2 className="sam-summary-empty-title">No Summary Generated Yet</h2>
            <p className="sam-summary-empty-desc">
              Click <strong>Generate AI Summary</strong> above to automatically synthesize an executive briefing, identified topics, and assigned tasks.
            </p>
            {transcripts.length === 0 ? (
              <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
                ⚠️ No speech transcript records were captured during this call session.
              </span>
            ) : (
              <span style={{ color: '#00d4b2', fontSize: '0.75rem' }}>
                ✓ {transcripts.length} transcript entries available for analysis
              </span>
            )}
          </div>
        )}

        {/* ── Summary Content Grid ── */}
        {summary && (
          <main className="sam-summary-grid">
            {/* 1. Executive Summary */}
            <section className="sam-summary-card">
              <div className="sam-summary-card__header">
                <div className="sam-summary-card__title-group">
                  <div className="sam-summary-card__icon sam-summary-card__icon--mint">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <h2 className="sam-summary-card__title">Executive Summary</h2>
                </div>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="sam-summary-header__back-btn"
                  title="Copy executive briefing to clipboard"
                  aria-label="Copy summary text"
                >
                  {copiedSummary ? (
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
                      <span>Copy Brief</span>
                    </>
                  )}
                </button>
              </div>

              <p className="sam-summary-executive-text">
                {summary.executiveSummary}
              </p>
            </section>

            {/* 2. Two-Column Grid for Topics & Action Items */}
            <div className="sam-summary-grid sam-summary-grid--two-col">
              {/* Key Topics */}
              <section className="sam-summary-card">
                <div className="sam-summary-card__header">
                  <div className="sam-summary-card__title-group">
                    <div className="sam-summary-card__icon sam-summary-card__icon--cyan">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                      </svg>
                    </div>
                    <h2 className="sam-summary-card__title">Key Topics</h2>
                  </div>
                </div>

                {summary.keyTopics?.length > 0 ? (
                  <div className="sam-summary-topics-wrap">
                    {summary.keyTopics.map((topic, idx) => (
                      <span key={idx} className="sam-summary-topic-tag">
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No key topics identified.</p>
                )}
              </section>

              {/* Action Items */}
              <section className="sam-summary-card">
                <div className="sam-summary-card__header">
                  <div className="sam-summary-card__title-group">
                    <div className="sam-summary-card__icon sam-summary-card__icon--emerald">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <h2 className="sam-summary-card__title">Action Items</h2>
                  </div>

                  {totalCount > 0 && (
                    <span className="sam-summary-badge-completed">
                      {completedCount}/{totalCount} Completed
                    </span>
                  )}
                </div>

                {summary.actionItems?.length > 0 ? (
                  <ul className="sam-summary-actions-list">
                    {summary.actionItems.map((item, idx) => (
                      <li
                        key={idx}
                        onClick={() => toggleActionItem(idx)}
                        className={`sam-summary-action-item ${
                          checkedItems[idx] ? 'sam-summary-action-item--checked' : ''
                        }`}
                        role="checkbox"
                        aria-checked={Boolean(checkedItems[idx])}
                        tabIndex={0}
                      >
                        <div className="sam-summary-action-checkbox">
                          {checkedItems[idx] && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <p className="sam-summary-action-text">{item}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No action items extracted.</p>
                )}
              </section>
            </div>

            {/* 3. Full Meeting Transcript Section */}
            <section className="sam-summary-card">
              <div className="sam-summary-card__header">
                <div className="sam-summary-card__title-group">
                  <div className="sam-summary-card__icon sam-summary-card__icon--purple">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h2 className="sam-summary-card__title">Meeting Speech Log</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTranscript((prev) => !prev)}
                  className="sam-summary-header__back-btn"
                  aria-label="Toggle transcript visibility"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: showTranscript ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span>{showTranscript ? 'Hide' : 'Show'} ({transcripts.length} utterances)</span>
                </button>
              </div>

              {showTranscript && (
                <div className="sam-summary-transcript-log">
                  {transcripts.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No transcripts captured for this call.</p>
                  ) : (
                    transcripts.map((entry, idx) => (
                      <article key={idx} className="sam-summary-transcript-entry">
                        <div className="sam-summary-transcript-meta">
                          <span className="sam-summary-transcript-speaker">{entry.speakerName}</span>
                          <span className="sam-summary-transcript-time">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          {entry.sourceLanguage && (
                            <span className="sam-summary-transcript-lang">
                              {entry.sourceLanguage.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <p className="sam-summary-transcript-original">{entry.originalText}</p>

                        {entry.translations &&
                          Object.entries(entry.translations).map(([lang, text]) => (
                            <div key={lang} className="sam-summary-transcript-translations">
                              <p className="sam-summary-transcript-trans-row">
                                <span className="sam-summary-transcript-trans-tag">[{lang.toUpperCase()}]</span>
                                <span>{text}</span>
                              </p>
                            </div>
                          ))}
                      </article>
                    ))
                  )}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

export default SummaryPage;
