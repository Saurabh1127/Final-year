import React from 'react';

const LANGUAGES = [
  { code: 'HI', name: 'Hindi',      native: 'हिन्दी' },
  { code: 'JA', name: 'Japanese',   native: '日本語' },
  { code: 'FR', name: 'French',     native: 'Français' },
  { code: 'DE', name: 'German',     native: 'Deutsch' },
  { code: 'PT', name: 'Portuguese', native: 'Português' },
  { code: 'ZH', name: 'Mandarin',   native: '普通话' },
  { code: 'AR', name: 'Arabic',     native: 'العربية' },
  { code: 'RU', name: 'Russian',    native: 'Русский' },
  { code: 'KO', name: 'Korean',     native: '한국어' },
  { code: 'IT', name: 'Italian',    native: 'Italiano' },
  { code: 'ES', name: 'Spanish',    native: 'Español' },
  { code: 'TR', name: 'Turkish',    native: 'Türkçe' },
  { code: 'NL', name: 'Dutch',      native: 'Nederlands' },
  { code: 'PL', name: 'Polish',     native: 'Polski' },
  { code: 'SV', name: 'Swedish',    native: 'Svenska' },
];

/**
 * GlobalConnectionSection
 * Scrolling ticker of supported languages.
 * Creates a "world of languages" feeling.
 */
export function GlobalConnectionSection() {
  // Duplicate array for seamless loop
  const doubled = [...LANGUAGES, ...LANGUAGES];

  return (
    <section
      id="languages"
      className="global-connection"
      aria-label="Supported languages"
    >
      <div className="sam-landing-container">
        <div className="sam-landing-section-header">
          <span className="sam-landing-section-tag">50+ Languages Supported</span>
          <h2 className="sam-landing-section-title">
            Every Language. One Platform.
          </h2>
          <p className="sam-landing-section-desc">
            SAMVADA speaks the world's most spoken languages — and more are added
            continuously. Native speakers. Natural cadence. Zero compromise.
          </p>
        </div>
      </div>

      {/* Ticker strip */}
      <div className="global-connection__ticker-wrap" role="marquee" aria-label="Language ticker">
        <div className="global-connection__ticker">
          {doubled.map((lang, i) => (
            <div key={`${lang.name}-${i}`} className="global-connection__pill">
              <span className="global-connection__code-badge" aria-hidden="true">
                {lang.code}
              </span>
              <span className="font-medium text-[var(--color-text-primary,#F2F0EA)]">{lang.name}</span>
              <span className="global-connection__native text-[var(--color-text-muted,#6F7C8C)]" aria-hidden="true">{lang.native}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GlobalConnectionSection;
