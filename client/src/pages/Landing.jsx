import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { LandingNav } from '../components/Landing/LandingNav';
import { Hero } from '../components/Landing/Hero';
import { Features } from '../components/Landing/Features';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { UseCases } from '../components/Landing/UseCases';
import { Footer } from '../components/Landing/Footer';
import './Landing.css';

export function Landing() {
  useEffect(() => {
    document.title = 'Samvada — Real-Time Multilingual Video Meetings';
  }, []);

  return (
    <div className="sam-landing">
      {/* Ambient background glows */}
      <div className="sam-landing-ambient" aria-hidden="true">
        <div className="sam-landing-ambient__glow-hero" />
        <div className="sam-landing-ambient__glow-middle" />
        <div className="sam-landing-ambient__glow-bottom" />
      </div>

      {/* Navigation */}
      <LandingNav />

      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* How It Works Pipeline */}
      <HowItWorks />

      {/* Use Cases */}
      <UseCases />

      {/* Bottom CTA Banner */}
      <div className="sam-landing-container">
        <div className="sam-landing-cta-banner">
          <h2 className="sam-landing-cta-title">
            Ready to Connect Without Language Barriers?
          </h2>
          <p className="sam-landing-cta-desc">
            Host meetings with participants across continents speaking over 50 languages in natural cadence.
            Get started in seconds directly from your browser.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">
                Create Free Account
              </Button>
            </Link>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="lg">
                Sign In to Workspace
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
