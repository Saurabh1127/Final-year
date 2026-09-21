import React, { useState } from 'react';
import AccountSettings from '../components/Settings/AccountSettings';
import LanguageSettings from '../components/Settings/LanguageSettings';
import AudioVideoSettings from '../components/Settings/AudioVideoSettings';
import { Button, useToast } from '../components/ui';
import './Settings.css';

/**
 * Settings
 * Comprehensive configuration center for Samvada.
 * Manages user credentials, language translation preferences,
 * audio/video hardware devices, notification triggers, and privacy.
 */
export function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('account');

  // Notification toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [summaryAlerts, setSummaryAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  const tabs = [
    {
      id: 'account',
      label: 'Account',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'language',
      label: 'Language & Speech',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      id: 'audio-video',
      label: 'Audio & Video',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      id: 'privacy',
      label: 'Privacy & Security',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  const handleClearCache = () => {
    localStorage.removeItem('samvada_recent_meetings');
    toast.success('Local meeting history cache cleared.');
  };

  return (
    <div className="sam-settings-page" aria-label="Application settings and preferences">
      <div className="sam-settings-container">
        {/* ── Page Header ── */}
        <header className="sam-settings-header">
          <div className="sam-settings-title-wrap">
            <div className="sam-settings-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h1 className="sam-settings-title">Preferences & Settings</h1>
              <p className="sam-settings-subtitle">
                Customize your account, speech translation models, hardware devices, and security.
              </p>
            </div>
          </div>
        </header>

        {/* ── Navigation Tabs ── */}
        <nav className="sam-settings-nav" aria-label="Settings categories">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`sam-settings-nav-btn ${isActive ? 'sam-settings-nav-btn--active' : ''}`}
                aria-pressed={isActive}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Tab Content ── */}
        <main className="sam-settings-content">
          {activeTab === 'account' && <AccountSettings />}

          {activeTab === 'language' && <LanguageSettings />}

          {activeTab === 'audio-video' && <AudioVideoSettings />}

          {activeTab === 'notifications' && (
            <div className="sam-settings-section" aria-label="Notification preferences">
              <div className="sam-settings-section__header">
                <h3 className="sam-settings-section__title">Notification Preferences</h3>
                <p className="sam-settings-section__desc">
                  Choose how and when Samvada sends meeting notifications and executive summary alerts.
                </p>
              </div>

              <div className="sam-settings-card">
                <div className="sam-settings-form">
                  <label className="sam-summary-action-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      style={{ accentColor: '#00D4B2', width: 16, height: 16 }}
                    />
                    <div>
                      <p className="sam-settings-label" style={{ margin: 0 }}>
                        Meeting Invitation Emails
                      </p>
                      <span className="sam-settings-hint">
                        Receive calendar invites when added to a scheduled meeting.
                      </span>
                    </div>
                  </label>

                  <label className="sam-summary-action-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={summaryAlerts}
                      onChange={(e) => setSummaryAlerts(e.target.checked)}
                      style={{ accentColor: '#00D4B2', width: 16, height: 16 }}
                    />
                    <div>
                      <p className="sam-settings-label" style={{ margin: 0 }}>
                        AI Executive Summary Ready Alerts
                      </p>
                      <span className="sam-settings-hint">
                        Get notified when automated post-call transcripts and briefings are synthesized.
                      </span>
                    </div>
                  </label>

                  <label className="sam-summary-action-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={soundEffects}
                      onChange={(e) => setSoundEffects(e.target.checked)}
                      style={{ accentColor: '#00D4B2', width: 16, height: 16 }}
                    />
                    <div>
                      <p className="sam-settings-label" style={{ margin: 0 }}>
                        In-Call Audio Sound Effects
                      </p>
                      <span className="sam-settings-hint">
                        Play subtle chimes when participants join, leave, or enable speech translation.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="sam-settings-section" aria-label="Privacy and security settings">
              <div className="sam-settings-section__header">
                <h3 className="sam-settings-section__title">Privacy & Encryption</h3>
                <p className="sam-settings-section__desc">
                  Samvada implements end-to-end encryption across all WebRTC streams and voice pipelines.
                </p>
              </div>

              <div className="sam-settings-card">
                <h4 className="sam-settings-card__title">Data Transmission & Retention</h4>
                <p className="sam-settings-card__desc">
                  Raw audio frames captured by your browser are processed through Whisper ASR and immediately discarded after translation generation.
                </p>

                <div className="sam-settings-pipeline-list">
                  <div className="sam-settings-pipeline-item">
                    <div className="sam-settings-pipeline-item__left">
                      <span className="sam-settings-pipeline-role">Media Transport</span>
                      <span className="sam-settings-pipeline-model">WebRTC DTLS / SRTP Encryption</span>
                    </div>
                    <span className="sam-settings-pipeline-status">
                      <span className="sam-settings-pipeline-dot" />
                      Active
                    </span>
                  </div>

                  <div className="sam-settings-pipeline-item">
                    <div className="sam-settings-pipeline-item__left">
                      <span className="sam-settings-pipeline-role">Speech Pipeline</span>
                      <span className="sam-settings-pipeline-model">Ephemeral Audio Memory Buffering</span>
                    </div>
                    <span className="sam-settings-pipeline-status">
                      <span className="sam-settings-pipeline-dot" />
                      Protected
                    </span>
                  </div>
                </div>

                <div style={{ paddingTop: '10px' }}>
                  <Button variant="outline" size="sm" onClick={handleClearCache}>
                    Clear Local Cache & Session Storage
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Settings;
