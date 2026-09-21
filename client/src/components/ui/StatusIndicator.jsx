import React from 'react';
import './StatusIndicator.css';

/**
 * Samvada StatusIndicator Component
 * Semantic colored status dot with label and pulse animation options.
 */
export function StatusIndicator({
  status = 'online', // 'online' | 'offline' | 'warning' | 'degraded' | 'busy' | 'speaking'
  label = '',
  pulse = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  ...props
}) {
  const shouldPulse = pulse || status === 'speaking';

  return (
    <div
      className={`sam-status-indicator sam-status-indicator--${status} sam-status-indicator--${size} ${className}`.trim()}
      {...props}
    >
      <div className="sam-status-dot-wrap">
        <span
          className={`sam-status-dot ${
            shouldPulse ? 'sam-status-dot--pulse' : ''
          }`}
          aria-hidden="true"
        />
      </div>

      {label && <span className="sam-status-label">{label}</span>}
    </div>
  );
}

export default StatusIndicator;
