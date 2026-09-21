import React, { useState } from 'react';
import RightPanel from './RightPanel';

/**
 * TranscriptSidebar
 * Re-exports/wraps the RightPanel with the 'transcript' tab active.
 * Retained for backwards compatibility across existing meeting views.
 */
export function TranscriptSidebar({
  isOpen = false,
  onClose,
  transcriptLog = [],
  onInspectDiagnostics,
  targetLanguage = 'hi',
  participants = [],
  localParticipant = {},
  sourceLanguage = 'auto',
  roomCode = '',
  onCopyLink,
}) {
  const [activeTab, setActiveTab] = useState('transcript');

  return (
    <RightPanel
      isOpen={isOpen}
      onClose={onClose}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      transcriptLog={transcriptLog}
      targetLanguage={targetLanguage}
      onInspectDiagnostics={onInspectDiagnostics}
      participants={participants}
      localParticipant={localParticipant}
      sourceLanguage={sourceLanguage}
      roomCode={roomCode}
      onCopyLink={onCopyLink}
    />
  );
}

export default TranscriptSidebar;
