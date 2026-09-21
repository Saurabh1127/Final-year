import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MeetingHistory.css';

/**
 * MeetingHistory
 * Dedicated meeting history and logs page within AppShell.
 * Provides search, category filtering, meeting detail cards,
 * and a rich empty state ready for backend list synchronization.
 */
export function MeetingHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [meetings, setMeetings] = useState([]);

  // Load any local/session history if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('samvada_recent_meetings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMeetings(parsed);
        }
      }
    } catch {
      setMeetings([]);
    }
  }, []);

  // Filter meetings based on active search and category
  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch =
      !searchQuery.trim() ||
      meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.roomCode?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'hosted') {
      return meeting.isHost || meeting.hostId === user?.id;
    }
    if (activeFilter === 'transcripts') {
      return Boolean(meeting.hasTranscripts);
    }
    if (activeFilter === 'summaries') {
      return Boolean(meeting.hasSummary);
    }
    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Calls', count: meetings.length },
    { id: 'hosted', label: 'Hosted by Me' },
    { id: 'transcripts', label: 'With Transcripts' },
    { id: 'summaries', label: 'With AI Summaries' },
  ];

  return (
    <div className="sam-history-page" aria-label="Meeting history archive">
      <div className="sam-history-container">
        {/* ── Page Header ── */}
        <header className="sam-history-header">
          <div className="sam-history-title-wrap">
            <div className="sam-history-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div>
              <h1 className="sam-history-title">Meeting History</h1>
              <p className="sam-history-subtitle">
                Review completed calls, speech transcripts, and AI-generated executive summaries.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sam-history-cta-btn"
            onClick={() => navigate('/')}
            aria-label="Start or join meeting"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Start New Meeting</span>
          </button>
        </header>

        {/* ── Search & Filters Bar ── */}
        <div className="sam-history-controls-card">
          <div className="sam-history-search-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-history-search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="sam-history-search-input"
              placeholder="Search by title, room code, or participant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search meetings"
            />
          </div>

          <div className="sam-history-filters-row">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`sam-history-filter-pill ${isActive ? 'sam-history-filter-pill--active' : ''}`}
                  aria-pressed={isActive}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="sam-history-filter-count">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Meetings Grid or Empty State ── */}
        {filteredMeetings.length > 0 ? (
          <main className="sam-history-grid">
            {filteredMeetings.map((meeting, idx) => (
              <article key={meeting.id || meeting.roomCode || idx} className="sam-history-card">
                <div className="sam-history-card__header">
                  <div className="sam-history-card__title-wrap">
                    <h2 className="sam-history-card__title">{meeting.title || `Meeting #${meeting.roomCode}`}</h2>
                    <div className="sam-history-card__date">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>{new Date(meeting.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <span className="sam-history-card__room-pill">#{meeting.roomCode}</span>
                </div>

                <div className="sam-history-card__details">
                  <div className="sam-history-card__detail-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>{meeting.participantCount || 1} participants</span>
                  </div>

                  {meeting.languages && (
                    <div className="sam-history-card__detail-item">
                      <span>🌐 {meeting.languages}</span>
                    </div>
                  )}
                </div>

                <div className="sam-history-card__actions">
                  <button
                    type="button"
                    className="sam-history-btn-secondary"
                    onClick={() => navigate(`/summary/${meeting.roomCode}`)}
                  >
                    AI Summary
                  </button>

                  <button
                    type="button"
                    className="sam-history-btn-primary"
                    onClick={() => navigate(`/meeting/${meeting.roomCode}`)}
                  >
                    Rejoin Call
                  </button>
                </div>
              </article>
            ))}
          </main>
        ) : (
          <div className="sam-history-empty">
            <div className="sam-history-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h2 className="sam-history-empty-title">
              {searchQuery ? 'No Matching Meetings Found' : 'No Meeting History Yet'}
            </h2>
            <p className="sam-history-empty-desc">
              {searchQuery
                ? `No calls matched "${searchQuery}". Try searching with a different room code or title.`
                : 'Your completed conferences, speech translations, and executive AI summaries will be cataloged here.'}
            </p>

            <button
              type="button"
              className="sam-history-cta-btn"
              onClick={() => navigate('/')}
            >
              Start Your First Meeting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingHistory;
