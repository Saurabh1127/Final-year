import React from 'react';
import { Card, Badge, Button } from '../ui';

export function LanguagePreferencesCard({
  spokenLanguage = 'Auto-detect',
  preferredLanguage = 'English',
  onEdit,
}) {
  return (
    <Card variant="surface" padding="none" className="sam-lang-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#FFFFFF' }}>
          Language Settings
        </h4>
        <Badge variant="mint" size="sm" dot>
          ACTIVE
        </Badge>
      </div>

      <div className="sam-lang-card__item">
        <span className="sam-lang-card__label">My Spoken Language</span>
        <div className="sam-lang-card__val">
          <span>🎙️</span>
          <span>{spokenLanguage}</span>
        </div>
      </div>

      <div className="sam-lang-card__item">
        <span className="sam-lang-card__label">Preferred Translation Language</span>
        <div className="sam-lang-card__val">
          <span>🎧</span>
          <span>{preferredLanguage}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
        <Badge variant="blue" size="sm">Whisper ASR</Badge>
        <Badge variant="blue" size="sm">NLLB-200 NMT</Badge>
        <Badge variant="mint" size="sm">Edge-TTS</Badge>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <Button variant="outline" size="sm" fullWidth onClick={onEdit}>
          Configure Languages
        </Button>
      </div>
    </Card>
  );
}

export default LanguagePreferencesCard;
