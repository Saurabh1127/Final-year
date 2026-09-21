import React from 'react';

// All languages supported by the AI service (NLLB-200 NMT + Edge TTS)
// Organized: Indian languages first (Tier 1), then global languages
export const SUPPORTED_LANGUAGES = [
  // ── Indian Languages (Tier 1 — full pipeline + Sarvam AI TTS) ──
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
  // ── Global Languages ──
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'tr', label: 'Turkish' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'sw', label: 'Swahili' },
];

export default function LanguageSelector({ currentLanguage, onChange, disabled, label = 'Translate to:', includeAuto = false }) {
  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor={`language-select-${label.replace(/\s+/g, '-')}`} className="text-xs text-slate-400 font-medium whitespace-nowrap">
        {label}
      </label>
      <select
        id={`language-select-${label.replace(/\s+/g, '-')}`}
        value={currentLanguage || (includeAuto ? 'auto' : 'hi')}
        onChange={(e) => onChange(e.target.value)}
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
