import React, { useState, useEffect, useRef } from 'react';
import NotificationItem from './NotificationItem';
import './NotificationCenter.css';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'n-1',
    title: 'AI Meeting Briefing Ready',
    description: 'Executive summary and action items generated for meeting #global-sync.',
    time: '12m ago',
    read: false,
    type: 'meeting',
  },
  {
    id: 'n-2',
    title: 'New Translation Target Added',
    description: 'Tamil and Telugu are now calibrated for Whisper ASR & Edge-TTS synthesis.',
    time: '2h ago',
    read: false,
    type: 'translation',
  },
  {
    id: 'n-3',
    title: 'Hardware Access Verified',
    description: 'Default microphone and camera calibrated with echo cancellation.',
    time: '1d ago',
    read: true,
    type: 'system',
  },
  {
    id: 'n-4',
    title: 'Welcome to Samvada',
    description: 'Break language barriers with real-time speech-to-speech translation.',
    time: '2d ago',
    read: true,
    type: 'system',
  },
];

/**
 * NotificationCenter
 * Dropdown panel displaying user notifications, AI summary alerts,
 * and system updates.
 */
export function NotificationCenter({
  isOpen = false,
  onClose,
  triggerRef,
}) {
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        (!triggerRef?.current || !triggerRef.current.contains(e.target))
      ) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="sam-notification-center"
      role="region"
      aria-label="Notifications panel"
    >
      {/* ── Dropdown Header ── */}
      <div className="sam-notification-center__header">
        <div className="sam-notification-center__title-row">
          <h4 className="sam-notification-center__title">Notifications</h4>
          {unreadCount > 0 && (
            <span className="sam-notification-center__unread-badge">
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="sam-notification-center__action-btn"
            onClick={markAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* ── Notifications List ── */}
      <div className="sam-notification-center__list">
        {notifications.length === 0 ? (
          <div className="sam-notification-center__empty">
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              onMarkRead={markRead}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
