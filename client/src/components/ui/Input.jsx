import React, { useState, useId } from 'react';
import './Input.css';

/**
 * Samvada Input Component
 * Features prefix/suffix icons, password show/hide toggle, helper/error text, and ARIA labels.
 */
export function Input({
  type = 'text',
  label = '',
  error = '',
  helperText = '',
  icon = null,
  rightElement = null,
  showPasswordToggle = false,
  size = 'md',
  disabled = false,
  required = false,
  id,
  className = '',
  wrapperClassName = '',
  value,
  onChange,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`sam-input-group ${className}`.trim()}>
      {label && (
        <div className="sam-input-label-row">
          <label htmlFor={inputId} className="sam-input-label">
            {label}
            {required && <span className="sam-input-required">*</span>}
          </label>
        </div>
      )}

      <div
        className={`sam-input-wrapper sam-input-wrapper--${size} ${
          error ? 'sam-input-wrapper--error' : ''
        } ${disabled ? 'sam-input-wrapper--disabled' : ''} ${wrapperClassName}`.trim()}
      >
        {icon && <div className="sam-input-prefix">{icon}</div>}

        <input
          id={inputId}
          type={effectiveType}
          disabled={disabled}
          required={required}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className="sam-input"
          {...props}
        />

        {isPassword && showPasswordToggle && (
          <div className="sam-input-suffix">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="sam-input-toggle-btn"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        )}

        {!isPassword && rightElement && (
          <div className="sam-input-suffix">{rightElement}</div>
        )}
      </div>

      {error ? (
        <div id={errorId} className="sam-input-error" role="alert">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div id={helperId} className="sam-input-helper">
          {helperText}
        </div>
      ) : null}
    </div>
  );
}

export default Input;
