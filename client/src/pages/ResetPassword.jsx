import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '../components/ui';
import './Auth.css';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Password updated successfully! Please sign in with your new credentials.');
      navigate('/login');
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
          <h1 className="sam-auth-title">Set new password</h1>
          <p className="sam-auth-subtitle">
            Choose a strong password to protect your account.
          </p>
        </div>

        {/* Form */}
        <form className="sam-auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <Input
            id="reset-password"
            type="password"
            label="New Password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            showPasswordToggle
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />

          <Input
            id="reset-confirm-password"
            type="password"
            label="Confirm New Password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            showPasswordToggle
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
            Update password
          </Button>
        </form>

        {/* Footer */}
        <div className="sam-auth-footer">
          <Link to="/login" className="sam-auth-link">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
