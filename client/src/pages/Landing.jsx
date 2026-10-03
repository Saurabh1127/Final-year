import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { LandingNav } from '../components/Landing/LandingNav';
import { Features } from '../components/Landing/Features';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { UseCases } from '../components/Landing/UseCases';
import { Footer } from '../components/Landing/Footer';

// New globe-based landing components
import { GlobeHero } from '../components/Landing/GlobeHero';
import { TranslationSection } from '../components/Landing/TranslationSection';
import { GlobalConnectionSection } from '../components/Landing/GlobalConnectionSection';
import { FinalCTA } from '../components/Landing/FinalCTA';

// Styles

/** Detect user's reduced-motion preference */
function usePrefersReducedMotion() {
  const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return mediaQuery?.matches ?? false;
}

/**
 * Landing — SAMVADA marketing landing page.
 */
export function Landing() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    document.title = 'SAMVADA — AI Speech-to-Speech Translation. Any Language. Instantly.';
  }, []);

  return (
    <div
      className="sam-landing bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300"
    >
      {/* Skip link for keyboard accessibility */}
      <a href="#main-content" className="sam-skip-link">
        Skip to main content
      </a>

      {/* ── Navigation ── */}
      <LandingNav />

      {/* ── Main content ── */}
      <main id="main-content">
        {/* Globe Hero + Scroll Story with resolvedTheme (daylight atmosphere in light mode, deep space in dark mode) */}
        <GlobeHero prefersReducedMotion={prefersReducedMotion} theme={resolvedTheme} />

        {/* PHASE 10: Translation Moment */}
        <TranslationSection />

        {/* PHASE 11: Global Languages */}
        <GlobalConnectionSection />

        {/* Existing: Features */}
        <Features />

        {/* Existing: How It Works */}
        <HowItWorks />

        {/* Existing: Use Cases */}
        <UseCases />

        {/* PHASE 12: Final CTA */}
        <FinalCTA />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
