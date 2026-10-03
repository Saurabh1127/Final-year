import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Drawer, ThemeToggle } from '../ui';
import { useTheme } from '../../context/ThemeContext';

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <header className="sam-landing-nav bg-[var(--surface)]/90 border-b border-[var(--border)] backdrop-blur-md transition-colors duration-300">
      <div className="sam-landing-container sam-landing-nav__inner">
        {/* Brand */}
        <Link to="/" className="sam-landing-nav__brand">
          <div className="sam-landing-nav__logo-mark" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--accent-muted)' }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
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
          <span className="sam-landing-nav__title text-[var(--text-primary)] font-semibold tracking-tight transition-colors duration-300">SAMVADA</span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="sam-landing-nav__links">
          <a href="#features" className="sam-landing-nav__link text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150">
            Features
          </a>
          <a href="#how-it-works" className="sam-landing-nav__link text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150">
            How It Works
          </a>
          <a href="#use-cases" className="sam-landing-nav__link text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150">
            Use Cases
          </a>
          <a href="#technology" className="sam-landing-nav__link text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150">
            Technology
          </a>
        </nav>

        {/* Desktop Actions */}
        <div className="sam-landing-nav__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle />
          
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              Get Started Free
            </Button>
          </Link>

          {/* Mobile hamburger toggle */}
          <button
            type="button"
            className="sam-landing-nav__mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile navigation"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <Drawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        position="right"
        size="sm"
        title="Menu"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
          <a
            href="#features"
            className="sam-landing-nav__link"
            style={{ fontSize: '1rem', padding: '8px 0' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="sam-landing-nav__link"
            style={{ fontSize: '1rem', padding: '8px 0' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            How It Works
          </a>
          <a
            href="#use-cases"
            className="sam-landing-nav__link"
            style={{ fontSize: '1rem', padding: '8px 0' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Use Cases
          </a>
          <a
            href="#technology"
            className="sam-landing-nav__link"
            style={{ fontSize: '1rem', padding: '8px 0' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Technology
          </a>

          <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />

          <Link to="/login" style={{ textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="secondary" fullWidth>
              Sign in
            </Button>
          </Link>
          <Link to="/register" style={{ textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="primary" fullWidth>
              Get Started Free
            </Button>
          </Link>
        </div>
      </Drawer>
    </header>
  );
}

export default LandingNav;
