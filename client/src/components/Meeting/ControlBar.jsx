import React, { useState, useEffect, useRef } from 'react';

const ControlBar = ({ isMuted, toggleMute, isVideoOff, toggleVideo, isEchoTestActive, toggleEchoTest, onLeave }) => {
  // ── Meeting Timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (totalSeconds) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="control-bar">
      <div className="control-left">
        {/* Meeting Timer */}
        <div className="meeting-timer" id="meeting-timer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span className="timer-text">{formatTime(elapsed)}</span>
        </div>
      </div>
      
      <div className="control-center">
        <button 
          className={`btn-icon control-btn ${isMuted ? 'muted' : 'active'}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          id="btn-toggle-mic"
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>

        <button 
          className={`btn-icon control-btn ${isVideoOff ? 'muted' : 'active'}`}
          onClick={toggleVideo}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          id="btn-toggle-camera"
        >
          {isVideoOff ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          )}
        </button>

        <button 
          className={`btn-icon control-btn ${isEchoTestActive ? 'active' : ''}`}
          onClick={toggleEchoTest}
          title={isEchoTestActive ? "Stop Mic Test" : "Test Mic (Echo)"}
          style={{ background: isEchoTestActive ? 'var(--color-accent)' : '' }}
          id="btn-echo-test"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
        </button>

        {/* End Call — red phone hang-up icon */}
        <button 
          className="btn-icon control-btn btn-danger leave-btn"
          onClick={onLeave}
          title="End Call"
          id="btn-end-call"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 16.92C23 16.92 20.18 14 12 14C3.82 14 1 16.92 1 16.92L3.77 19.69C3.77 19.69 4.5 20 5.23 19.69L8 17.54C8 17.54 8.5 17 8.5 16V14.5C8.5 14.5 10 14 12 14C14 14 15.5 14.5 15.5 14.5V16C15.5 17 16 17.54 16 17.54L18.77 19.69C19.5 20 20.23 19.69 20.23 19.69L23 16.92Z"></path>
          </svg>
        </button>
      </div>

      <div className="control-right">
        {/* Placeholder for future right controls */}
      </div>
    </div>
  );
};

export default ControlBar;
