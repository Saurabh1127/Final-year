import React, { useRef, useEffect, useState } from 'react';
import { useAudioVolume } from '../../hooks/useAudioVolume';

const ParticipantTile = ({ participant, stream, isLocal, onRename }) => {
  // Use the audio volume hook to detect speaking (only if not muted)
  const isSpeaking = useAudioVolume(stream);
  const actuallySpeaking = isSpeaking && !participant.isMuted;

  // ── Rename state (local participant only) ────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant.displayName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== participant.displayName && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(participant.displayName || '');
      setIsEditing(false);
    }
  };

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [hasLiveVideoTrack, setHasLiveVideoTrack] = useState(false);

  // Monitor stream for live video tracks (crucial when video track arrives after initial audio track)
  useEffect(() => {
    if (!stream) {
      setHasLiveVideoTrack(false);
      return;
    }

    const checkVideo = () => {
      const vTracks = stream.getVideoTracks();
      setHasLiveVideoTrack(vTracks.length > 0 && vTracks.some(t => t.enabled && t.readyState !== 'ended'));
    };

    checkVideo();
    stream.addEventListener('addtrack', checkVideo);
    stream.addEventListener('removetrack', checkVideo);
    return () => {
      stream.removeEventListener('addtrack', checkVideo);
      stream.removeEventListener('removetrack', checkVideo);
    };
  }, [stream]);

  const hasVideo = stream && hasLiveVideoTrack && !participant.isVideoOff;

  // Video element playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play()
        .then(() => setAutoplayBlocked(false))
        .catch(e => {
          console.warn('Video play blocked by browser:', e.message);
          if (!isLocal) setAutoplayBlocked(true);
        });
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream, hasVideo, isLocal]);

  // Audio element playback (fallback for remote participants when video is hidden)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && stream && !isLocal) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.play()
        .then(() => setAutoplayBlocked(false))
        .catch(e => {
          console.warn('Audio play blocked by browser:', e.message);
          setAutoplayBlocked(true);
        });
    }
    return () => {
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [stream, isLocal]);

  const handleManualPlay = () => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setAutoplayBlocked(false);
  };

  return (
    <div
      onClick={autoplayBlocked ? handleManualPlay : undefined}
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#10121a] border border-white/[0.08] flex items-center justify-center transition-all duration-300 ${
        actuallySpeaking
          ? 'ring-2 ring-[#00d4b2] shadow-[0_0_24px_rgba(0,212,178,0.25)]'
          : ''
      }`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      {/* Avatar overlay when video is off or loading */}
      {!hasVideo && (
        <div className="flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[#00d4b2]/10 border border-[#00d4b2]/25 text-[#00d4b2] flex items-center justify-center text-3xl font-bold mb-2">
            {participant.displayName?.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-slate-400 font-medium">{participant.displayName}</span>
        </div>
      )}

      {/* Tap-to-play overlay if browser blocked autoplay (common on mobile) */}
      {autoplayBlocked && !isLocal && (
        <button
          onClick={handleManualPlay}
          className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center gap-2 text-white p-4 text-center cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#00d4b2] text-black flex items-center justify-center font-bold text-xl shadow-lg">
            ▶
          </div>
          <span className="text-sm font-semibold">Tap to enable audio & video</span>
        </button>
      )}

      {/* Hidden audio for remote participants when video is hidden */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}


      {/* Participant info overlay at bottom */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white pointer-events-auto">
          {isLocal && isEditing ? (
            <input
              ref={inputRef}
              className="px-1.5 py-0.5 bg-black/40 border border-[#00d4b2] rounded text-white text-xs outline-none w-28"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              maxLength={50}
              id="rename-input"
            />
          ) : (
            <span
              className={`flex items-center gap-1.5 ${isLocal ? 'cursor-pointer hover:text-[#00d4b2] transition' : ''}`}
              onClick={() => {
                if (isLocal) {
                  setEditName(participant.displayName || '');
                  setIsEditing(true);
                }
              }}
              title={isLocal ? 'Click to rename' : undefined}
            >
              <span>{participant.displayName} {isLocal ? '(You)' : ''}</span>
              {isLocal && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 inline-block ml-1">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              )}
            </span>
          )}

          {participant.isMuted && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400 shrink-0" title="Muted">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}

          {actuallySpeaking && (
            <span className="text-[#00d4b2] text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4b2] animate-ping"></span>
              Speaking
            </span>
          )}
        </div>

        {participant.targetLanguage && (
          <span className="font-mono text-[10px] font-bold px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[#00d4b2] uppercase pointer-events-auto">
            {participant.targetLanguage}
          </span>
        )}
      </div>
    </div>
  );
};

export default ParticipantTile;
