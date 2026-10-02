import React, { useMemo, useState } from 'react';

// Navy & steel blue palette for name-based avatar fallbacks
const GRADIENTS = [
  'linear-gradient(135deg, #4F7FA8 0%, #263D54 100%)',
  'linear-gradient(135deg, #3F6F96 0%, #162235 100%)',
  'linear-gradient(135deg, #5E9B7B 0%, #1C2B40 100%)',
  'linear-gradient(135deg, #6595BD 0%, #101A2A 100%)',
  'linear-gradient(135deg, #263D54 0%, #0B1220 100%)',
  'linear-gradient(135deg, #35485E 0%, #162235 100%)',
];

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Samvada Avatar Component
 * Handles image rendering with clean initials fallback and status badge.
 */
export function Avatar({
  name = '',
  src = '',
  size = 'md',
  status = null, // 'online' | 'offline' | 'speaking' | 'away' | 'busy'
  alt = '',
  className = '',
  ...props
}) {
  const [imgError, setImgError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const background = useMemo(() => getGradient(name), [name]);
  const isSpeaking = status === 'speaking';

  return (
    <div
      className={`sam-avatar-wrapper sam-avatar-wrapper--${size} ${className}`.trim()}
      {...props}
    >
      <div
        className={`sam-avatar sam-avatar--${size} ${
          isSpeaking ? 'sam-avatar--speaking' : ''
        }`}
        style={!src || imgError ? { background } : undefined}
      >
        {src && !imgError ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            onError={() => setImgError(true)}
            className="sam-avatar__img"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {status && (
        <span
          className={`sam-avatar__status sam-avatar__status--${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export default Avatar;
