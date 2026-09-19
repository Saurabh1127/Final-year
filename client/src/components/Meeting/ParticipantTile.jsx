import React, { useRef, useEffect, useCallback, useState } from 'react';
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

  // Attach stream to video element whenever stream changes OR video toggles back on.
  // The video element is always mounted (just hidden), so the ref is always valid.
  const hasVideo = stream && !participant.isVideoOff;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(e => console.warn('Video play blocked by browser:', e));
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream, hasVideo]);

  // Always attach stream to the hidden audio element for remote participants.
  // This runs on mount and whenever stream changes, ensuring audio is never lost.
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && stream) {
      audioEl.srcObject = stream;
      audioEl.play().catch(e => console.warn('Audio play blocked by browser:', e));
    }
    return () => {
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className={`participant-tile ${isLocal ? 'local-tile' : ''} ${actuallySpeaking ? 'speaking' : ''}`}>
      {/* Video element is ALWAYS rendered but hidden when video is off.
          This preserves srcObject across camera toggles so it re-appears instantly. */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={isLocal} 
        className={`participant-video ${isLocal ? 'mirror-video' : ''}`}
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      {/* Avatar overlay shown when video is off */}
      {!hasVideo && (
        <div className="participant-avatar-wrapper">
          <div className="participant-avatar">
            {participant.displayName?.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      {/* Always render hidden audio for remote participants so audio plays
          regardless of whether video is on or off */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      <div className="participant-info">
        {/* ── Name with inline rename for local participant ─────────────────── */}
        {isLocal && isEditing ? (
          <input
            ref={inputRef}
            className="rename-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            maxLength={50}
            id="rename-input"
          />
        ) : (
          <span
            className={`participant-name ${isLocal ? 'participant-name-editable' : ''}`}
            onClick={() => {
              if (isLocal) {
                setEditName(participant.displayName || '');
                setIsEditing(true);
              }
            }}
            title={isLocal ? 'Click to rename' : undefined}
          >
            {participant.displayName} {isLocal ? '(You)' : ''}
            {isLocal && (
              <span className="rename-icon" aria-label="Rename">
                ✏️
              </span>
            )}
          </span>
        )}

        {participant.isMuted && (
          <span className="participant-muted-icon" style={{ marginLeft: '4px', fontSize: '0.8rem' }}>
            🔇
          </span>
        )}
        {actuallySpeaking && (
          <span className="participant-speaking-indicator" style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>
            🎤 Active
          </span>
        )}
        <span className="participant-lang-badge" style={{ marginLeft: 'auto' }}>
          {participant.targetLanguage}
        </span>
      </div>
    </div>
  );
};

export default ParticipantTile;
