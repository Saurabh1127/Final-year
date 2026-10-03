import React from 'react';
import { MeetingCard } from './MeetingCard';
import { EmptyState, Button } from '../ui';

export function RecentMeetings({
  meetings = [],
  onJoinMeeting,
  onCreateClick,
}) {
  return (
    <div>
      <div className="sam-dashboard__sec-header flex items-center justify-between mb-4">
        <h3 className="sam-dashboard__sec-title text-lg font-semibold text-text-primary tracking-tight m-0">
          Recent Meetings
        </h3>
        <span className="text-xs text-text-muted">
          {meetings.length} sessions recorded
        </span>
      </div>

      {meetings.length > 0 ? (
        <div className="flex flex-col gap-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m.roomCode}
              meeting={m}
              onJoin={onJoinMeeting}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 sm:p-12">
          <EmptyState
            size="md"
            title="No Recent Meetings"
            description="You haven't hosted or joined any meetings yet. Start a new meeting to experience real-time speech translation with your peers."
            action={
              <Button
                variant="primary"
                size="md"
                onClick={onCreateClick}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                }
              >
                Start a Meeting
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

export default RecentMeetings;
