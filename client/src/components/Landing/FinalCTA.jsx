import React from 'react';
import { Link } from 'react-router-dom';

/**
 * FinalCTA — the closing section of the SAMVADA landing page.
 * Visually climactic: deep gradient, large text, dual buttons.
 */
export function FinalCTA() {
  return (
    <section
      id="cta"
      className="final-cta"
      aria-labelledby="cta-heading"
    >
      {/* Background glow rings */}
      <div className="final-cta__rings" aria-hidden="true">
        <div className="final-cta__ring final-cta__ring--1" />
        <div className="final-cta__ring final-cta__ring--2" />
        <div className="final-cta__ring final-cta__ring--3" />
      </div>

      <div className="sam-landing-container final-cta__content">
        <div className="final-cta__eyebrow">
          <span className="final-cta__dot" aria-hidden="true" />
          One world. Many voices.
        </div>

        <h2 id="cta-heading" className="final-cta__heading">
          Speak Your Language.
          <span className="final-cta__heading-accent"> Be Understood.</span>
        </h2>

        <p className="final-cta__sub">
          Join thousands of teams, educators, and global collaborators who have
          removed language as a barrier. Start your first meeting in seconds —
          no downloads, no plugins.
        </p>

        <div className="final-cta__buttons flex flex-wrap items-center justify-center gap-4">
          <Link to="/register" className="sam-btn sam-btn--primary sam-btn--lg" id="cta-register">
            <span>Start a Conversation</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>

          <Link to="/login" className="sam-btn sam-btn--secondary sam-btn--lg" id="cta-login">
            Sign In to Workspace
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="final-cta__trust" aria-label="Key product highlights">
          {[
            { label: '50+ Languages' },
            { label: 'Sub-2s Latency' },
            { label: 'End-to-End Encrypted' },
            { label: 'AI-Powered' },
          ].map((item) => (
            <div key={item.label} className="final-cta__trust-item">
              <img src="/favicon.svg" alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
