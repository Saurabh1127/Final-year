import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

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
      await api.get(`/meetings/${joinCode.trim()}`);
      navigate(`/meeting/${joinCode.trim()}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Meeting not found. Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#090a0f] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00d4b2]/[0.05] rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-48 w-96 h-96 bg-[#38bdf8]/[0.03] rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-[#090a0f]/85 border-b border-white/[0.08] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00d4b2]/10 border border-[#00d4b2]/20 flex items-center justify-center text-[#00d4b2]">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                <path d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="16" r="3" fill="currentColor" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">SAMVADA</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-white/[0.03] text-slate-300 border border-white/[0.06]">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`}></span>
              {connected ? 'Network Online' : 'Connecting…'}
            </div>

            <div className="flex items-center gap-2.5 pl-2 sm:border-l border-white/[0.08]">
              <div className="w-8 h-8 rounded-full bg-[#00d4b2]/15 border border-[#00d4b2]/30 text-[#00d4b2] flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-200 hidden md:inline">{user?.name}</span>
            </div>

            <button
              onClick={logout}
              id="logout-btn"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 md:py-20 relative z-10">
        <div className="max-w-4xl w-full text-center animate-slide-up">
          {/* Hero */}
          <div className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Next-generation video meetings.
            </h1>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mt-2 bg-gradient-to-r from-white via-slate-200 to-[#00d4b2] bg-clip-text text-transparent leading-tight">
              Spoken live in any language.
            </h2>
            <p className="mt-5 text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Speak your native language. Everyone understands. Real-time neural speech-to-speech
              translation and subtitles embedded directly into your video call.
            </p>
          </div>

          {/* Action Row */}
          <div className="my-10 sm:my-12 max-w-2xl mx-auto w-full">
            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-medium animate-fade-in text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-2xl bg-[#12151e]/60 border border-white/[0.08] backdrop-blur-xl">
              <button
                onClick={handleCreateMeeting}
                disabled={creating}
                id="create-meeting-btn"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00d4b2] hover:bg-[#33e0c4] text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#00d4b2]/20 transition active:scale-[0.99] disabled:opacity-50 whitespace-nowrap"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {creating ? 'Creating Room…' : 'Start New Meeting'}
              </button>

              <div className="hidden sm:block text-xs uppercase font-bold text-slate-500 px-1 tracking-wider">
                or
              </div>

              <form onSubmit={handleJoinMeeting} className="w-full sm:w-auto flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter meeting code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  id="join-code-input"
                  className="flex-1 sm:w-56 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00d4b2] focus:ring-1 focus:ring-[#00d4b2] text-sm transition"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim() || joining}
                  id="join-meeting-btn"
                  className="px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold text-sm transition disabled:opacity-50 whitespace-nowrap"
                >
                  {joining ? 'Joining…' : 'Join'}
                </button>
              </form>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-[#12151e]/60 border border-white/[0.08] hover:border-[#00d4b2]/40 transition duration-300 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-xl bg-[#00d4b2]/10 border border-[#00d4b2]/20 flex items-center justify-center mb-4 text-[#00d4b2]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-[#00d4b2] transition">
                Live Speech Translation
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Hear translated speech and read accurate subtitles synthesized in your preferred native language.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#12151e]/60 border border-white/[0.08] hover:border-[#00d4b2]/40 transition duration-300 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/20 flex items-center justify-center mb-4 text-[#38bdf8]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-[#38bdf8] transition">
                Under 2s Latency
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Accelerated Whisper ASR + NLLB-200 pipeline with client-side VAD ensures conversational tempo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#12151e]/60 border border-white/[0.08] hover:border-[#10b981]/40 transition duration-300 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center mb-4 text-[#10b981]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-[#10b981] transition">
                P2P Encrypted Audio
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Direct WebRTC peer-to-peer transport with intelligent audio ducking to prevent acoustic collision.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
