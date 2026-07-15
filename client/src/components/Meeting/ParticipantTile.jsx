import React, { useCallback } from 'react';
import { useAudioVolume } from '../../hooks/useAudioVolume';

const ParticipantTile = ({ participant, stream, isLocal }) => {
  // Use the audio volume hook to detect speaking (only if not muted)
  const isSpeaking = useAudioVolume(stream);
  const actuallySpeaking = isSpeaking && !participant.isMuted;

  // Use a callback ref for the video element.
  // This guarantees that when React mounts the <video> element (after it was hidden),
  // the stream is instantly attached to it.
  const setVideoRef = useCallback((node) => {
    if (node && stream) {
      node.srcObject = stream;
    }
  }, [stream]);

  // Use a callback ref for the audio element as well, since it's also conditionally rendered.
  const setAudioRef = useCallback((node) => {
    if (node && stream) {
      node.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && !participant.isVideoOff;

  return (
    <div className={`participant-tile ${isLocal ? 'local-tile' : ''} ${actuallySpeaking ? 'speaking' : ''}`}>
      {hasVideo ? (
        <video 
          ref={setVideoRef} 
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
      
      {/* Always render a hidden audio element for remote participants to ensure audio plays
          even when video is off. The video tag also plays audio, so this is only needed 
          when video is not rendering. */}
      {!hasVideo && !isLocal && (
        <audio ref={setAudioRef} autoPlay playsInline style={{ display: 'none' }} />
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
