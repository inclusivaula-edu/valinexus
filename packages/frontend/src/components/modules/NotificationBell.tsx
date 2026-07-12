import React, { useState, useEffect, useRef, useCallback } from 'react';
import { appNotificationsApi, AppNotification } from '../../services/app-notifications';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const count = await appNotificationsApi.unreadCount();
      setUnreadCount(count);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const data = await appNotificationsApi.list();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch { /* silent */ }
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    await appNotificationsApi.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function handleMarkRead(id: string) {
    await appNotificationsApi.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  const typeIcon: Record<string, string> = {
    warning: '⚠️', danger: '🚨', success: '✅', info: '📋',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '20px', position: 'relative', padding: '6px',
          borderRadius: '8px', lineHeight: 1,
        }}
        title="Notificações"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: '#ef4444', color: '#fff', fontSize: '10px',
            fontWeight: 700, borderRadius: '50%', minWidth: '16px',
            height: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          width: '340px', maxHeight: '420px', overflowY: 'auto',
          background: '#060d08', border: '1px solid #1a5c28',
          borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.5)',
          zIndex: 300,
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #0d2e14',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2f0e8' }}>
              Notificações
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none', border: 'none', color: '#4ade80',
                  fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#3d6b4a', fontSize: '13px' }}>
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#3d6b4a', fontSize: '13px' }}>
              Nenhuma notificação
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.readAt && handleMarkRead(n.id)}
                style={{
                  padding: '10px 16px', borderBottom: '1px solid #0d2e14',
                  background: n.readAt ? 'transparent' : 'rgba(16,185,129,0.04)',
                  cursor: n.readAt ? 'default' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{typeIcon[n.type] ?? '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: n.readAt ? '#4a7a54' : '#e2f0e8' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#3d6b4a', marginTop: '2px', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '10px', color: '#2a4a30', marginTop: '4px' }}>
                      {new Date(n.createdAt).toLocaleDateString('pt-BR')} {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.readAt && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', flexShrink: 0, marginTop: '4px' }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
