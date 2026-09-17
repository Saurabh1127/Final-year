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

  // Ref-based approach from upstream: useEffect re-attaches when stream changes
  // (more reliable than callback refs for stream prop changes).
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn('Video play blocked by browser:', e));
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(e => console.warn('Audio play blocked by browser:', e));
    }
  }, [stream]);

  const hasVideo = stream && !participant.isVideoOff;

  return (
    <div className={`participant-tile ${isLocal ? 'local-tile' : ''} ${actuallySpeaking ? 'speaking' : ''}`}>
      {hasVideo ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={isLocal} 
          className={`participant-video ${isLocal ? 'mirror-video' : ''}`}
        />
      ) : (
        <div className="participant-avatar-wrapper">
          <div className="participant-avatar">
            {participant.displayName?.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      {/* Always render hidden audio for remote participants so audio plays even when video is off */}
      {!hasVideo && !isLocal && (
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
