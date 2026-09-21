import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, useToast } from '../ui';
import { SUPPORTED_LANGUAGES } from '../Meeting/LanguageSelector';

const PIPELINE_MODELS = [
  {
    role: 'Speech Recognition (ASR)',
    model: 'OpenAI Whisper Large-v3',
    latency: '< 400ms chunk latency',
    status: 'Operational',
  },
  {
    role: 'Machine Translation (NMT)',
    model: 'Meta NLLB-200 Distilled 600M',
    latency: '< 180ms inference',
    status: 'Operational',
  },
  {
    role: 'Neural Voice Synthesis (TTS)',
    model: 'Microsoft Edge Neural Streamer',
    latency: 'Natural human timbre stream',
    status: 'Operational',
  },
];

/**
 * LanguageSettings
 * Controls default spoken voice input, preferred listening translation target,
 * multi-cast translation tags, and AI model telemetry configurations.
 */
export function LanguageSettings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sourceLang, setSourceLang] = useState(() => {
    return localStorage.getItem('samvada_default_source_lang') || 'auto';
  });

  const [targetLang, setTargetLang] = useState(() => {
    return localStorage.getItem('samvada_default_target_lang') || user?.preferredLanguage || 'hi';
  });

  const [pinnedLanguages, setPinnedLanguages] = useState(() => {
    try {
      const stored = localStorage.getItem('samvada_pinned_languages');
      return stored ? JSON.parse(stored) : ['en', 'hi', 'es', 'bn', 'ta'];
    } catch {
      return ['en', 'hi', 'es', 'bn', 'ta'];
    }
  });

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('samvada_default_source_lang', sourceLang);
    localStorage.setItem('samvada_default_target_lang', targetLang);
    localStorage.setItem('samvada_pinned_languages', JSON.stringify(pinnedLanguages));
    toast.success('Language preferences saved successfully!');
  };

  const togglePinnedLang = (code) => {
    setPinnedLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length <= 1) {
          toast.warning('Keep at least one quick language selected.');
          return prev;
        }
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  return (
    <div className="sam-settings-section" aria-label="Language and translation settings">
      <div className="sam-settings-section__header">
        <h3 className="sam-settings-section__title">Language & Speech Translation</h3>
        <p className="sam-settings-section__desc">
          Configure how your voice is recognized, translated, and synthesized in live conferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="sam-settings-card">
        <h4 className="sam-settings-card__title">Default Language Preferences</h4>

        <div className="sam-settings-grid-2">
          {/* Default Spoken Language */}
          <div className="sam-settings-form__group">
            <label htmlFor="settings-source-lang" className="sam-settings-label">
              Default Spoken Language (Mic Input)
            </label>
            <select
              id="settings-source-lang"
              className="sam-settings-select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option value="auto">Auto-Detect Language (Whisper VAD)</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
            <span className="sam-settings-hint">
              Used as the speech recognition hint for real-time transcription.
            </span>
          </div>

          {/* Default Target Language */}
          <div className="sam-settings-form__group">
            <label htmlFor="settings-target-lang" className="sam-settings-label">
              Default Listening Language (Audio & Subtitles)
            </label>
            <select
              id="settings-target-lang"
              className="sam-settings-select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
            <span className="sam-settings-hint">
              All remote participant speech will automatically be translated into this language.
            </span>
          </div>
        </div>

        {/* Pinned Languages */}
        <div className="sam-settings-form__group" style={{ marginTop: '8px' }}>
          <label className="sam-settings-label">
            Quick-Switch Language Matrix
          </label>
          <p className="sam-settings-hint" style={{ marginBottom: '10px' }}>
            Click languages to pin them for rapid switching during active video calls:
          </p>

          <div className="sam-settings-tags-wrap">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isPinned = pinnedLanguages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => togglePinnedLang(lang.code)}
                  className={`sam-settings-lang-tag ${
                    isPinned ? 'sam-settings-lang-tag--active' : ''
                  }`}
                  aria-pressed={isPinned}
                >
                  <span>{lang.name}</span>
                  <span className="sam-settings-lang-tag__native">
                    {lang.nativeName}
                  </span>
                  {isPinned && <span className="sam-settings-lang-tag__check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sam-settings-form__actions">
          <Button type="submit" variant="primary" size="sm">
            Save Language Preferences
          </Button>
        </div>
      </form>

      {/* AI Pipeline Specifications Card */}
      <div className="sam-settings-card">
        <h4 className="sam-settings-card__title">Speech Translation AI Stack</h4>
        <p className="sam-settings-card__desc">
          State-of-the-art neural architecture running low-latency voice pipelines.
        </p>

        <div className="sam-settings-pipeline-list">
          {PIPELINE_MODELS.map((item, idx) => (
            <div key={idx} className="sam-settings-pipeline-item">
              <div className="sam-settings-pipeline-item__left">
                <span className="sam-settings-pipeline-role">{item.role}</span>
                <span className="sam-settings-pipeline-model">{item.model}</span>
              </div>
              <div className="sam-settings-pipeline-item__right">
                <span className="sam-settings-pipeline-latency">{item.latency}</span>
                <span className="sam-settings-pipeline-status">
                  <span className="sam-settings-pipeline-dot" />
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LanguageSettings;
