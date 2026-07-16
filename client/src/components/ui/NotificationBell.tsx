import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../services/api.js';

// Header bell: shows order status updates (confirmed / shipped / cancelled…)
// with an unread badge. Opening the dropdown marks everything as read.

interface NotificationDoc {
  _id: string;
  orderId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const POLL_MS = 20_000;

const timeAgo = (iso: string): string => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationDoc[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setItems(res.data.data);
        setUnread(res.data.meta?.unreadCount ?? 0);
      }
    } catch {
      // Bell is best-effort; never surface errors for it
    }
  }, []);

  // Initial load + light polling so the badge stays fresh while browsing
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_MS);

    // Refetch the moment the tab regains focus/visibility, so a status change
    // made elsewhere (e.g. staff advancing an order in another tab) shows up
    // immediately instead of waiting for the next poll or a manual refresh.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchNotifications);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      try {
        await api.patch('/notifications/read-all');
      } catch {
        // Non-fatal — the server will still show them unread next session
      }
    }
  };

  const openNotification = (n: NotificationDoc) => {
    setOpen(false);
    if (n.orderId) navigate(`/orders/${n.orderId}`);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="p-2 text-text-secondary hover:text-primary hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center relative"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none select-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -right-20 sm:right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-text-disabled rounded-dropdown shadow-level2 z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-dashboard-section-bg bg-background text-caption font-bold text-text-secondary uppercase tracking-wider select-none">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No notifications yet.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-dashboard-section-bg">
              {items.map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => openNotification(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-dashboard-section-bg transition-colors ${
                      n.isRead ? '' : 'bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary leading-snug">
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-text-muted mt-1 block">
                      {timeAgo(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
