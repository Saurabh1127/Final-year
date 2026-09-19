import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PreJoinScreen = ({ roomCode, userName, localStream, isMuted, isVideoOff, toggleMute, toggleVideo, onJoin }) => {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = () => {
    if (isJoining || !localStream) return;
    setIsJoining(true);
    onJoin();
  };

  // Callback ref for video preview
  const setVideoRef = useCallback((node) => {
    if (node && localStream) {
      node.srcObject = localStream;
    }
  }, [localStream]);

  const hasVideo = localStream && !isVideoOff;

  return (
    <div className="prejoin-screen">
      <div className="prejoin-card animate-fade-in">
        <div className="prejoin-header">
          <div className="prejoin-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="var(--color-accent)" strokeWidth="2" />
              <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="3" fill="var(--color-accent)" />
            </svg>
            <span>LinguaMeet</span>
          </div>
          <h2>Ready to join?</h2>
          <p className="prejoin-room-label">
            Meeting code: <span className="prejoin-room-code">{roomCode}</span>
          </p>
        </div>

        {/* Video Preview */}
        <div className="prejoin-video-container">
          {hasVideo ? (
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="prejoin-video mirror-video"
            />
          ) : (
            <div className="prejoin-avatar-wrapper">
              <div className="prejoin-avatar">
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <p className="prejoin-camera-off-label">Camera is off</p>
            </div>
          )}

          {/* Media status pills */}
          <div className="prejoin-media-status">
            {isMuted && (
              <span className="prejoin-status-pill prejoin-status-muted">
                🔇 Muted
              </span>
            )}
            {isVideoOff && (
              <span className="prejoin-status-pill prejoin-status-cam-off">
                📷 Camera off
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="prejoin-controls">
          <button
            className={`btn-icon control-btn ${isMuted ? 'muted' : 'active'}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            id="prejoin-mic-btn"
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
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            id="prejoin-cam-btn"
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
        </div>

        {/* Action buttons */}
        <div className="prejoin-actions">
          <button
            className="btn btn-primary btn-lg prejoin-join-btn"
            onClick={handleJoin}
            disabled={!localStream || isJoining}
            id="prejoin-join-btn"
          >
            {isJoining ? 'Joining...' : localStream ? 'Join Now' : 'Waiting for media...'}
          </button>
          <button
            className="btn btn-secondary prejoin-back-btn"
            onClick={() => navigate('/')}
            id="prejoin-back-btn"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreJoinScreen;
