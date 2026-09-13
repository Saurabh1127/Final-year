import React from 'react';

const POPULAR_LANGUAGES = [
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'ta', label: '🇮🇳 Tamil' },
  { code: 'te', label: '🇮🇳 Telugu' },
  { code: 'mr', label: '🇮🇳 Marathi' },
  { code: 'bn', label: '🇮🇳 Bengali' },
  { code: 'gu', label: '🇮🇳 Gujarati' },
  { code: 'kn', label: '🇮🇳 Kannada' },
  { code: 'ml', label: '🇮🇳 Malayalam' },
  { code: 'pa', label: '🇮🇳 Punjabi' },
  { code: 'ur', label: '🇵🇰 Urdu' },
];

export default function LanguageSelector({ currentLanguage, onChange, disabled }) {
  return (
    <div className="language-selector-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <label htmlFor="language-select" style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
        Translate to:
      </label>
      <select
        id="language-select"
        value={currentLanguage || 'hi'}
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
        {POPULAR_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
