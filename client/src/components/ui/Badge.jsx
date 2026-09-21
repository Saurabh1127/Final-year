import React from 'react';
import './Badge.css';

/**
 * Samvada Badge Component
 * Pill badges for status, metrics, tags, and LIVE indicators.
 */
export function Badge({
  children,
  variant = 'mint',
  size = 'sm',
  dot = false,
  pulse = false,
  icon = null,
  className = '',
  ...props
}) {
  return (
    <span
      className={`sam-badge sam-badge--${variant} sam-badge--${size} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`sam-badge__dot ${pulse ? 'sam-badge__dot--pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="sam-badge__icon">{icon}</span>}
      <span className="sam-badge__content">{children}</span>
    </span>
  );
}

export default Badge;
