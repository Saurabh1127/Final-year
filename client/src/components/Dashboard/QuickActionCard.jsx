import React from 'react';
import { Card, Badge } from '../ui';

export function QuickActionCard({
  title,
  description,
  icon,
  badge = null,
  variant = 'mint', // 'mint' | 'blue' | 'muted'
  onClick,
  disabled = false,
  actionText = 'Open',
}) {
  return (
    <Card
      variant={disabled ? 'surface' : 'interactive'}
      padding="none"
      onClick={disabled ? undefined : onClick}
      className={`sam-qa-card p-6 flex flex-col h-full bg-surface border border-border rounded-xl transition-all duration-150 ${
        disabled
          ? 'sam-qa-card--disabled opacity-55 cursor-not-allowed'
          : 'cursor-pointer hover:bg-surface-elevated hover:border-border-strong'
      }`}
    >
      <div className="sam-qa-card__top flex items-center justify-between mb-4">
        <div
          className={`sam-qa-card__icon-wrap w-11 h-11 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0 ${
            variant === 'muted' || disabled
              ? 'text-text-muted'
              : 'text-accent'
          }`}
        >
          {icon}
        </div>

        {badge && (
          <Badge variant="gray" size="sm">
            {badge}
          </Badge>
        )}
      </div>

      <h3 className="sam-qa-card__title font-sans text-base font-semibold tracking-tight text-text-primary m-0 mb-1.5">
        {title}
      </h3>
      <p className="sam-qa-card__desc text-xs leading-relaxed text-text-secondary m-0">
        {description}
      </p>

      {!disabled && (
        <div className="sam-qa-card__arrow mt-auto pt-4 flex items-center gap-1.5 text-xs font-semibold text-accent">
          <span>{actionText}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      )}
    </Card>
  );
}

export default QuickActionCard;
