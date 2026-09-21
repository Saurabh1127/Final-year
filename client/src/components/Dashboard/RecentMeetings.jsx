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
      <div className="sam-dashboard__sec-header">
        <h3 className="sam-dashboard__sec-title">Recent Meetings</h3>
        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
          {meetings.length} sessions recorded
        </span>
      </div>

      {meetings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {meetings.map((m) => (
            <MeetingCard
              key={m.roomCode}
              meeting={m}
              onJoin={onJoinMeeting}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 'var(--lm-radius-lg)',
            border: '1px solid var(--lm-border)',
            backgroundColor: 'var(--lm-bg-surface)',
            padding: '40px 16px',
          }}
        >
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
