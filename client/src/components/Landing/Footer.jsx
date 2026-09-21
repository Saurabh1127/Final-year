import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="sam-landing-footer">
      <div className="sam-landing-container">
        <div className="sam-landing-footer__grid">
          {/* Col 1: Brand */}
          <div className="sam-landing-footer__brand-col">
            <Link to="/" className="sam-auth-logo-row" style={{ justifyContent: 'flex-start', margin: 0 }}>
              <div className="sam-auth-logo-mark">
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="#00D4B2" strokeWidth="2.5" />
                  <path
                    d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23"
                    stroke="#00D4B2"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="16" cy="16" r="3.5" fill="#00D4B2" />
                </svg>
              </div>
              <span className="sam-auth-brand-name">SAMVADA</span>
            </Link>
            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.5, margin: 0, maxWidth: '280px' }}>
              Real-time multilingual video conferencing powered by cascaded speech-to-speech neural networks and WebRTC.
            </p>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="sam-landing-footer__col-title">Product</h4>
            <div className="sam-landing-footer__links">
              <a href="#features" className="sam-landing-footer__link">Features</a>
              <a href="#how-it-works" className="sam-landing-footer__link">Architecture</a>
              <a href="#use-cases" className="sam-landing-footer__link">Use Cases</a>
              <Link to="/register" className="sam-landing-footer__link">Get Started</Link>
            </div>
          </div>

          {/* Col 3: Technology */}
          <div>
            <h4 className="sam-landing-footer__col-title">Technology</h4>
            <div className="sam-landing-footer__links">
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>OpenAI Whisper</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>Meta NLLB-200</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>WebRTC Mesh</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>AudioWorklet VAD</span>
            </div>
          </div>

          {/* Col 4: Platform */}
          <div>
            <h4 className="sam-landing-footer__col-title">Security & Privacy</h4>
            <div className="sam-landing-footer__links">
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>P2P Encryption</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>Zero Media Storage</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>Ephemerality First</span>
              <span className="sam-landing-footer__link" style={{ cursor: 'default' }}>GDPR Compliant</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="sam-landing-footer__bottom">
          <span>© {new Date().getFullYear()} Samvada Platform. All rights reserved.</span>
          <span>Designed for boundaryless human conversation.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
