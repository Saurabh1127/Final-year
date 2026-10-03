import React, { useState, useEffect, useRef } from 'react';

const TRANSLATIONS = [
  {
    from: { text: 'नमस्ते, आप कैसे हैं?', lang: 'Hindi', flag: 'HI', color: '#ff8c42' },
    to:   { text: 'Hello, how are you?',    lang: 'English', flag: 'EN', color: 'var(--accent)' },
  },
  {
    from: { text: 'こんにちは、元気ですか？', lang: 'Japanese', flag: 'JA', color: '#e63946' },
    to:   { text: 'Hello, how are you?',     lang: 'English',  flag: 'EN', color: 'var(--accent)' },
  },
  {
    from: { text: 'Bonjour, comment allez-vous?', lang: 'French', flag: 'FR', color: '#457b9d' },
    to:   { text: 'Hello, how are you?',           lang: 'English', flag: 'EN', color: 'var(--accent)' },
  },
];

/**
 * TranslationSection
 * The key product moment: shows speech being translated by SAMVADA.
 * Cycles through language pairs automatically with animated signal arc.
 */
export function TranslationSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState('showing-source'); // 'showing-source' | 'translating' | 'showing-result'
  const [signalPos, setSignalPos] = useState(0); // 0–1 for arc animation
  const animRef = useRef(null);

  useEffect(() => {
    const cycle = async () => {
      // Phase 1: show source text
      setPhase('showing-source');
      await delay(1200);

      // Phase 2: translation in progress
      setPhase('translating');
      // Animate signal from 0 to 1
      const start = Date.now();
      const dur = 900;
      const animSignal = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        setSignalPos(p);
        if (p < 1) animRef.current = requestAnimationFrame(animSignal);
      };
      animRef.current = requestAnimationFrame(animSignal);
      await delay(dur + 100);

      // Phase 3: show translated text
      setPhase('showing-result');
      await delay(1800);

      // Advance to next pair
      setActiveIndex(i => (i + 1) % TRANSLATIONS.length);
      setSignalPos(0);
    };

    const id = setTimeout(cycle, 400);
    return () => {
      clearTimeout(id);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const pair = TRANSLATIONS[activeIndex];

  return (
    <section id="translation" className="sam-landing-section translation-section" aria-label="Translation demonstration">
      <div className="sam-landing-container">
        <div className="sam-landing-section-header">
          <span className="sam-landing-section-tag">The SAMVADA Moment</span>
          <h2 className="sam-landing-section-title">
            Every Word Understood.<br />Every Language Respected.
          </h2>
          <p className="sam-landing-section-desc">
            Watch SAMVADA translate spoken language in real time — preserving
            meaning, tone, and cultural nuance across borders.
          </p>
        </div>

        <div className="translation-demo">
          {/* Language Pair Tabs */}
          <div className="translation-demo__tabs" role="tablist">
            {TRANSLATIONS.map((t, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIndex}
                className={`translation-tab ${i === activeIndex ? 'translation-tab--active' : ''}`}
                onClick={() => { setActiveIndex(i); setPhase('showing-source'); setSignalPos(0); }}
                style={{ '--tab-color': t.from.color }}
              >
                <span>{t.from.flag}</span>
                <span>{t.from.lang}</span>
              </button>
            ))}
          </div>

          {/* Translation Display */}
          <div className="translation-demo__display">
            {/* Source */}
            <div
              className={`translation-box translation-box--source ${phase !== 'showing-source' && phase !== 'translating' && phase !== 'showing-result' ? '' : 'translation-box--visible'}`}
              style={{ '--box-color': pair.from.color }}
            >
              <div className="translation-box__lang">
                <span className="translation-box__flag">{pair.from.flag}</span>
                <span>{pair.from.lang}</span>
              </div>
              <div className="translation-box__text text-slate-900 dark:text-white font-medium">{pair.from.text}</div>
              <div className="translation-box__wave">
                {[14, 22, 18, 26, 14, 20, 16].map((h, i) => (
                  <span
                    key={i}
                    className="translation-box__wave-bar"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${i * 0.1}s`,
                      background: pair.from.color,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* SAMVADA Hub */}
            <div className="translation-hub">
              <div className={`translation-hub__core ${phase === 'translating' ? 'translation-hub__core--active' : ''}`}>
                <div className="translation-hub__logo">S</div>
                <div className="translation-hub__label">SAMVADA</div>
                {phase === 'translating' && (
                  <div className="translation-hub__processing">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>

              {/* Animated signal arc */}
              <svg className="translation-hub__arc" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={pair.from.color} />
                    <stop offset="100%" stopColor={pair.to.color} />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 40 Q 100 10 200 40"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2"
                  fill="none"
                />
                {phase === 'translating' && (
                  <path
                    d="M 0 40 Q 100 10 200 40"
                    stroke="url(#arcGrad)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray="220"
                    strokeDashoffset={220 - signalPos * 220}
                    style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                  />
                )}
              </svg>
            </div>

            {/* Target */}
            <div
              className={`translation-box translation-box--target ${phase === 'showing-result' ? 'translation-box--visible' : ''}`}
              style={{ '--box-color': pair.to.color }}
            >
              <div className="translation-box__lang">
                <span className="translation-box__flag">{pair.to.flag}</span>
                <span>{pair.to.lang}</span>
              </div>
              <div className="translation-box__text text-slate-900 dark:text-white font-medium">{pair.to.text}</div>
              <div className="translation-box__wave">
                {[12, 20, 16, 24, 12, 18, 14].map((h, i) => (
                  <span
                    key={i}
                    className="translation-box__wave-bar"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${i * 0.1 + 0.3}s`,
                      background: pair.to.color,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="translation-demo__footnote" aria-hidden="true">
            Sub-2 second end-to-end latency · 50+ languages · 100% browser-native
          </p>
        </div>
      </div>
    </section>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default TranslationSection;
