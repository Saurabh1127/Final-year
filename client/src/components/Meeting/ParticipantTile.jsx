import React, { useRef, useEffect, useState } from 'react';
import { useAudioVolume } from '../../hooks/useAudioVolume';
import { getLanguageLabel } from './LanguageSelector';

/**
 * ParticipantTile
 * Video & audio tile representing a meeting participant (local or remote).
 * Features:
 * - Electric mint border glow when speaking
 * - Prominent language flow badge (e.g. "🎙️ Hindi → 🎧 English")
 * - Dynamic avatar placeholder with user initial when video is disabled
 * - Inline rename support for local participant
 * - Autoplay block fallback handler for mobile browsers
 */
export function ParticipantTile({
  participant,
  stream,
  isLocal = false,
  onRename,
  sourceLanguage = 'auto',
}) {
  const isSpeaking = useAudioVolume(stream);
  const actuallySpeaking = isSpeaking && !participant?.isMuted;

  // Rename state (local participant only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant?.displayName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== participant?.displayName && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(participant?.displayName || '');
      setIsEditing(false);
    }
  };

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [hasLiveVideoTrack, setHasLiveVideoTrack] = useState(false);

  // Monitor stream for live video tracks
  useEffect(() => {
    if (!stream) {
      setHasLiveVideoTrack(false);
      return;
    }

    const checkVideo = () => {
      const vTracks = stream.getVideoTracks();
      setHasLiveVideoTrack(vTracks.some((t) => t.enabled && t.readyState !== 'ended'));
    };

    checkVideo();
    stream.addEventListener('addtrack', checkVideo);
    stream.addEventListener('removetrack', checkVideo);
    return () => {
      stream.removeEventListener('addtrack', checkVideo);
      stream.removeEventListener('removetrack', checkVideo);
    };
  }, [stream]);

  const hasVideo = stream && hasLiveVideoTrack && !participant?.isVideoOff;

  // Video element playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((e) => {
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

  // Audio element playback for remote participants
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && stream && !isLocal) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((e) => {
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

  const displayName = participant?.displayName || 'Participant';
  const spokenLabel = getLanguageLabel(participant?.sourceLanguage || (isLocal ? sourceLanguage : 'auto'));
  const targetLabel = getLanguageLabel(participant?.targetLanguage || 'en');

  return (
    <div
      onClick={autoplayBlocked ? handleManualPlay : undefined}
      className={`sam-participant-tile ${actuallySpeaking ? 'sam-participant-tile--speaking' : ''}`}
      id={`tile-${participant?.userId || (isLocal ? 'local' : 'remote')}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted={isLocal}
        className={`sam-participant-tile__video ${isLocal ? 'sam-participant-tile__video--mirrored' : ''}`}
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      {/* Camera Off Avatar Overlay */}
      {!hasVideo && (
        <div className="sam-participant-tile__cam-off">
          <div className="sam-participant-tile__avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="sam-participant-tile__cam-off-name">{displayName}</span>
        </div>
      )}

      {/* Tap-to-play overlay if browser blocked autoplay */}
      {autoplayBlocked && !isLocal && (
        <button
          type="button"
          onClick={handleManualPlay}
          className="sam-participant-tile__autoplay-btn"
        >
          <div className="sam-participant-tile__autoplay-icon">▶</div>
          <span className="sam-participant-tile__autoplay-text">Tap to enable audio & video</span>
        </button>
      )}

      {/* Remote Audio Track Element */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      {/* Top Bar: Mint Language Flow Badge */}
      <div className="sam-participant-tile__top-bar">
        <div
          className="sam-participant-tile__lang-flow-badge"
          title={`Speech translated: ${spokenLabel} to ${targetLabel}`}
        >
          <span className="sam-participant-tile__lang-flow-src">
            {spokenLabel}
          </span>
          <span className="sam-participant-tile__lang-flow-arrow">→</span>
          <span className="sam-participant-tile__lang-flow-tgt">
            {targetLabel}
          </span>
        </div>
      </div>

      {/* Bottom Info Bar Overlay */}
      <div className="sam-participant-tile__info-bar">
        <div className="sam-participant-tile__info-chip">
          {isLocal && isEditing ? (
            <input
              ref={inputRef}
              className="sam-participant-tile__rename-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              maxLength={40}
              id="rename-input"
              aria-label="Edit your meeting display name"
            />
          ) : (
            <span
              className={`sam-participant-tile__name ${isLocal ? 'sam-participant-tile__name--editable' : ''}`}
              onClick={() => {
                if (isLocal) {
                  setEditName(displayName);
                  setIsEditing(true);
                }
              }}
              onKeyDown={(e) => {
                if (isLocal && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setEditName(displayName);
                  setIsEditing(true);
                }
              }}
              role={isLocal ? 'button' : undefined}
              tabIndex={isLocal ? 0 : undefined}
              aria-label={isLocal ? 'Change your display name' : undefined}
              title={isLocal ? 'Click or press Enter to change your display name' : undefined}
            >
              <span>{displayName} {isLocal ? '(You)' : ''}</span>
              {isLocal && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-participant-tile__edit-icon" aria-hidden="true">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              )}
            </span>
          )}

          {/* Muted Icon Indicator */}
          {participant?.isMuted && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sam-participant-tile__mute-icon" title="Microphone muted">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}

          {/* Speaking Indicator */}
          {actuallySpeaking && (
            <span className="sam-participant-tile__speaking-pill">
              <span className="sam-participant-tile__speaking-dot" />
              <span>Speaking</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParticipantTile;
