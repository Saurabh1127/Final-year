import React, { useState, useEffect, useRef } from 'react';

const ControlBar = ({ isMuted, toggleMute, isVideoOff, toggleVideo, isEchoTestActive, toggleEchoTest, onLeave, isHost = false }) => {
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-3 sm:px-6 py-2.5 rounded-2xl bg-[#090a0f]/90 border border-white/[0.1] backdrop-blur-2xl shadow-2xl shadow-black/80 flex items-center justify-center gap-2.5 sm:gap-6 max-w-[95vw]">
      {/* Meeting Timer */}
      <div className="flex items-center shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono font-medium text-slate-300 px-2 sm:px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]" id="meeting-timer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="text-[#00d4b2]">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{formatTime(elapsed)}</span>
        </div>
      </div>
      
      {/* Center Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Toggle Microphone */}
        <button 
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 shrink-0 ${
            isMuted 
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08]'
          }`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          id="btn-toggle-mic"
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

        {/* Toggle Camera */}
        <button 
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 shrink-0 ${
            isVideoOff 
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08]'
          }`}
          onClick={toggleVideo}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          id="btn-toggle-camera"
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

        {/* Echo Mic Test */}
        <button 
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 shrink-0 ${
            isEchoTestActive 
              ? 'bg-[#00d4b2] text-slate-950 font-bold shadow-lg shadow-[#00d4b2]/30' 
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08]'
          }`}
          onClick={toggleEchoTest}
          title={isEchoTestActive ? "Stop Mic Test" : "Test Mic (Echo)"}
          id="btn-echo-test"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
        </button>

        {/* End Call — red phone hang-up icon */}
        <button 
          className="w-11 h-10 sm:w-12 sm:h-11 px-3 sm:px-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center justify-center shadow-lg shadow-rose-500/30 transition active:scale-95 ml-1 shrink-0"
          onClick={onLeave}
          title={isHost ? "Leave or End Call" : "Leave Call"}
          id="btn-end-call"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 16.92C23 16.92 20.18 14 12 14C3.82 14 1 16.92 1 16.92L3.77 19.69C3.77 19.69 4.5 20 5.23 19.69L8 17.54C8 17.54 8.5 17 8.5 16V14.5C8.5 14.5 10 14 12 14C14 14 15.5 14.5 15.5 14.5V16C15.5 17 16 17.54 16 17.54L18.77 19.69C19.5 20 20.23 19.69 20.23 19.69L23 16.92Z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
