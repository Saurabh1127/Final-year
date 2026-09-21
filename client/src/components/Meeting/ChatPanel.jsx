import React from 'react';

/**
 * ChatPanel
 * In-meeting chat panel placeholder matching the obsidian/mint design system.
 * Displays empty state with security note and disabled message input preview.
 */
export function ChatPanel() {
  return (
    <div className="sam-chat-panel" aria-label="Meeting in-call chat panel">
      {/* ── Security / Info Banner ── */}
      <div className="sam-chat-panel__banner">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>End-to-end encrypted • In-meeting only</span>
      </div>

      {/* ── Feed Empty State ── */}
      <div className="sam-chat-panel__empty">
        <div className="sam-chat-panel__empty-badge">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </svg>
        </div>
        <h4 className="sam-chat-panel__empty-title">Meeting Chat</h4>
        <p className="sam-chat-panel__empty-desc">
          In-meeting text messaging and multilingual text translation will be available in an upcoming update.
        </p>
        <div className="sam-chat-panel__empty-tip">
          <span>Tip:</span> All participants can hear you in their own language with live AI voice translation!
        </div>
      </div>

      {/* ── Bottom Input Preview (Disabled) ── */}
      <div className="sam-chat-panel__input-wrap">
        <div className="sam-chat-panel__input-container">
          <input
            type="text"
            className="sam-chat-panel__input"
            placeholder="Chat coming soon..."
            disabled
            aria-label="Chat input (disabled)"
          />
          <button
            type="button"
            className="sam-chat-panel__send-btn"
            disabled
            aria-label="Send message (disabled)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
