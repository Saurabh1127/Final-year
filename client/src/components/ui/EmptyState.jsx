import React from 'react';
import './EmptyState.css';

/**
 * Samvada EmptyState Component
 * Modern feedback illustration/icon and guidance when data, meetings, or transcripts are empty.
 */
export function EmptyState({
  icon = null,
  title = '',
  description = '',
  action = null,
  secondaryAction = null,
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  ...props
}) {
  const defaultIcon = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  );

  return (
    <div
      className={`sam-empty-state sam-empty-state--${size} ${className}`.trim()}
      {...props}
    >
      <div className="sam-empty-state__icon-wrap">
        {icon || defaultIcon}
      </div>

      {title && <h3 className="sam-empty-state__title">{title}</h3>}
      {description && <p className="sam-empty-state__desc">{description}</p>}

      {(action || secondaryAction) && (
        <div className="sam-empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
