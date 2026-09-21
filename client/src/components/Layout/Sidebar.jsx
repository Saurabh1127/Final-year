import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar, StatusIndicator } from '../ui';
import { SidebarItem } from './SidebarItem';
import NotificationCenter from '../Notifications/NotificationCenter';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/meetings',
    label: 'Meetings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    to: '/transcripts',
    label: 'Transcripts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/**
 * Samvada Sidebar Component
 * Authenticated navigation sidebar with user profile and network status
 */
export function Sidebar({
  collapsed = false,
  onItemClick,
  className = '',
}) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifBtnRef = useRef(null);

  return (
    <aside
      className={`sam-sidebar ${collapsed ? 'sam-sidebar--collapsed' : ''} ${className}`.trim()}
    >
      {/* ── Brand / Header ── */}
      <div className="sam-sidebar__brand">
        <div className="sam-sidebar__logo-mark">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
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

        {!collapsed && (
          <div className="sam-sidebar__brand-text">
            <span className="sam-sidebar__title">SAMVADA</span>
            <div className="sam-sidebar__status-row">
              <StatusIndicator
                status={connected ? 'online' : 'offline'}
                label={connected ? 'Online' : 'Connecting'}
                size="sm"
              />
            </div>
          </div>
        )}

        {!collapsed && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              ref={notifBtnRef}
              type="button"
              className="sam-topbar__notif-btn"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="View notifications"
              title="Notifications"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="sam-topbar__notif-dot" />
            </button>

            <NotificationCenter
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              triggerRef={notifBtnRef}
            />
          </div>
        )}
      </div>

      {/* ── Navigation Items ── */}
      <nav className="sam-sidebar__nav">
        <div className="sam-sidebar__nav-group">
          {!collapsed && <span className="sam-sidebar__section-title">Menu</span>}
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              onClick={onItemClick}
            />
          ))}
        </div>
      </nav>

      {/* ── User Footer ── */}
      <div className="sam-sidebar__footer">
        <div className="sam-sidebar__user-profile">
          <Avatar
            name={user?.name || 'User'}
            size={collapsed ? 'sm' : 'md'}
            status={connected ? 'online' : 'offline'}
          />

          {!collapsed && (
            <div className="sam-sidebar__user-info">
              <span className="sam-sidebar__user-name" title={user?.name}>
                {user?.name || 'User'}
              </span>
              <span className="sam-sidebar__user-email" title={user?.email}>
                {user?.email || ''}
              </span>
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={logout}
              className="sam-sidebar__logout-btn"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
