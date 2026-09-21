import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeviceSelector } from './DeviceSelector';
import { AudioVisualizer } from './AudioVisualizer';
import LanguageSelector from './LanguageSelector';
import './PreJoinScreen.css';

/**
 * PreJoinScreen
 * Professional pre-meeting lobby screen matching the Samvada design system.
 * Features:
 * - 60/40 Split layout: Video preview + Hardware/Language settings
 * - Real-time camera mirror toggle & device selectors (camera/mic)
 * - AudioVisualizer with Web Audio API level meter & speaker test chime
 * - Dual language configuration (Spoken / Target Translation)
 * - Preference persistence & responsive mobile stacking
 */
export function PreJoinScreen({
  roomCode,
  userName = 'Guest',
  localStream,
  isMuted = false,
  isVideoOff = false,
  toggleMute,
  toggleVideo,
  onJoin,
  sourceLanguage,
  setSourceLanguage,
  targetLanguage,
  setTargetLanguage,
}) {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [isJoining, setIsJoining] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Local or propagated language state
  const [internalSourceLang, setInternalSourceLang] = useState(() => {
    return localStorage.getItem('samvada_spoken_lang') || sourceLanguage || 'auto';
  });
  const [internalTargetLang, setInternalTargetLang] = useState(() => {
    return localStorage.getItem('samvada_target_lang') || targetLanguage || 'hi';
  });
  const [rememberSettings, setRememberSettings] = useState(true);

  // Synchronize internal and external language state
  const activeSourceLang = sourceLanguage !== undefined ? sourceLanguage : internalSourceLang;
  const activeTargetLang = targetLanguage !== undefined ? targetLanguage : internalTargetLang;

  const handleSourceLangChange = (lang) => {
    setInternalSourceLang(lang);
    if (setSourceLanguage) setSourceLanguage(lang);
  };

  const handleTargetLangChange = (lang) => {
    setInternalTargetLang(lang);
    if (setTargetLanguage) setTargetLanguage(lang);
  };

  // Video element stream attachment
  const hasVideo = localStream && !isVideoOff;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && localStream) {
      videoEl.srcObject = localStream;
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [localStream, hasVideo]);

  // Dynamic Camera Hardware Switcher
  const handleCameraChange = useCallback(async (deviceId) => {
    setSelectedCameraId(deviceId);
    if (!localStream || isVideoOff || !deviceId) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = localStream.getVideoTracks()[0];
      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStream.addTrack(newTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = localStream;
      }
    } catch (err) {
      console.warn('Could not switch camera device:', err);
    }
  }, [localStream, isVideoOff]);

  // Dynamic Microphone Hardware Switcher
  const handleMicChange = useCallback(async (deviceId) => {
    setSelectedMicId(deviceId);
    if (!localStream || !deviceId) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getAudioTracks()[0];
      const oldTrack = localStream.getAudioTracks()[0];
      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStream.addTrack(newTrack);
    } catch (err) {
      console.warn('Could not switch microphone device:', err);
    }
  }, [localStream]);

  // Copy meeting code
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  // Join meeting handler
  const handleJoin = () => {
    if (isJoining || !localStream) return;
    setIsJoining(true);

    if (rememberSettings) {
      localStorage.setItem('samvada_spoken_lang', activeSourceLang);
      localStorage.setItem('samvada_target_lang', activeTargetLang);
    }

    onJoin();
  };

  return (
    <div className="sam-prejoin">
      {/* Background ambient lighting */}
      <div className="sam-prejoin__ambient" aria-hidden="true">
        <div className="sam-prejoin__glow-1" />
        <div className="sam-prejoin__glow-2" />
      </div>

      {/* ── Top Bar ── */}
      <header className="sam-prejoin__topbar">
        <div className="sam-prejoin__brand">
          <div className="sam-prejoin__logo-icon">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
              <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
            </svg>
          </div>
          <span className="sam-prejoin__brand-text">SAMVADA</span>
        </div>

        <div className="sam-prejoin__topbar-right">
          <button
            type="button"
            onClick={handleCopyCode}
            className="sam-prejoin__room-pill"
            title="Click to copy room code"
          >
            <span>Meeting:</span>
            <strong>{roomCode}</strong>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {copiedCode ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main 2-Column Grid ── */}
      <main className="sam-prejoin__container">
        {/* ── Left Column: Video Preview ── */}
        <div className="sam-prejoin__preview-col">
          <div className="sam-prejoin__video-frame">
            {/* Top floating badges */}
            <div className="sam-prejoin__video-top-badges">
              <div className="sam-prejoin__badge-pill sam-prejoin__badge-pill--preview">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00D4B2' }} />
                <span>Camera Preview</span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {isMuted && (
                  <div className="sam-prejoin__badge-pill sam-prejoin__badge-pill--warning">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    </svg>
                    <span>Muted</span>
                  </div>
                )}
                {isVideoOff && (
                  <div className="sam-prejoin__badge-pill sam-prejoin__badge-pill--cam-off">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <span>Camera Off</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video or Cam-Off State */}
            {hasVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`sam-prejoin__video-el ${isMirrored ? 'sam-prejoin__video-el--mirrored' : ''}`}
              />
            ) : (
              <div className="sam-prejoin__cam-off-state">
                <div className="sam-prejoin__cam-off-avatar">
                  {userName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h4 className="sam-prejoin__cam-off-title">{userName}</h4>
                  <p className="sam-prejoin__cam-off-sub">Camera is currently disabled</p>
                </div>
              </div>
            )}

            {/* Floating bottom overlay controls */}
            <div className="sam-prejoin__preview-controls">
              {/* Mic Toggle Button */}
              <button
                type="button"
                className={`sam-prejoin__ctrl-btn ${isMuted ? 'sam-prejoin__ctrl-btn--muted' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                id="prejoin-mic-btn"
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Camera Toggle Button */}
              <button
                type="button"
                className={`sam-prejoin__ctrl-btn ${isVideoOff ? 'sam-prejoin__ctrl-btn--off' : ''}`}
                onClick={toggleVideo}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                id="prejoin-cam-btn"
                aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Mirror & Quality Note */}
          <div className="sam-prejoin__preview-note">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
              WebRTC HD Stream Ready
            </span>

            <button
              type="button"
              className="sam-prejoin__mirror-toggle"
              onClick={() => setIsMirrored((prev) => !prev)}
              title="Flip camera preview horizontally"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span>{isMirrored ? 'Mirrored' : 'Natural'}</span>
            </button>
          </div>
        </div>

        {/* ── Right Column: Settings Panel ── */}
        <div className="sam-prejoin__settings-card">
          <div className="sam-prejoin__card-header">
            <h2 className="sam-prejoin__card-title">Ready to join?</h2>
            <p className="sam-prejoin__card-sub">
              Verify your devices and real-time translation settings before joining the room.
            </p>
          </div>

          <div className="sam-prejoin__section-divider" />

          {/* 1. Device Selectors */}
          <div className="sam-prejoin__section">
            <h3 className="sam-prejoin__section-title">Hardware Devices</h3>

            <DeviceSelector
              kind="videoinput"
              label="Camera"
              selectedDeviceId={selectedCameraId}
              onSelectDevice={handleCameraChange}
              disabled={isVideoOff}
            />

            <DeviceSelector
              kind="audioinput"
              label="Microphone"
              selectedDeviceId={selectedMicId}
              onSelectDevice={handleMicChange}
            />
          </div>

          {/* 2. Audio Visualizer */}
          <div className="sam-prejoin__section">
            <h3 className="sam-prejoin__section-title">Audio Diagnostics</h3>
            <AudioVisualizer
              stream={localStream}
              isMuted={isMuted}
              barCount={22}
            />
          </div>

          {/* 3. Language Configuration */}
          <div className="sam-prejoin__section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="sam-prejoin__section-title">AI Translation Pipeline</h3>
              <span style={{ fontSize: '0.6875rem', color: '#00D4B2', fontWeight: 600 }}>NLLB-200 Active</span>
            </div>

            <div className="sam-prejoin__lang-grid">
              <LanguageSelector
                currentLanguage={activeSourceLang}
                onChange={handleSourceLangChange}
                label="I will speak in"
                includeAuto={true}
                fullWidth={true}
              />

              <LanguageSelector
                currentLanguage={activeTargetLang}
                onChange={handleTargetLangChange}
                label="Translate others to"
                includeAuto={false}
                fullWidth={true}
              />
            </div>
          </div>

          {/* 4. Remember Settings Checkbox */}
          <label className="sam-prejoin__remember-row">
            <input
              type="checkbox"
              className="sam-prejoin__checkbox"
              checked={rememberSettings}
              onChange={(e) => setRememberSettings(e.target.checked)}
            />
            <span>Remember audio and language preferences for future calls</span>
          </label>

          {/* 5. Actions */}
          <div className="sam-prejoin__actions">
            <button
              type="button"
              className="sam-prejoin__join-btn"
              onClick={handleJoin}
              disabled={!localStream || isJoining}
              id="prejoin-join-btn"
            >
              {isJoining ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                  <span>Connecting to room...</span>
                </>
              ) : !localStream ? (
                <span>Requesting Media Permissions...</span>
              ) : (
                <>
                  <span>Join Meeting</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            <button
              type="button"
              className="sam-prejoin__back-btn"
              onClick={() => navigate('/')}
              id="prejoin-back-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PreJoinScreen;
