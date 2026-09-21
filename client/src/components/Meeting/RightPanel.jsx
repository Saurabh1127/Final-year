import React from 'react';
import Tabs from '../ui/Tabs';
import TranscriptPanel from './TranscriptPanel';
import ParticipantsPanel from './ParticipantsPanel';
import ChatPanel from './ChatPanel';
import './RightPanel.css';

/**
 * RightPanel
 * High-performance tabbed slide-in right drawer for meetings.
 * Integrates Transcript feed, Participant roster, and in-call Chat tabs.
 * Adapts to a bottom sheet drawer on mobile viewports.
 */
export function RightPanel({
  isOpen = false,
  onClose,
  activeTab = 'transcript',
  onTabChange,
  transcriptLog = [],
  targetLanguage = 'en',
  onInspectDiagnostics,
  participants = [],
  localParticipant = {},
  sourceLanguage = 'auto',
  roomCode = '',
  onCopyLink,
}) {
  if (!isOpen) return null;

  const participantsCount = participants.length + 1; // +1 for local user

  const tabsConfig = [
    {
      id: 'transcript',
      label: 'Transcript',
      count: transcriptLog.length > 0 ? transcriptLog.length : undefined,
    },
    {
      id: 'participants',
      label: 'People',
      count: participantsCount,
    },
    {
      id: 'chat',
      label: 'Chat',
    },
  ];

  return (
    <>
      {/* Backdrop for mobile & small screens */}
      <div
        className="sam-right-panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="sam-right-panel"
        id="meeting-right-panel"
        role="dialog"
        aria-label="Meeting sidebar panel"
      >
        {/* ── Panel Header: Navigation Tabs + Close Action ── */}
        <div className="sam-right-panel__header">
          <div className="sam-right-panel__tabs-wrap">
            <Tabs
              tabs={tabsConfig}
              activeTab={activeTab}
              onChange={(tabId) => onTabChange?.(tabId)}
              variant="pills"
              size="sm"
            />
          </div>

          <button
            type="button"
            className="sam-right-panel__close-btn"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Active Tab Panel Body ── */}
        <div className="sam-right-panel__body">
          {activeTab === 'transcript' && (
            <TranscriptPanel
              transcriptLog={transcriptLog}
              targetLanguage={targetLanguage}
              onInspectDiagnostics={onInspectDiagnostics}
            />
          )}

          {activeTab === 'participants' && (
            <ParticipantsPanel
              participants={participants}
              localParticipant={localParticipant}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              roomCode={roomCode}
              onCopyLink={onCopyLink}
            />
          )}

          {activeTab === 'chat' && <ChatPanel />}
        </div>
      </aside>
    </>
  );
}

export default RightPanel;
