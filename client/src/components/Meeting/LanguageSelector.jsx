import React from 'react';

// All languages supported by the AI service (NLLB-200 NMT + Edge TTS)
// Organized: Indian languages first (Tier 1), then global languages
export const SUPPORTED_LANGUAGES = [
  // ── Indian Languages (Tier 1 — full pipeline + Sarvam AI TTS) ──
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ur', label: 'Urdu (اردو)' },
  // ── Global Languages ──
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'pl', label: 'Polish (Polski)' },
  { code: 'uk', label: 'Ukrainian (Українська)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
  { code: 'th', label: 'Thai (ไทย)' },
  { code: 'sw', label: 'Swahili (Kiswahili)' },
];

export default function LanguageSelector({
  currentLanguage,
  onChange,
  disabled = false,
  label = 'Translate to:',
  includeAuto = false,
  fullWidth = false,
  className = '',
}) {
  const selectId = `language-select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  if (fullWidth) {
    return (
      <div className={`sam-lang-selector-full ${className}`}>
        <label htmlFor={selectId} className="sam-lang-selector-full__label">
          {label}
        </label>
        <div className="sam-lang-selector-full__select-wrap">
          <select
            id={selectId}
            value={currentLanguage || (includeAuto ? 'auto' : 'hi')}
            onChange={(e) => onChange && onChange(e.target.value)}
            disabled={disabled}
            className="sam-lang-selector-full__select"
          >
            {includeAuto && (
              <option value="auto">Auto-detect</option>
            )}
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <div className="sam-lang-selector-full__arrow" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <label htmlFor={selectId} className="text-xs text-slate-400 font-medium whitespace-nowrap">
        {label}
      </label>
      <select
        id={selectId}
        value={currentLanguage || (includeAuto ? 'auto' : 'hi')}
        onChange={(e) => onChange && onChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#141722] border border-white/10 text-white outline-none focus:border-[#00d4b2] focus:ring-1 focus:ring-[#00d4b2] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {includeAuto && (
          <option value="auto" className="bg-[#141722] text-white">Auto-detect</option>
        )}
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-[#141722] text-white">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Returns a friendly primary language name for a given language code (e.g. 'hi' -> 'Hindi')
 */
export function getLanguageLabel(code) {
  if (!code || code === 'auto') return 'Auto';
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) {
    return found.label.split(' ')[0];
  }
  return code.toUpperCase();
}

