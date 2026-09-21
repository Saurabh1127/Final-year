import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

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
      <div className="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center font-sans text-slate-100">
        <div className="w-10 h-10 border-3 border-white/10 border-t-[#00d4b2] rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-400 font-medium">Loading meeting summary…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#090a0f] text-slate-100 font-sans p-4 sm:p-6 md:p-8 flex flex-col">
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#12151e]/80 border border-white/[0.08] backdrop-blur-xl w-full">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <button
              id="btn-back-home"
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition flex items-center gap-1.5 shrink-0"
            >
              ← Back to Home
            </button>
            <div className="flex sm:hidden items-center gap-2">
              <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#00d4b2]/10 border border-[#00d4b2]/25 text-[#00d4b2] font-semibold">
                {roomCode}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00d4b2]">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M9 12h6m-6 4h6" />
              </svg>
              <span>Meeting Summary</span>
            </h1>
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#00d4b2]/10 border border-[#00d4b2]/25 text-[#00d4b2] font-semibold">
              {roomCode}
            </span>
          </div>

          <button
            id="btn-generate-summary"
            onClick={generateSummary}
            disabled={generating || transcripts.length === 0}
            title={transcripts.length === 0 ? 'No transcript available to summarize' : 'Regenerate AI summary'}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00d4b2] hover:bg-[#33e0c4] text-slate-950 transition shadow-lg shadow-[#00d4b2]/20 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {generating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin"></span>
                Generating…
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                <span>Generate AI Summary</span>
              </>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="w-full max-w-5xl mx-auto mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}

      {!summary && !generating && (
        <div className="w-full max-w-5xl mx-auto p-12 text-center rounded-2xl bg-[#12151e]/60 border border-white/[0.08] backdrop-blur-xl my-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#00d4b2]/10 border border-[#00d4b2]/20 flex items-center justify-center text-[#00d4b2] mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No summary yet</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
            Click <strong className="text-slate-200">Generate AI Summary</strong> above to create an automated executive briefing and action items.
          </p>
          {transcripts.length === 0 && (
            <p className="text-xs text-amber-400 font-medium flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>No transcript entries were captured for this meeting.</span>
            </p>
          )}
        </div>
      )}

      {generating && (
        <div className="w-full max-w-5xl mx-auto p-16 text-center rounded-2xl bg-[#12151e]/60 border border-white/[0.08] backdrop-blur-xl my-auto">
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00d4b2] animate-bounce"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#00d4b2] animate-bounce [animation-delay:0.15s]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#00d4b2] animate-bounce [animation-delay:0.3s]"></div>
          </div>
          <p className="text-sm text-slate-300 font-medium">Analyzing meeting dialogue and generating structured insights…</p>
        </div>
      )}

      {summary && (
        <main className="w-full max-w-5xl mx-auto flex flex-col gap-6">
          {/* Executive Summary */}
          <section className="p-6 md:p-8 rounded-2xl bg-[#12151e]/80 border border-white/[0.08] backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2.5 mb-4 text-[#00d4b2]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <h2 className="text-lg font-bold text-white">Executive Summary</h2>
            </div>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed pl-3 border-l-2 border-[#00d4b2]">
              {summary.executiveSummary}
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Topics */}
            <section className="p-6 rounded-2xl bg-[#12151e]/80 border border-white/[0.08] backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2.5 mb-4 text-[#38bdf8]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                <h2 className="text-lg font-bold text-white">Key Topics</h2>
              </div>
              {summary.keyTopics?.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {summary.keyTopics.map((topic, idx) => (
                    <li
                      key={idx}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No key topics identified.</p>
              )}
            </section>

            {/* Action Items */}
            <section className="p-6 rounded-2xl bg-[#12151e]/80 border border-white/[0.08] backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5 text-[#10b981]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <h2 className="text-lg font-bold text-white">Action Items</h2>
                </div>
                {totalCount > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                    {completedCount}/{totalCount} completed
                  </span>
                )}
              </div>
              {summary.actionItems?.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {summary.actionItems.map((item, idx) => (
                    <li
                      key={idx}
                      onClick={() => toggleActionItem(idx)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 text-sm ${
                        checkedItems[idx]
                          ? 'bg-emerald-500/[0.06] border-emerald-500/30 text-slate-400 line-through'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      {checkedItems[idx] ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0 mt-0.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="w-4 h-4 rounded border border-white/30 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No action items identified.</p>
              )}
            </section>
          </div>

          {/* Full Transcript Log */}
          <section className="p-6 rounded-2xl bg-[#12151e]/80 border border-white/[0.08] backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 text-slate-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h2 className="text-lg font-bold text-white">Full Meeting Transcript</h2>
              </div>
              <button
                onClick={() => setShowTranscript(prev => !prev)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showTranscript ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>{showTranscript ? 'Hide' : 'Show'} ({transcripts.length} entries)</span>
              </button>
            </div>

            {showTranscript && (
              <div className="mt-4 max-h-[500px] overflow-y-auto flex flex-col gap-3 pr-2">
                {transcripts.length === 0 ? (
                  <p className="text-xs text-slate-500">No transcript captured.</p>
                ) : (
                  transcripts.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/[0.02] border-l-2 border-[#00d4b2] border-y border-r border-white/[0.06]"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-xs">
                        <span className="font-bold text-[#00d4b2]">{entry.speakerName}</span>
                        <span className="text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 font-mono text-[10px]">
                          {entry.sourceLanguage?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 mb-1">{entry.originalText}</p>
                      {entry.translations && Object.entries(entry.translations).map(([lang, text]) => (
                        <p key={lang} className="text-xs text-slate-400 mt-1 pl-2 border-l border-white/10">
                          <span className="font-mono text-[10px] text-[#38bdf8] uppercase font-bold mr-1.5">[{lang}]</span>
                          {text}
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
