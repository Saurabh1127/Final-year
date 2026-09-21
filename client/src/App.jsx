import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/ui';
import AppShell from './components/Layout/AppShell';
import './index.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Meeting from './pages/Meeting';
import SummaryPage from './pages/SummaryPage';
import Transcripts from './pages/Transcripts';
import MeetingHistory from './pages/MeetingHistory';
import Settings from './pages/Settings';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function RootRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090A0F', color: '#94A3B8' }}>
        <p>Loading Samvada...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <AppShell>
        <Dashboard />
      </AppShell>
    );
  }

  return <Landing />;
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'placeholder'}>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <Router>
              <Routes>
                {/* Public Marketing & Auth Routes */}
                <Route path="/" element={<RootRoute />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Fullscreen Meeting Route (No AppShell) */}
                <Route
                  path="/meeting/:roomCode"
                  element={
                    <ProtectedRoute>
                      <Meeting />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meetings"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <MeetingHistory />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transcripts"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Transcripts />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Settings />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/summary/:roomCode"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <SummaryPage />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
