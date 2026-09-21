import React, { useMemo, useState } from 'react';
import './Avatar.css';

// Gradient palette for name-based avatar fallbacks
const GRADIENTS = [
  'linear-gradient(135deg, #00D4B2 0%, #0284C7 100%)',
  'linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)',
  'linear-gradient(135deg, #818CF8 0%, #C084FC 100%)',
  'linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)',
  'linear-gradient(135deg, #10B981 0%, #00D4B2 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
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
