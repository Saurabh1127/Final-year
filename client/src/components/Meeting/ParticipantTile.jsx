import React, { useEffect, useRef } from 'react';
import { useAudioVolume } from '../../hooks/useAudioVolume';

const ParticipantTile = ({ participant, stream, isLocal }) => {
  const mediaRef = useRef(null);
  
  // Use the audio volume hook to detect speaking (only if not muted)
  const isSpeaking = useAudioVolume(stream);
  const actuallySpeaking = isSpeaking && !participant.isMuted;

  useEffect(() => {
    if (mediaRef.current && stream) {
      mediaRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && !participant.isVideoOff;

  return (
    <div className={`participant-tile ${isLocal ? 'local-tile' : ''} ${actuallySpeaking ? 'speaking' : ''}`}>
      {hasVideo ? (
        <video 
          ref={mediaRef} 
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
      
      {/* Fallback audio element if video track is not present, though video tag handles both */}
      {!hasVideo && (
        <audio ref={mediaRef} autoPlay playsInline muted={isLocal} />
      )}

      <div className="participant-info">
        <span className="participant-name">
          {participant.displayName} {isLocal ? '(You)' : ''}
        </span>
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
