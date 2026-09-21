import React from 'react';
import { Card, Badge, Button } from '../ui';

export function MeetingCard({
  meeting,
  onJoin,
}) {
  const {
    roomCode,
    title = 'Untitled Meeting',
    createdAt = new Date(),
    status = 'active',
    languages = ['English', 'Hindi'],
  } = meeting;

  const dateStr = new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card variant="surface" padding="md" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#F8FAFC' }}>
              {title}
            </h4>
            <Badge variant={status === 'active' ? 'mint' : 'gray'} size="sm" dot={status === 'active'}>
              {status === 'active' ? 'ACTIVE' : 'ENDED'}
            </Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: '#94A3B8' }}>
            <span style={{ fontFamily: 'var(--lm-font-mono)' }}>#{roomCode}</span>
            <span>•</span>
            <span>{dateStr}</span>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {languages.map((lang) => (
              <Badge key={lang} variant="blue" size="sm">
                {lang}
              </Badge>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onJoin(roomCode)}
          >
            Join Call
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default MeetingCard;
