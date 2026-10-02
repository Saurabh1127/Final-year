import React from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Speak Naturally in Your Language',
    desc: 'Join via browser. Speak freely in your native language.',
  },
  {
    num: '02',
    title: 'Browser-Side Semantic Chunking',
    desc: 'AudioWorklet VAD segments speech at natural pauses for semantic accuracy.',
  },
  {
    num: '03',
    title: 'Cascaded Neural Translation',
    desc: 'Whisper transcribes, NLLB-200 translates, Edge-TTS synthesizes — in milliseconds.',
  },
  {
    num: '04',
    title: 'Simultaneous Hearing & Captions',
    desc: 'Translated speech plays in real time with intelligent ducking and synced subtitles.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="sam-landing-section">
      <div className="sam-landing-container">
        <div className="sam-landing-section-header">
          <span className="sam-landing-section-tag">Cascaded Architecture</span>
          <h2 className="sam-landing-section-title">
            How Samvada Works in Real Time
          </h2>
          <p className="sam-landing-section-desc">
            A high-performance pipeline turning multilingual speech into seamless natural dialogue under 1.8 seconds.
          </p>
        </div>

        <div className="sam-steps-grid">
          {STEPS.map((step) => (
            <div key={step.num} className="sam-step-card">
              <span className="sam-step-num">{step.num}</span>
              <h3 className="sam-step-title">{step.title}</h3>
              <p className="sam-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
