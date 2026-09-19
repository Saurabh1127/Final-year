import React from 'react';

// All languages supported by the AI service (NLLB-200 NMT + Edge TTS)
// Organized: Indian languages first (Tier 1), then global languages
export const SUPPORTED_LANGUAGES = [
  // ── Indian Languages (Tier 1 — full pipeline + Sarvam AI TTS) ──
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ta', label: '🇮🇳 Tamil' },
  { code: 'te', label: '🇮🇳 Telugu' },
  { code: 'mr', label: '🇮🇳 Marathi' },
  { code: 'bn', label: '🇮🇳 Bengali' },
  { code: 'gu', label: '🇮🇳 Gujarati' },
  { code: 'kn', label: '🇮🇳 Kannada' },
  { code: 'ml', label: '🇮🇳 Malayalam' },
  { code: 'pa', label: '🇮🇳 Punjabi' },
  { code: 'ur', label: '🇵🇰 Urdu' },
  // ── Global Languages ──
  { code: 'en', label: '🇺🇸 English' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'ko', label: '🇰🇷 Korean' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'pt', label: '🇧🇷 Portuguese' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'nl', label: '🇳🇱 Dutch' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'pl', label: '🇵🇱 Polish' },
  { code: 'uk', label: '🇺🇦 Ukrainian' },
  { code: 'vi', label: '🇻🇳 Vietnamese' },
  { code: 'th', label: '🇹🇭 Thai' },
  { code: 'sw', label: '🇰🇪 Swahili' },
];

export default function LanguageSelector({ currentLanguage, onChange, disabled, label = 'Translate to:', includeAuto = false }) {
  return (
    <div className="language-selector-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <label htmlFor={`language-select-${label.replace(/\s+/g, '-')}`} style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
        {label}
      </label>
      <select
        id={`language-select-${label.replace(/\s+/g, '-')}`}
        value={currentLanguage || (includeAuto ? 'auto' : 'hi')}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: '#1f2937',
          color: '#f9fafb',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '0.85rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
        }}
      >
        {includeAuto && (
          <option value="auto">🔍 Auto-detect</option>
        )}
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

