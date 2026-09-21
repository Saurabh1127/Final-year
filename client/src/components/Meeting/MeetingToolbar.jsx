import React from 'react';

/**
 * MeetingToolbar
 * Primary floating action bar docked at the bottom of the video conference.
 * Features prominent AI speech translation toggle in primary position alongside mic/camera.
 */
export function MeetingToolbar({
  isMuted = false,
  toggleMute,
  isVideoOff = false,
  toggleVideo,
  isEchoTestActive = false,
  toggleEchoTest,
  translationEnabled = false,
  toggleTranslation,
  showTranscript = false,
  toggleTranscript,
  showParticipants = false,
  toggleParticipants,
  showChat = false,
  toggleChat,
  onLeave,
  isHost = false,
}) {
  return (
    <nav className="sam-meeting-toolbar" aria-label="Meeting controls">
      <div className="sam-meeting-toolbar__container">
        {/* 1. Microphone Toggle */}
        <button
          type="button"
          className={`sam-meeting-toolbar__btn ${isMuted ? 'sam-meeting-toolbar__btn--alert' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone (Cmd/Ctrl+D)' : 'Mute microphone (Cmd/Ctrl+D)'}
          id="btn-toggle-mic"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <div className="sam-meeting-toolbar__icon">
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </div>
          <span className="sam-meeting-toolbar__label">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* 2. Camera Toggle */}
        <button
          type="button"
          className={`sam-meeting-toolbar__btn ${isVideoOff ? 'sam-meeting-toolbar__btn--alert' : ''}`}
          onClick={toggleVideo}
          title={isVideoOff ? 'Turn on camera (Cmd/Ctrl+E)' : 'Turn off camera (Cmd/Ctrl+E)'}
          id="btn-toggle-camera"
          aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          <div className="sam-meeting-toolbar__icon">
            {isVideoOff ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            )}
          </div>
          <span className="sam-meeting-toolbar__label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
        </button>

        {/* 3. Prominent AI Speech Translation Toggle (Mint when active) */}
        {toggleTranslation && (
          <button
            type="button"
            className={`sam-meeting-toolbar__btn ${
              translationEnabled
                ? 'sam-meeting-toolbar__btn--active-trans'
                : 'sam-meeting-toolbar__btn--trans-idle'
            }`}
            onClick={toggleTranslation}
            title={translationEnabled ? 'AI Translation active (click to stop)' : 'Enable live AI translation'}
            id="btn-toolbar-translation"
            aria-label="Toggle live AI translation"
          >
            <div className="sam-meeting-toolbar__icon sam-meeting-toolbar__icon--trans">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <span className="sam-meeting-toolbar__label">
              {translationEnabled ? 'Translate (ON)' : 'Translate'}
            </span>
          </button>
        )}

        <div className="sam-meeting-toolbar__separator" />

        {/* 4. Mic Echo Test */}
        <button
          type="button"
          className={`sam-meeting-toolbar__btn ${isEchoTestActive ? 'sam-meeting-toolbar__btn--active-mint' : ''}`}
          onClick={toggleEchoTest}
          title={isEchoTestActive ? 'Stop audio loopback test' : 'Test microphone audio loopback'}
          id="btn-echo-test"
          aria-label={isEchoTestActive ? 'Stop mic test' : 'Test mic'}
        >
          <div className="sam-meeting-toolbar__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <span className="sam-meeting-toolbar__label">{isEchoTestActive ? 'Testing' : 'Mic Test'}</span>
        </button>

        {/* 5. Transcript Quick Toggle */}
        {toggleTranscript && (
          <button
            type="button"
            className={`sam-meeting-toolbar__btn ${showTranscript ? 'sam-meeting-toolbar__btn--active-mint' : ''}`}
            onClick={toggleTranscript}
            title="Toggle Live Transcript panel"
            id="btn-toolbar-transcript"
            aria-label="Toggle transcript"
          >
            <div className="sam-meeting-toolbar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="sam-meeting-toolbar__label">Transcript</span>
          </button>
        )}

        {/* 6. People / Participants Toggle */}
        {toggleParticipants && (
          <button
            type="button"
            className={`sam-meeting-toolbar__btn ${showParticipants ? 'sam-meeting-toolbar__btn--active-mint' : ''}`}
            onClick={toggleParticipants}
            title="Toggle People roster"
            id="btn-toolbar-participants"
            aria-label="Toggle participants list"
          >
            <div className="sam-meeting-toolbar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="sam-meeting-toolbar__label">People</span>
          </button>
        )}

        {/* 7. Chat Toggle */}
        {toggleChat && (
          <button
            type="button"
            className={`sam-meeting-toolbar__btn ${showChat ? 'sam-meeting-toolbar__btn--active-mint' : ''}`}
            onClick={toggleChat}
            title="Toggle in-meeting chat"
            id="btn-toolbar-chat"
            aria-label="Toggle chat"
          >
            <div className="sam-meeting-toolbar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <span className="sam-meeting-toolbar__label">Chat</span>
          </button>
        )}

        <div className="sam-meeting-toolbar__separator" />

        {/* 6. Leave / End Call */}
        <button
          type="button"
          className="sam-meeting-toolbar__btn sam-meeting-toolbar__btn--leave"
          onClick={onLeave}
          title={isHost ? 'Leave or End Meeting for All' : 'Leave this meeting'}
          id="btn-end-call"
          aria-label={isHost ? 'End Call' : 'Leave Call'}
        >
          <div className="sam-meeting-toolbar__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 16.92C23 16.92 20.18 14 12 14C3.82 14 1 16.92 1 16.92L3.77 19.69C3.77 19.69 4.5 20 5.23 19.69L8 17.54C8 17.54 8.5 17 8.5 16V14.5C8.5 14.5 10 14 12 14C14 14 15.5 14.5 15.5 14.5V16C15.5 17 16 17.54 16 17.54L18.77 19.69C19.5 20 20.23 19.69 20.23 19.69L23 16.92Z" />
            </svg>
          </div>
          <span className="sam-meeting-toolbar__label">{isHost ? 'End Meeting' : 'Leave'}</span>
        </button>
      </div>
    </nav>
  );
}

export default MeetingToolbar;
