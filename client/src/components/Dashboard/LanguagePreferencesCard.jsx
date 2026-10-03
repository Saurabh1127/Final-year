import React from 'react';
import { Card, Badge, Button } from '../ui';

export function LanguagePreferencesCard({
  spokenLanguage = 'Auto-detect',
  preferredLanguage = 'English',
  onEdit,
}) {
  return (
    <Card variant="surface" padding="none" className="sam-lang-card rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-sm font-bold text-text-primary">
          Language Settings
        </h4>
        <Badge variant="success" size="sm" dot>
          ACTIVE
        </Badge>
      </div>

      <div className="sam-lang-card__item flex flex-col gap-1.5">
        <span className="sam-lang-card__label text-[11px] font-semibold uppercase tracking-wider font-mono text-text-muted">
          My Spoken Language
        </span>
        <div className="sam-lang-card__val text-sm font-medium text-text-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          <span>{spokenLanguage}</span>
        </div>
      </div>

      <div className="sam-lang-card__item flex flex-col gap-1.5">
        <span className="sam-lang-card__label text-[11px] font-semibold uppercase tracking-wider font-mono text-text-muted">
          Preferred Translation Language
        </span>
        <div className="sam-lang-card__val text-sm font-medium text-text-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
          <span>{preferredLanguage}</span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap pt-1">
        <Badge variant="gray" size="sm">Whisper ASR</Badge>
        <Badge variant="gray" size="sm">NLLB-200 NMT</Badge>
        <Badge variant="gray" size="sm">Edge-TTS</Badge>
      </div>

      <div className="mt-auto pt-2">
        <Button variant="secondary" size="sm" fullWidth onClick={onEdit}>
          Configure Languages
        </Button>
      </div>
    </Card>
  );
}

export default LanguagePreferencesCard;
