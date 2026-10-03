import React from 'react';

const FEATURES = [
  {
    title: 'Cascaded Neural Inference',
    desc: ['Whisper ASR + NLLB-200 translation', 'Neural Edge-TTS synthesis'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    isBlue: false,
  },
  {
    title: 'Intelligent Audio Ducking',
    desc: ['Original voice attenuated 85%', 'Restored smoothly on completion'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    ),
    isBlue: true,
  },
  {
    title: 'Full-Mesh WebRTC Video',
    desc: ['Ultra-low latency P2P streaming', 'Zero intermediary transcoding'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="m9 8 6 4-6 4V8Z" />
      </svg>
    ),
    isBlue: false,
  },
  {
    title: 'AudioWorklet VAD',
    desc: ['Real-time acoustic monitoring', 'Clean chunk finalization'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
    isBlue: true,
  },
  {
    title: 'Target Language Deduplication',
    desc: ['Single inference per language', 'Minimizes server GPU overhead'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    isBlue: false,
  },
  {
    title: 'AI Summary & Dual Transcripts',
    desc: ['Automated Gemini summaries', 'Full multilingual transcripts'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    isBlue: true,
  },
];

export function Features() {
  return (
    <section id="features" className="sam-landing-section">
      <div className="sam-landing-container">
        <div className="sam-landing-section-header">
          <span className="sam-landing-section-tag">Engineered For Fluid Conversation</span>
          <h2 className="sam-landing-section-title">
            Built for Zero-Friction Global Collaboration
          </h2>
          <p className="sam-landing-section-desc">
            Samvada replaces clunky post-processing transcription with simultaneous speech translation
            delivered directly to every listener's ears.
          </p>
        </div>

        <div className="sam-features-grid">
          {FEATURES.map((feature, idx) => (
            <div key={idx} className="sam-feature-card">
              <div
                className={`sam-feature-icon-wrap ${
                  feature.isBlue ? 'sam-feature-icon-wrap--blue' : ''
                }`}
              >
                {feature.icon}
              </div>
              <h3 className="sam-feature-title">{feature.title}</h3>
              <ul className="sam-feature-desc list-none p-0 m-0 space-y-2 mt-2">
                {feature.desc.map((point, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className={feature.isBlue ? 'text-[var(--color-accent-secondary)] font-bold' : 'text-[var(--accent)] font-bold'}>•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
