import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar, StatusIndicator } from '../ui';
import NotificationCenter from '../Notifications/NotificationCenter';

/**
 * Samvada Topbar Component (Mobile & Small screens)
 * Sticky header with brand, connection status, notifications bell, user avatar, and hamburger menu button.
 */
export function Topbar({ onOpenMobileMenu }) {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef(null);

  return (
    <header className="sam-topbar">
      <div className="sam-topbar__left">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="sam-topbar__menu-btn"
          aria-label="Open navigation menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="sam-topbar__brand">
          <div className="sam-topbar__logo-mark">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
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
          <span className="sam-topbar__title">SAMVADA</span>
        </div>
      </div>

      <div className="sam-topbar__right" style={{ position: 'relative' }}>
        {/* Notifications Dropdown Trigger */}
        <button
          ref={bellRef}
          type="button"
          className="sam-topbar__notif-btn"
          onClick={() => setNotificationsOpen((prev) => !prev)}
          aria-label="View notifications"
          title="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="sam-topbar__notif-dot" />
        </button>

        <NotificationCenter
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          triggerRef={bellRef}
        />

        <StatusIndicator
          status={connected ? 'online' : 'offline'}
          size="sm"
          pulse={connected}
        />
        <Avatar
          name={user?.name || 'User'}
          size="sm"
          status={connected ? 'online' : 'offline'}
        />
      </div>
    </header>
  );
}

export default Topbar;
