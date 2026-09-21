import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PreJoinScreen = ({ roomCode, userName, localStream, isMuted, isVideoOff, toggleMute, toggleVideo, onJoin }) => {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = () => {
    if (isJoining || !localStream) return;
    setIsJoining(true);
    onJoin();
  };

  const videoRef = useRef(null);
  const hasVideo = localStream && !isVideoOff;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && localStream) {
      videoEl.srcObject = localStream;
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [localStream, hasVideo]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090a0f] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#00d4b2]/[0.04] rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-lg p-6 sm:p-8 bg-[#12151e]/90 border border-white/[0.08] rounded-3xl backdrop-blur-2xl shadow-2xl shadow-black/80 relative z-10 animate-fade-in mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#00d4b2]/10 border border-[#00d4b2]/20 flex items-center justify-center text-[#00d4b2]">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="16" r="3" fill="currentColor" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">SAMVADA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Ready to join?</h2>
          <p className="text-sm text-slate-400 mt-1">
            Meeting code: <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#00d4b2]/10 text-[#00d4b2] border border-[#00d4b2]/20 font-semibold">{roomCode}</span>
          </p>
        </div>

        {/* Video Preview */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/60 border border-white/[0.08] mb-6 flex items-center justify-center shadow-inner">
          {hasVideo ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#00d4b2]/10 border border-[#00d4b2]/25 text-[#00d4b2] flex items-center justify-center text-3xl font-bold mb-2">
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <p className="text-xs text-slate-400 font-medium">Camera is off</p>
            </div>
          )}

          {/* Media status badges */}
          <div className="absolute top-3 right-3 flex gap-2 z-10">
            {isMuted && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/80 text-white backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                <span>Muted</span>
              </span>
            )}
            {isVideoOff && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/90 text-slate-200 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <span>Camera off</span>
              </span>
            )}
          </div>
        </div>

        {/* Media Toggle Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 ${
              isMuted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10'
            }`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            id="prejoin-mic-btn"
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>

          <button
            className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 ${
              isVideoOff
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10'
            }`}
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            id="prejoin-cam-btn"
          >
            {isVideoOff ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            )}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            className="w-full py-3.5 px-4 rounded-xl bg-[#00d4b2] hover:bg-[#33e0c4] text-slate-950 font-bold text-sm transition shadow-lg shadow-[#00d4b2]/20 disabled:opacity-50 active:scale-[0.99]"
            onClick={handleJoin}
            disabled={!localStream || isJoining}
            id="prejoin-join-btn"
          >
            {isJoining ? 'Joining…' : localStream ? 'Join Now' : 'Waiting for media…'}
          </button>
          <button
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white font-semibold text-xs transition"
            onClick={() => navigate('/')}
            id="prejoin-back-btn"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreJoinScreen;
