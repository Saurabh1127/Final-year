import React, { useState } from 'react';
import { getLanguageLabel } from './LanguageSelector';

/**
 * ParticipantsPanel
 * Renders the roster of all current call attendees (local user + remote peers)
 * with real-time mic/camera statuses, language preferences, search filtering,
 * and quick invite link copying.
 */
export function ParticipantsPanel({
  participants = [],
  localParticipant = {},
  sourceLanguage = 'auto',
  targetLanguage = 'en',
  roomCode = '',
  onCopyLink,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const localName = localParticipant.name || 'You';
  const isLocalHost = Boolean(localParticipant.isHost);
  const localMuted = Boolean(localParticipant.isMuted);
  const localVideoOff = Boolean(localParticipant.isVideoOff);

  const totalCount = participants.length + 1; // 1 for local user

  // Filter remote participants
  const filteredRemote = participants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const name = p.displayName || p.name || 'Participant';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const matchesLocal = !searchQuery.trim() || localName.toLowerCase().includes(searchQuery.toLowerCase());

  const handleCopy = () => {
    if (onCopyLink) {
      onCopyLink();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (roomCode) {
      const url = `${window.location.origin}/meeting/${roomCode}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="sam-participants-panel" aria-label="Meeting participants roster">
      {/* ── Top Bar: Search & Invite ── */}
      <div className="sam-participants-panel__top">
        <div className="sam-participants-panel__search-row">
          <div className="sam-participants-panel__search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-participants-panel__search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="sam-participants-panel__search-input"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search participants"
            />
            {searchQuery && (
              <button
                type="button"
                className="sam-participants-panel__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className="sam-participants-panel__invite-btn"
            onClick={handleCopy}
            title="Copy meeting invite link to clipboard"
            aria-label="Copy invite link"
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span>Invite</span>
              </>
            )}
          </button>
        </div>

        <div className="sam-participants-panel__count-header">
          <span className="sam-participants-panel__count-label">In this meeting</span>
          <span className="sam-participants-panel__count-badge">{totalCount}</span>
        </div>
      </div>

      {/* ── Scrollable List ── */}
      <div className="sam-participants-panel__list">
        {/* Local Participant (You) */}
        {matchesLocal && (
          <div className="sam-participant-row sam-participant-row--local">
            <div className="sam-participant-row__avatar-wrap">
              <div className="sam-participant-row__avatar sam-participant-row__avatar--local">
                {getInitials(localName)}
              </div>
              <span className="sam-participant-row__online-dot" />
            </div>

            <div className="sam-participant-row__info">
              <div className="sam-participant-row__name-wrap">
                <span className="sam-participant-row__name">{localName}</span>
                <span className="sam-participant-row__tag sam-participant-row__tag--you">You</span>
                {isLocalHost && (
                  <span className="sam-participant-row__tag sam-participant-row__tag--host">Host</span>
                )}
              </div>
              <div className="sam-participant-row__lang">
                <span>🎙️ {getLanguageLabel(sourceLanguage)}</span>
                <span className="sam-participant-row__lang-arrow">→</span>
                <span>🎧 {getLanguageLabel(targetLanguage)}</span>
              </div>
            </div>

            <div className="sam-participant-row__media">
              <div
                className={`sam-participant-row__media-icon ${
                  localMuted ? 'sam-participant-row__media-icon--muted' : 'sam-participant-row__media-icon--active'
                }`}
                title={localMuted ? 'Microphone muted' : 'Microphone active'}
              >
                {localMuted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                )}
              </div>

              <div
                className={`sam-participant-row__media-icon ${
                  localVideoOff ? 'sam-participant-row__media-icon--video-off' : 'sam-participant-row__media-icon--active'
                }`}
                title={localVideoOff ? 'Camera turned off' : 'Camera active'}
              >
                {localVideoOff ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Remote Participants */}
        {filteredRemote.map((p) => {
          const name = p.displayName || p.name || 'Participant';
          const isHost = Boolean(p.isHost);
          const isMuted = Boolean(p.isMuted);
          const isVideoOff = Boolean(p.isVideoOff);
          const targetLang = p.targetLanguage || 'hi';

          return (
            <div key={p.userId || p.id} className="sam-participant-row">
              <div className="sam-participant-row__avatar-wrap">
                <div className="sam-participant-row__avatar">
                  {getInitials(name)}
                </div>
                <span className="sam-participant-row__online-dot" />
              </div>

              <div className="sam-participant-row__info">
                <div className="sam-participant-row__name-wrap">
                  <span className="sam-participant-row__name">{name}</span>
                  {isHost && (
                    <span className="sam-participant-row__tag sam-participant-row__tag--host">Host</span>
                  )}
                </div>
                <div className="sam-participant-row__lang">
                  <span>🎧 Listening in {getLanguageLabel(targetLang)}</span>
                </div>
              </div>

              <div className="sam-participant-row__media">
                <div
                  className={`sam-participant-row__media-icon ${
                    isMuted ? 'sam-participant-row__media-icon--muted' : 'sam-participant-row__media-icon--active'
                  }`}
                  title={isMuted ? `${name}'s mic is muted` : `${name}'s mic is active`}
                >
                  {isMuted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  )}
                </div>

                <div
                  className={`sam-participant-row__media-icon ${
                    isVideoOff ? 'sam-participant-row__media-icon--video-off' : 'sam-participant-row__media-icon--active'
                  }`}
                  title={isVideoOff ? `${name}'s camera is off` : `${name}'s camera is active`}
                >
                  {isVideoOff ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty state when searching */}
        {!matchesLocal && filteredRemote.length === 0 && (
          <div className="sam-participants-panel__empty">
            <p className="sam-participants-panel__empty-title">No participants found</p>
            <p className="sam-participants-panel__empty-desc">
              No one matched &quot;{searchQuery}&quot;.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantsPanel;
