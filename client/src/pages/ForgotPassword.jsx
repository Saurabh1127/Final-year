import React, { useState } from 'react';
import { Button, Input, useToast } from '../components/ui';
import { AuthLayout } from '../components/Auth/AuthLayout';

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
    <AuthLayout
      title="Reset password"
      subtitle="Enter your account email and we'll send you recovery instructions."
      footerPrompt="Remembered your password?"
      footerLinkText="Back to sign in"
      footerLinkTo="/login"
      tag="Security & Recovery"
      headline="Protected Access to Your Workspace"
      description="Zero-trust access safeguards your conversations, meeting transcripts, and translated audio streams."
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-primary, #F2F0EA)', marginBottom: 8 }}>
            Check your inbox
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #A7B0BD)', marginBottom: 24, lineHeight: 1.5 }}>
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
            Send recovery link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ForgotPassword;
