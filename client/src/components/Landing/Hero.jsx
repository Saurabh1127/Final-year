import React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Avatar } from '../ui';

export function Hero() {
  return (
    <section className="sam-landing-hero">
      <div className="sam-landing-container">
        {/* Badge */}
        <div className="sam-landing-hero__badge-wrap">
          <Badge variant="mint" size="md" dot pulse>
            Next-Generation Speech-to-Speech Meetings
          </Badge>
        </div>

        {/* Title */}
        <h1 className="sam-landing-hero__title">
          Meet Without Language Barriers.
          <span className="sam-landing-hero__title-accent">
            Spoken Live in Any Language.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="sam-landing-hero__desc">
          Break linguistic borders with decentralized WebRTC video calls coupled to neural speech-to-speech
          translation. Speak your native mother tongue; every participant listens and reads in theirs with sub-2s latency.
        </p>

        {/* CTAs */}
        <div className="sam-landing-hero__ctas">
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <Button
              variant="primary"
              size="lg"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              }
              iconPosition="right"
            >
              Start Free Meeting
            </Button>
          </Link>

          <a href="#how-it-works" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              See How It Works
            </Button>
          </a>
        </div>

        {/* ── Realistic Interactive Meeting UI Mockup ── */}
        <div className="sam-landing-mockup-wrap">
          <div className="sam-landing-mockup-header">
            <div className="sam-landing-mockup-dots">
              <span className="sam-landing-mockup-dot" />
              <span className="sam-landing-mockup-dot" />
              <span className="sam-landing-mockup-dot" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge variant="red" size="sm" dot pulse>
                LIVE CALL
              </Badge>
              <span style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'var(--lm-font-mono)' }}>
                ROOM: samvada-demo-01
              </span>
            </div>

            <Badge variant="blue" size="sm">
              AI Pipeline Healthy
            </Badge>
          </div>

          <div className="sam-landing-mockup-body">
            {/* Tile 1: Active Speaker */}
            <div className="sam-mockup-tile sam-mockup-tile--speaking">
              <div className="sam-mockup-tile__badge">
                <Badge variant="mint" size="sm" dot>
                  SPEAKING (HINDI)
                </Badge>
              </div>

              <Avatar
                name="Aarav Sharma"
                size="xl"
                status="speaking"
              />

              <div style={{ marginTop: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '14px', background: '#00D4B2', borderRadius: '2px', animation: 'speakingGlow 0.8s infinite alternate' }} />
                <span style={{ width: '4px', height: '22px', background: '#00D4B2', borderRadius: '2px', animation: 'speakingGlow 0.6s infinite alternate' }} />
                <span style={{ width: '4px', height: '18px', background: '#00D4B2', borderRadius: '2px', animation: 'speakingGlow 0.7s infinite alternate' }} />
                <span style={{ width: '4px', height: '12px', background: '#00D4B2', borderRadius: '2px', animation: 'speakingGlow 0.9s infinite alternate' }} />
              </div>

              <span className="sam-mockup-tile__name">Aarav Sharma (Host)</span>
            </div>

            {/* Tile 2: International Participant */}
            <div className="sam-mockup-tile">
              <div className="sam-mockup-tile__badge">
                <Badge variant="gray" size="sm">
                  LISTENING (ENGLISH)
                </Badge>
              </div>

              <Avatar
                name="Elena Rostova"
                size="xl"
                status="online"
              />

              <span className="sam-mockup-tile__name">Elena Rostova (Tokyo)</span>
            </div>

            {/* Live Dual Caption Overlay */}
            <div className="sam-mockup-caption-bar">
              <div className="sam-mockup-caption-speaker">
                Aarav → Elena
              </div>
              <div className="sam-mockup-caption-text">
                <span style={{ color: '#94A3B8' }}>Original: </span>
                <span style={{ fontStyle: 'italic', marginRight: '12px' }}>"नमस्ते, इस परियोजना की प्रगति बहुत अच्छी चल रही है।"</span>
                <span style={{ color: '#00D4B2', fontWeight: 600 }}>Translation: </span>
                <span>"Hello, this project's progress is going very well."</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="sam-landing-stats">
          <div className="sam-landing-stat-item">
            <span className="sam-landing-stat-value">50+</span>
            <span className="sam-landing-stat-label">Spoken Languages Supported</span>
          </div>
          <div className="sam-landing-stat-item">
            <span className="sam-landing-stat-value">&lt; 1.8s</span>
            <span className="sam-landing-stat-label">End-to-End S2ST Latency</span>
          </div>
          <div className="sam-landing-stat-item">
            <span className="sam-landing-stat-value">85-90%</span>
            <span className="sam-landing-stat-label">Intelligent Audio Ducking</span>
          </div>
          <div className="sam-landing-stat-item">
            <span className="sam-landing-stat-value">100%</span>
            <span className="sam-landing-stat-label">WebRTC In-Browser Encrypted</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
