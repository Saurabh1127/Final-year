import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, useToast } from '../components/ui';
import './Auth.css';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.info('Password reset feature will be available once mail service is connected.');
    }, 600);
  };

  return (
    <div className="sam-auth-page">
      <div className="sam-auth-ambient" aria-hidden="true">
        <div className="sam-auth-ambient__glow-1" />
        <div className="sam-auth-ambient__glow-2" />
      </div>

      <div className="sam-auth-card">
        {/* Header */}
        <div className="sam-auth-header">
          <Link to="/" className="sam-auth-logo-row">
            <div className="sam-auth-logo-mark">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#00D4B2" strokeWidth="2.5" />
                <path
                  d="M10 16C10 12.5 13 9 16 9C19 9 22 12.5 22 16C22 19.5 19 23 16 23"
                  stroke="#00D4B2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="16" r="3.5" fill="#00D4B2" />
              </svg>
            </div>
            <span className="sam-auth-brand-name">SAMVADA</span>
          </Link>
          <h1 className="sam-auth-title">Reset password</h1>
          <p className="sam-auth-subtitle">
            Enter your account email and we'll send you recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(0, 212, 178, 0.15)',
                border: '1px solid rgba(0, 212, 178, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#00D4B2',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#F8FAFC', marginBottom: 8 }}>
              Check your inbox
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: 24, lineHeight: 1.5 }}>
              If an account matches <strong>{email}</strong>, a secure reset link has been dispatched.
            </p>
            <Button variant="outline" fullWidth onClick={() => setSubmitted(false)}>
              Send again
            </Button>
          </div>
        ) : (
          <form className="sam-auth-form" onSubmit={handleSubmit}>
            <Input
              id="forgot-email"
              type="email"
              label="Account Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Send reset instructions
            </Button>
          </form>
        )}

        {/* Footer */}
        <div className="sam-auth-footer">
          Remember your password?{' '}
          <Link to="/login" className="sam-auth-link">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
