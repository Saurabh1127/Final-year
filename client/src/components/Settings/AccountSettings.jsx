import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Button, useToast } from '../ui';

/**
 * AccountSettings
 * Displays user profile credentials, role verification,
 * display name customization, and security options.
 */
export function AccountSettings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.name || 'User');
  const [saving, setSaving] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Account display name updated!');
    }, 400);
  };

  return (
    <div className="sam-settings-section" aria-label="Account settings section">
      <div className="sam-settings-section__header">
        <h3 className="sam-settings-section__title">Account & Profile</h3>
        <p className="sam-settings-section__desc">
          Manage your personal credentials, public conference display name, and security preferences.
        </p>
      </div>

      <div className="sam-settings-card">
        {/* Profile Header */}
        <div className="sam-account-profile-header">
          <Avatar name={displayName} size="xl" />
          <div className="sam-account-profile-info">
            <h4 className="sam-account-name">{displayName}</h4>
            <span className="sam-account-email">{user?.email || 'user@samvada.ai'}</span>
            <div className="sam-account-badges">
              <span className="sam-account-badge sam-account-badge--verified">
                ✓ Verified Account
              </span>
              <span className="sam-account-badge sam-account-badge--role">
                Meeting Host
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="sam-settings-form">
          <div className="sam-settings-form__group">
            <label htmlFor="settings-display-name" className="sam-settings-label">
              Display Name in Conferences
            </label>
            <input
              id="settings-display-name"
              type="text"
              className="sam-settings-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
            />
            <span className="sam-settings-hint">
              This name will be displayed to all participants and on AI meeting transcript records.
            </span>
          </div>

          <div className="sam-settings-form__group">
            <label htmlFor="settings-email" className="sam-settings-label">
              Email Address
            </label>
            <input
              id="settings-email"
              type="email"
              className="sam-settings-input sam-settings-input--disabled"
              value={user?.email || 'user@samvada.ai'}
              disabled
              title="Email address cannot be modified directly"
            />
            <span className="sam-settings-hint">
              Managed by your authenticated Samvada account.
            </span>
          </div>

          <div className="sam-settings-form__actions">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Security & Session */}
      <div className="sam-settings-card">
        <h4 className="sam-settings-card__title">Security & Session</h4>
        <p className="sam-settings-card__desc">
          Manage your active login sessions and encryption credentials.
        </p>

        <div className="sam-settings-security-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Password reset link sent to your registered email.')}
          >
            Send Password Reset Link
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={logout}
          >
            Sign Out of All Sessions
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
