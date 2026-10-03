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
    <Card variant="surface" padding="none" className="rounded-xl border border-border bg-surface p-4 mb-3 transition-colors hover:bg-surface-elevated">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-sm font-semibold text-text-primary">
              {title}
            </h4>
            <Badge variant={status === 'active' ? 'success' : 'gray'} size="sm" dot={status === 'active'}>
              {status === 'active' ? 'ACTIVE' : 'ENDED'}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="font-mono">#{roomCode}</span>
            <span>•</span>
            <span>{dateStr}</span>
          </div>

          <div className="flex gap-1.5 mt-1 flex-wrap">
            {languages.map((lang) => (
              <Badge key={lang} variant="gray" size="sm">
                {lang}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            variant="secondary"
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
