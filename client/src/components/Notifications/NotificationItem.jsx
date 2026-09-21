import React from 'react';

/**
 * NotificationItem
 * Renders an individual notification inside the NotificationCenter dropdown.
 */
export function NotificationItem({
  notification,
  onMarkRead,
  onSelect,
}) {
  if (!notification) return null;

  const { id, title, description, time, read, type } = notification;

  const getIcon = () => {
    switch (type) {
      case 'meeting':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00D4B2' }}>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        );
      case 'translation':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#38BDF8' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        );
      default:
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#F59E0B' }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`sam-notification-item ${!read ? 'sam-notification-item--unread' : ''}`}
      onClick={() => {
        onMarkRead?.(id);
        onSelect?.(notification);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onMarkRead?.(id);
          onSelect?.(notification);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${title} notification: ${description}`}
    >
      <div className="sam-notification-item__icon-wrap">
        {getIcon()}
      </div>

      <div className="sam-notification-item__content">
        <div className="sam-notification-item__title-row">
          <span className="sam-notification-item__title">{title}</span>
          {!read && <span className="sam-notification-item__dot" />}
        </div>
        <p className="sam-notification-item__desc">{description}</p>
        <span className="sam-notification-item__time">{time}</span>
      </div>
    </div>
  );
}

export default NotificationItem;
