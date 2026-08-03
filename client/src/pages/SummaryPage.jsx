import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Summary.css';

const SummaryPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [showTranscript, setShowTranscript] = useState(false);

  // Try to load cached summary, if not trigger generation
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

  // Fetch meeting transcript log
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
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = summary?.actionItems?.length || 0;

  if (loading) {
    return (
      <div className="summary-page">
        <div className="summary-loading">
          <div className="spinner"></div>
          <p>Loading meeting summary…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="summary-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="summary-header">
        <div className="summary-header-inner">
          <button
            id="btn-back-home"
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
          <div className="summary-title-group">
            <h1 className="summary-title">🧠 AI Meeting Summary</h1>
            <span className="summary-room-badge">{roomCode}</span>
          </div>
          <button
            id="btn-generate-summary"
            className="btn btn-primary btn-sm"
            onClick={generateSummary}
            disabled={generating || transcripts.length === 0}
            title={transcripts.length === 0 ? 'No transcript available to summarize' : 'Regenerate AI summary'}
          >
            {generating ? (
              <><span className="spinner-sm"></span> Generating…</>
            ) : summary ? '🔄 Regenerate Summary' : '✨ Generate AI Summary'}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error summary-alert">{error}</div>
      )}

      {!summary && !generating && (
        <div className="summary-empty">
          <div className="summary-empty-icon">🤖</div>
          <h2>No summary yet</h2>
          <p>Click <strong>Generate AI Summary</strong> above to create an executive summary powered by Gemini 1.5 Flash.</p>
          {transcripts.length === 0 && (
            <p className="summary-empty-hint">⚠️ No transcript entries were captured for this meeting.</p>
          )}
        </div>
      )}

      {generating && (
        <div className="summary-generating">
          <div className="summary-generating-animation">
            <div className="generating-dot"></div>
            <div className="generating-dot"></div>
            <div className="generating-dot"></div>
          </div>
          <p>Gemini 1.5 Flash is analyzing your meeting…</p>
        </div>
      )}

      {summary && (
        <main className="summary-content">
          {/* ── Executive Summary ──────────────────────────────────────────── */}
          <section className="summary-card summary-executive" id="section-executive-summary">
            <div className="summary-card-header">
              <span className="summary-card-icon">📋</span>
              <h2>Executive Summary</h2>
            </div>
            <p className="summary-executive-text">{summary.executiveSummary}</p>
          </section>

          <div className="summary-grid">
            {/* ── Key Topics ───────────────────────────────────────────────── */}
            <section className="summary-card summary-topics" id="section-key-topics">
              <div className="summary-card-header">
                <span className="summary-card-icon">💡</span>
                <h2>Key Topics</h2>
              </div>
              {summary.keyTopics?.length > 0 ? (
                <ul className="topics-list">
                  {summary.keyTopics.map((topic, idx) => (
                    <li key={idx} className="topic-pill">{topic}</li>
                  ))}
                </ul>
              ) : (
                <p className="summary-empty-hint">No key topics identified.</p>
              )}
            </section>

            {/* ── Action Items ─────────────────────────────────────────────── */}
            <section className="summary-card summary-actions" id="section-action-items">
              <div className="summary-card-header">
                <span className="summary-card-icon">✅</span>
                <h2>Action Items</h2>
                {totalCount > 0 && (
                  <span className="action-progress-badge">
                    {completedCount}/{totalCount} done
                  </span>
                )}
              </div>
              {summary.actionItems?.length > 0 ? (
                <ul className="action-items-list">
                  {summary.actionItems.map((item, idx) => (
                    <li
                      key={idx}
                      className={`action-item ${checkedItems[idx] ? 'action-item--checked' : ''}`}
                      onClick={() => toggleActionItem(idx)}
                    >
                      <span className="action-checkbox">
                        {checkedItems[idx] ? '☑' : '☐'}
                      </span>
                      <span className="action-text">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="summary-empty-hint">No action items identified.</p>
              )}
            </section>
          </div>

          {/* ── Full Transcript Log ────────────────────────────────────────── */}
          <section className="summary-card summary-transcript-section" id="section-transcript-log">
            <div className="summary-card-header">
              <span className="summary-card-icon">📝</span>
              <h2>Full Transcript</h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowTranscript(prev => !prev)}
              >
                {showTranscript ? '▲ Hide' : '▼ Show'} ({transcripts.length} entries)
              </button>
            </div>
            {showTranscript && (
              <div className="transcript-log">
                {transcripts.length === 0 ? (
                  <p className="summary-empty-hint">No transcript captured.</p>
                ) : (
                  transcripts.map((entry, idx) => (
                    <div key={idx} className="transcript-log-entry">
                      <div className="transcript-log-meta">
                        <span className="transcript-log-speaker">{entry.speakerName}</span>
                        <span className="transcript-log-time">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="transcript-log-lang">{entry.sourceLanguage?.toUpperCase()}</span>
                      </div>
                      <p className="transcript-log-text">{entry.originalText}</p>
                      {entry.translations && Object.entries(entry.translations).map(([lang, text]) => (
                        <p key={lang} className="transcript-log-translation">
                          <span className="transcript-lang-badge">{lang.toUpperCase()}</span> {text}
                        </p>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
};

export default SummaryPage;
