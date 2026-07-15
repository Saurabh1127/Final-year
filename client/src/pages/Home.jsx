import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import './Home.css';

const Home = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateMeeting = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await api.post('/meetings', { title: `${user.name}'s Meeting` });
      navigate(`/meeting/${res.data.roomCode}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError('');
    setJoining(true);
    try {
      // Verify meeting exists
      await api.get(`/meetings/${joinCode.trim()}`);
      navigate(`/meeting/${joinCode.trim()}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Meeting not found. Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="home-page">
      {/* Navbar */}
      <nav className="home-nav">
        <div className="nav-left">
          <div className="nav-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="var(--color-accent)" strokeWidth="2" />
              <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="3" fill="var(--color-accent)" />
            </svg>
            <span>LinguaMeet</span>
          </div>
        </div>
        <div className="nav-right">
          <div className={`connection-status ${connected ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {connected ? 'Connected' : 'Connecting...'}
          </div>
          <div className="user-info">
            <span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase()}</span>
            <span className="user-name">{user?.name}</span>
          </div>
          <button className="btn btn-secondary" onClick={logout} id="logout-btn">
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="home-main">
        <div className="home-content animate-slide-up">
          <div className="home-hero">
            <h1>Premium video meetings.</h1>
            <h1 className="hero-gradient">Now with live translation.</h1>
            <p className="hero-desc">
              Speak your language. Everyone understands. Real-time translated subtitles
              that break language barriers in your meetings.
            </p>
          </div>

          <div className="home-actions">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="action-row">
              <button
                className="btn btn-primary btn-lg new-meeting-btn"
                onClick={handleCreateMeeting}
                disabled={creating}
                id="create-meeting-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {creating ? 'Creating...' : 'New meeting'}
              </button>

              <div className="action-divider">
                <span>or</span>
              </div>

              <form className="join-form" onSubmit={handleJoinMeeting}>
                <input
                  type="text"
                  className="input join-input"
                  placeholder="Enter meeting code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  id="join-code-input"
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={!joinCode.trim() || joining}
                  id="join-meeting-btn"
                >
                  {joining ? 'Joining...' : 'Join'}
                </button>
              </form>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="home-features">
            <div className="feature-card">
              <div className="feature-icon">🌐</div>
              <h3>Real-time Translation</h3>
              <p>See subtitles in your language as others speak</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎤</div>
              <h3>Crystal Clear Audio</h3>
              <p>WebRTC peer-to-peer audio for low latency</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Under 2s Latency</h3>
              <p>Near-instant speech recognition and translation</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
