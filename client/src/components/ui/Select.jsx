import React, { useId } from 'react';
import './Select.css';

/**
 * Samvada Select Component
 * Accessible, sleek dropdown with customizable options and prefix icons
 */
export function Select({
  options = [],
  value,
  onChange,
  label = '',
  error = '',
  icon = null,
  size = 'md',
  compact = false,
  placeholder = '',
  disabled = false,
  required = false,
  id,
  className = '',
  wrapperClassName = '',
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={`sam-select-group ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className="sam-select-label">
          {label}
        </label>
      )}

      <div
        className={`sam-select-wrapper sam-select-wrapper--${size} ${
          compact ? 'sam-select-wrapper--compact' : ''
        } ${error ? 'sam-select-wrapper--error' : ''} ${
          disabled ? 'sam-select-wrapper--disabled' : ''
        } ${wrapperClassName}`.trim()}
      >
        {icon && <div className="sam-select-prefix">{icon}</div>}

        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className="sam-select"
          aria-invalid={Boolean(error)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((option) => {
            if (typeof option === 'string') {
              return (
                <option key={option} value={option}>
                  {option}
                </option>
              );
            }
            return (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label || option.value}
              </option>
            );
          })}
        </select>

        <div className="sam-select-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {error && <div className="sam-select-error">{error}</div>}
    </div>
  );
}

export default Select;
