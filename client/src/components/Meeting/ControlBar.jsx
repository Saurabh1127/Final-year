import React from 'react';
import { useNavigate } from 'react-router-dom';

const ControlBar = ({ isMuted, toggleMute, isVideoOff, toggleVideo, isEchoTestActive, toggleEchoTest, onLeave }) => {
  return (
    <div className="control-bar">
      <div className="control-left">
        {/* Placeholder for future left controls like time or info */}
      </div>
      
      <div className="control-center">
        <button 
          className={`btn-icon control-btn ${isMuted ? 'muted' : 'active'}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
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
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
        </button>

        <button 
          className="btn-icon control-btn btn-danger leave-btn"
          onClick={onLeave}
          title="Leave Call"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
            <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07c.39-.39 1.03-.39 1.42 0 .39.39.39 1.03 0 1.42-1.37 1.37-1.37 3.58 0 4.95z"></path>
            <path d="M13.41 13.41c-.41.39-.41 1.03 0 1.42.39.39 1.03.39 1.42 0a5.003 5.003 0 0 0 0-7.07c-.39-.39-1.03-.39-1.42 0-.39.39-.39 1.03 0 1.42 1.37 1.37 1.37 3.58 0 4.95z"></path>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
          </svg>
        </button>
      </div>

      <div className="control-right">
        {/* Placeholder for Subtitle / Language controls */}
      </div>
    </div>
  );
};

export default ControlBar;
