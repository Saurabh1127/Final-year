import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '../components/ui';
import { AuthLayout } from '../components/Auth/AuthLayout';

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
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong password to protect your account."
      footerPrompt="Remembered your password?"
      footerLinkText="Back to sign in"
      footerLinkTo="/login"
      tag="Account Security"
      headline="Protected Multilingual Workspace"
      description="Your credentials encrypt access to your real-time translation sessions and meeting summaries."
    >
      <form className="sam-auth-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="p-3 text-sm rounded-lg bg-[rgba(239,107,115,0.12)] border border-[rgba(239,107,115,0.3)] text-[var(--color-status-error,#EF6B73)]" role="alert">
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
              <path d="m9 12 2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
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
    </AuthLayout>
  );
}

export default ResetPassword;
