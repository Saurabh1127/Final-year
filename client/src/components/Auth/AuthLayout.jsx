import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ui';

/**
 * AuthLayout
 * Editorial 2-column layout for authentication pages.
 * Left: Brand showcase, live translation telemetry preview, and protocol stats.
 * Right: Tactile, focused form container.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footerPrompt,
  footerLinkText,
  footerLinkTo,
  tag = 'AI Speech-to-Speech Translation',
  headline = 'Speak naturally. Bridge every distance.',
  description = 'Real-time conversational translation connecting teams across 50+ languages without latency or friction.',
  previewPair = {
    fromLang: 'Hindi',
    fromText: 'नमस्ते, क्या हम आज की समीक्षा शुरू कर सकते हैं?',
    toLang: 'English',
    toText: 'Hello, can we begin today’s review session?',
  },
}) {
  return (
    <div className="sam-auth-page" style={{ position: 'relative' }}>
      {/* Top right Theme Toggle */}
      <div style={{ position: 'absolute', top: '18px', right: '20px', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      <div className="sam-auth-ambient" aria-hidden="true">
        <div className="sam-auth-ambient__glow-1" />
        <div className="sam-auth-ambient__glow-2" />
      </div>

      <div className="sam-auth-container">
        {/* Left Column: Editorial Showcase (Desktop min-width: 960px) */}
        <aside className="sam-auth-showcase">
          <div className="sam-auth-showcase__grid-bg" aria-hidden="true" />

          {/* Top Brand */}
          <Link to="/" className="sam-auth-showcase-brand" aria-label="Go to SAMVADA home">
            <div className="sam-auth-logo-mark">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="var(--accent)" strokeWidth="2.5" />
                <path
                  d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="16" r="3.5" fill="var(--accent)" />
              </svg>
            </div>
            <span className="sam-auth-brand-name">SAMVADA</span>
          </Link>

          {/* Center Editorial Content */}
          <div className="sam-auth-showcase-content">
            <span className="sam-auth-showcase-tag">{tag}</span>
            <h2 className="sam-auth-showcase-title">{headline}</h2>
            <p className="sam-auth-showcase-desc">{description}</p>

            {/* Translation Telemetry Card */}
            <div className="sam-auth-preview-card" aria-hidden="true">
              <div className="sam-auth-preview-row">
                <span className="sam-auth-preview-badge sam-auth-preview-badge--source">
                  SPEAKER · {previewPair.fromLang.toUpperCase()}
                </span>
                <span className="font-mono text-[0.7rem] text-[var(--text-muted,#718092)]">AUDIO IN</span>
              </div>
              <div className="sam-auth-preview-text">"{previewPair.fromText}"</div>

              <div className="sam-auth-preview-arrow">
                <span>Cascaded Neural Engine · 1.6s</span>
              </div>

              <div className="sam-auth-preview-row">
                <span className="sam-auth-preview-badge sam-auth-preview-badge--target">
                  SYNTHESIS · {previewPair.toLang.toUpperCase()}
                </span>
                <span className="font-mono text-[0.7rem] text-[var(--accent)]">SYNCHRONIZED</span>
              </div>
              <div className="sam-auth-preview-text text-[var(--text-primary,#F4F5F3)]">
                "{previewPair.toText}"
              </div>
            </div>
          </div>

          {/* Bottom Protocol Stats */}
          <div className="sam-auth-showcase-footer">
            <div className="sam-auth-showcase-stat">
              <span className="sam-auth-showcase-stat-dot" />
              <span>WebRTC Full-Mesh</span>
            </div>
            <div className="sam-auth-showcase-stat">
              <span className="sam-auth-showcase-stat-dot" />
              <span>50+ Languages</span>
            </div>
            <div className="sam-auth-showcase-stat">
              <span className="sam-auth-showcase-stat-dot" />
              <span>Zero Media Storage</span>
            </div>
          </div>
        </aside>

        {/* Right Column: Form Panel */}
        <div className="sam-auth-form-column">
          <div className="sam-auth-card">
            {/* Header */}
            <div className="sam-auth-header">
              {/* Mobile-only logo row */}
              <Link to="/" className="sam-auth-logo-row sam-auth-logo-row--mobile-only">
                <div className="sam-auth-logo-mark">
                  <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="var(--accent)" strokeWidth="2.5" />
                    <path
                      d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="16" cy="16" r="3.5" fill="var(--accent)" />
                  </svg>
                </div>
                <span className="sam-auth-brand-name">SAMVADA</span>
              </Link>

              <h1 className="sam-auth-title">{title}</h1>
              {subtitle && <p className="sam-auth-subtitle">{subtitle}</p>}
            </div>

            {/* Form Slot */}
            {children}

            {/* Footer Row */}
            {footerPrompt && footerLinkText && footerLinkTo && (
              <div className="sam-auth-footer">
                {footerPrompt}{' '}
                <Link to={footerLinkTo} className="sam-auth-link">
                  {footerLinkText}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
