import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * ThemeToggle
 * Dropdown or cycling toggle supporting Light, Dark, and System modes.
 */
export function ThemeToggle({ showLabel = false, className = '' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const getLabel = () => {
    if (theme === 'system') return `System (${resolvedTheme})`;
    return theme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <div className={`sam-theme-toggle ${className}`.trim()}>
      <button
        type="button"
        className="sam-theme-toggle__btn"
        onClick={cycleTheme}
        title={`Theme: ${getLabel()} (Click to cycle Light / Dark / System)`}
        aria-label={`Toggle theme, current is ${getLabel()}`}
      >
        {resolvedTheme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
        {showLabel && <span className="sam-theme-toggle__label">{getLabel()}</span>}
      </button>
    </div>
  );
}

/**
 * ThemeSegmentedControl
 * Full 3-option radio pill for Settings pages.
 */
export function ThemeSegmentedControl({ className = '' }) {
  const { theme, setTheme } = useTheme();

  const options = [
    {
      id: 'light',
      label: 'Light',
      desc: 'Sky & Daylight',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: 'dark',
      label: 'Dark',
      desc: 'Night & Space',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      id: 'system',
      label: 'System',
      desc: 'Match Device',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`sam-theme-segmented ${className}`.trim()} role="radiogroup" aria-label="Appearance Theme">
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`sam-theme-segment-btn ${isActive ? 'sam-theme-segment-btn--active' : ''}`}
            onClick={() => setTheme(opt.id)}
          >
            <div className="sam-theme-segment-btn__icon">{opt.icon}</div>
            <div className="sam-theme-segment-btn__content">
              <span className="sam-theme-segment-btn__label">{opt.label}</span>
              <span className="sam-theme-segment-btn__desc">{opt.desc}</span>
            </div>
            {isActive && <div className="sam-theme-segment-btn__check">✓</div>}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
