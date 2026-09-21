import React from 'react';
import './IconButton.css';

/**
 * Samvada IconButton Component
 * Circular icon action button with tooltips and call control variants
 */
export function IconButton({
  icon,
  children,
  variant = 'default',
  size = 'md',
  active = false,
  danger = false,
  muted = false,
  disabled = false,
  tooltip = '',
  tooltipPosition = 'top',
  ariaLabel,
  onClick,
  className = '',
  type = 'button',
  ...props
}) {
  // Determine effective variant
  let effectiveVariant = variant;
  if (danger) effectiveVariant = 'danger';
  else if (muted) effectiveVariant = 'muted';
  else if (active) effectiveVariant = 'active';

  const label = ariaLabel || tooltip || 'Action';

  const buttonElement = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`sam-icon-btn sam-icon-btn--${effectiveVariant} sam-icon-btn--${size} ${
        disabled ? 'sam-icon-btn--disabled' : ''
      } ${className}`.trim()}
      {...props}
    >
      {icon || children}
    </button>
  );

  if (!tooltip) {
    return buttonElement;
  }

  return (
    <div className="sam-icon-btn-wrap">
      {buttonElement}
      <span className={`sam-icon-tooltip sam-icon-tooltip--${tooltipPosition}`} role="tooltip">
        {tooltip}
      </span>
    </div>
  );
}

export default IconButton;
