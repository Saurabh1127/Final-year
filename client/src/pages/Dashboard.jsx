import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Button, Badge, Card, useToast } from '../components/ui';
import { QuickActionCard } from '../components/Dashboard/QuickActionCard';
import { RecentMeetings } from '../components/Dashboard/RecentMeetings';
import { LanguagePreferencesCard } from '../components/Dashboard/LanguagePreferencesCard';
import { CreateMeetingModal } from '../components/Dashboard/CreateMeetingModal';
import { JoinMeetingModal } from '../components/Dashboard/JoinMeetingModal';
import './Dashboard.css';

function getGreeting(name = 'there') {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name} ☀️`;
  if (hour < 18) return `Good afternoon, ${name} 🌤️`;
  return `Good evening, ${name} 🌙`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connected } = useSocket();
  const { toast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [spokenLang, setSpokenLang] = useState('Hindi (हिन्दी)');
  const [targetLang, setTargetLang] = useState('English');

  const greeting = getGreeting(user?.name ? user.name.split(' ')[0] : 'there');

  const handleScheduleClick = () => {
    toast.info('Meeting scheduling and calendar sync is coming soon!');
  };

  const handleConfigureLanguages = () => {
    setSpokenLang((prev) => (prev.includes('Hindi') ? 'English' : 'Hindi (हिन्दी)'));
    setTargetLang((prev) => (prev === 'English' ? 'Hindi (हिन्दी)' : 'English'));
    toast.success('Updated default speech and translation preferences!');
  };

  return (
    <div className="sam-dashboard">
      {/* ── Greeting Header ── */}
      <div className="sam-dashboard__header">
        <div className="sam-dashboard__greeting-wrap">
          <h1 className="sam-dashboard__greeting-title">{greeting}</h1>
          <p className="sam-dashboard__greeting-sub">
            Break language barriers. Build seamless global connections.
          </p>
        </div>

        <div className="sam-dashboard__header-actions">
          <Badge variant={connected ? 'mint' : 'amber'} size="md" dot pulse={connected}>
            {connected ? 'Realtime Engine Active' : 'Connecting Engine...'}
          </Badge>

          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateModalOpen(true)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            New Meeting
          </Button>
        </div>
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="sam-dashboard__quick-actions">
        <QuickActionCard
          title="Start Instant Meeting"
          description="Create a secure room with dual-stream real-time translation enabled."
          variant="mint"
          actionText="Create Room"
          onClick={() => setCreateModalOpen(true)}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
        />

        <QuickActionCard
          title="Join a Meeting"
          description="Enter a room code or invitation token to join an ongoing conversation."
          variant="blue"
          actionText="Enter Code"
          onClick={() => setJoinModalOpen(true)}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          }
        />

        <QuickActionCard
          title="Schedule for Later"
          description="Plan calendar invitations with preset participant language requirements."
          variant="muted"
          badge="Soon"
          disabled
          onClick={handleScheduleClick}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
      </div>

      {/* ── Main Layout: Recent Meetings + Side Cards ── */}
      <div className="sam-dashboard__grid">
        {/* Left Column: Recent Meetings */}
        <div>
          <RecentMeetings
            meetings={[]}
            onJoinMeeting={(code) => navigate(`/meeting/${code}`)}
            onCreateClick={() => setCreateModalOpen(true)}
          />
        </div>

        {/* Right Column: Language Preferences & Pipeline Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <LanguagePreferencesCard
            spokenLanguage={spokenLang}
            preferredLanguage={targetLang}
            onEdit={handleConfigureLanguages}
          />

          {/* AI Pipeline Health Card */}
          <Card variant="surface" padding="none" className="sam-telemetry-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#FFFFFF' }}>
                AI Engine Telemetry
              </h4>
              <Badge variant="blue" size="sm">
                v2.4 Neural
              </Badge>
            </div>

            <div className="sam-telemetry-item">
              <span>Speech Recognition (ASR)</span>
              <span style={{ color: '#34D399', fontWeight: 600 }}>Whisper v3 Turbo</span>
            </div>
            <div className="sam-telemetry-item">
              <span>Machine Translation (NMT)</span>
              <span style={{ color: '#34D399', fontWeight: 600 }}>NLLB-200 Distilled</span>
            </div>
            <div className="sam-telemetry-item">
              <span>Voice Activity Detector (VAD)</span>
              <span style={{ color: '#00D4B2', fontWeight: 600 }}>AudioWorklet (Client)</span>
            </div>
            <div className="sam-telemetry-item">
              <span>Audio Ducking Level</span>
              <span style={{ color: '#38BDF8', fontWeight: 600 }}>-18 dB Attenuation</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Modals ── */}
      <CreateMeetingModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultTitle={`${user?.name || 'User'}'s Meeting`}
      />

      <JoinMeetingModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />
    </div>
  );
}

export default Dashboard;
