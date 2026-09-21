import React from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Speak Naturally in Your Language',
    desc: 'Join via browser without downloading apps or configuring virtual soundboards. Speak freely in your native language with zero interruption.',
  },
  {
    num: '02',
    title: 'Browser-Side Semantic Chunking',
    desc: 'An AudioWorklet VAD processor tracks voice energy in real-time, segmenting speech at natural acoustic pauses to preserve semantic continuity.',
  },
  {
    num: '03',
    title: 'Cascaded Neural Translation',
    desc: 'Whisper models transcribe with low Word Error Rates, NLLB-200 translates into target languages, and neural voices synthesize speech in milliseconds.',
  },
  {
    num: '04',
    title: 'Simultaneous Hearing & Captions',
    desc: 'Listeners hear the translated speech in real time while intelligent ducking softens the original voice. Synchronized subtitles ensure absolute clarity.',
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
