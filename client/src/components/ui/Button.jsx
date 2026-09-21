import React from 'react';
import './Button.css';

/**
 * Samvada Primary Button Component
 * Supports variants: primary, secondary, outline, ghost, danger, icon-only
 * Supports sizes: sm, md, lg
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading;
  const isIconOnly = variant === 'icon-only' || (!children && icon);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={`sam-btn sam-btn--${variant} sam-btn--${size} ${
        fullWidth ? 'sam-btn--full' : ''
      } ${isIconOnly ? 'sam-btn--icon-only' : ''} ${
        isDisabled ? 'sam-btn--disabled' : ''
      } ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <svg
          className="sam-btn__spinner"
          width={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
          height={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        icon && iconPosition === 'left' && <span className="sam-btn__icon">{icon}</span>
      )}

      {children && <span className="sam-btn__label">{children}</span>}

      {!loading && icon && iconPosition === 'right' && (
        <span className="sam-btn__icon">{icon}</span>
      )}
    </button>
  );
}

export default Button;
