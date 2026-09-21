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
      className={`sam-qa-card ${disabled ? 'sam-qa-card--disabled' : ''}`}
    >
      <div className="sam-qa-card__top">
        <div
          className={`sam-qa-card__icon-wrap ${
            variant === 'blue'
              ? 'sam-qa-card__icon-wrap--blue'
              : variant === 'muted'
              ? 'sam-qa-card__icon-wrap--muted'
              : ''
          }`}
        >
          {icon}
        </div>

        {badge && (
          <Badge variant={disabled ? 'gray' : variant === 'blue' ? 'blue' : 'mint'} size="sm">
            {badge}
          </Badge>
        )}
      </div>

      <h3 className="sam-qa-card__title">{title}</h3>
      <p className="sam-qa-card__desc">{description}</p>

      {!disabled && (
        <div className="sam-qa-card__arrow">
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
