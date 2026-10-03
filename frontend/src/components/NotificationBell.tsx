import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Pill, Calendar, FlaskConical, FileText, Info , DollarSign } from 'lucide-react';
import { notificationsApi, NotificationItem } from '../services/notificationsApi';
import { useNotificationSocket } from '../hooks/useNotificationSocket';

const DEFAULT_ICON = { Icon: Info, bg: 'bg-clinical-400', fg: 'text-white' };

// Partial<> so an unrecognized type from the backend can never crash this
// component — see the fallback lookup below.
const TYPE_ICON: Partial<Record<NotificationItem['type'], { Icon: typeof Bell; bg: string; fg: string }>> = {
  prescription: { Icon: Pill, bg: 'bg-green-500', fg: 'text-white' },
  appointment: { Icon: Calendar, bg: 'bg-primary-500', fg: 'text-white' },
  lab_result: { Icon: FlaskConical, bg: 'bg-amber-500', fg: 'text-white' },
  invoice: { Icon: FileText, bg: 'bg-primary-500', fg: 'text-white' },
  expense: { Icon: DollarSign, bg: 'bg-orange-500', fg: 'text-white' },
  system: { Icon: Info, bg: 'bg-clinical-400', fg: 'text-white' },
};

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Stored photos are server-relative paths like /uploads/...; the app runs on a different
// origin (Vite), so point them at the API server. Falls back to initials if the image fails.
const PHOTO_BASE = '';
function photoSrc(u?: string | null) {
  if (!u) return null;
  if (/^(https?:|data:|blob:)/.test(u)) return u;
  return `${PHOTO_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

function ActorAvatar({
  url,
  name,
  onClick,
  sizeClass = 'w-[38px] h-[38px]',
  textClass = 'text-xs',
}: {
  url?: string | null;
  name?: string;
  onClick?: (e: { stopPropagation: () => void; currentTarget: Element }) => void;
  sizeClass?: string;
  textClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(url);
  const inner =
    src && !failed ? (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover block`}
      />
    ) : (
      <div className={`${sizeClass} rounded-full bg-primary-100 flex items-center justify-center ${textClass} font-medium text-primary-700`}>
        {initials(name)}
      </div>
    );
  if (!onClick) return inner;
  return (
    <div
      onClick={onClick}
      title="View profile"
      className="cursor-pointer rounded-full hover:ring-2 hover:ring-primary-300 transition"
    >
      {inner}
    </div>
  );
}

interface ProfileCardData {
  name: string;
  position: string | null;
  department: string | null;
  photo: string | null;
  left: number;
  top: number;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface NotificationBellProps {
  currentUserId?: string;
  onNavigate?: (link: string) => void;
}

export function NotificationBell({ currentUserId, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<ProfileCardData | null>(null);

  useEffect(() => {
    if (!open) setCard(null);
  }, [open]);

  useEffect(() => {
    if (!currentUserId) return;
    notificationsApi.unreadCount(currentUserId).then((r) => setUnreadCount(r.unreadCount)).catch(() => {});
  }, [currentUserId]);

  useNotificationSocket(currentUserId, (n) => {
    setItems((prev) => [n, ...prev]);
    setUnreadCount((c) => c + 1);
  });

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      if (!currentUserId) return;
      const res = await notificationsApi.list(currentUserId, { limit: 20 });
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setLoaded(true);
    } catch {
      // swallow — dropdown just shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !loaded) loadFeed();
  }, [open, loaded, loadFeed]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function showActorCard(e: { stopPropagation: () => void; currentTarget: Element }, item: NotificationItem) {
    e.stopPropagation(); // don't trigger the notification's own click
    const r = e.currentTarget.getBoundingClientRect();
    const actor = (item as any).meta?.actor ?? {};
    const W = 272;
    setCard({
      name: actor.name || item.actorName || 'Unknown',
      position: actor.position ?? null,
      department: actor.department ?? null,
      photo: item.actorAvatarUrl ?? null,
      left: Math.max(8, r.left - W - 12),
      top: Math.min(Math.max(8, r.top - 8), Math.max(8, window.innerHeight - 230)),
    });
  }

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
      if (currentUserId) notificationsApi.markRead(currentUserId, item.id).catch(() => {});
    }
    if (item.link && onNavigate) onNavigate(item.link);
    setOpen(false);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    if (currentUserId) notificationsApi.markAllRead(currentUserId).catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 hover:bg-clinical-100 rounded-lg transition-colors"
      >
        <Bell size={18} className="text-clinical-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[360px] max-h-[480px] overflow-y-auto bg-white rounded-lg shadow-lg border border-clinical-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-clinical-200">
            <span className="font-semibold text-sm text-clinical-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:text-primary-700">
                Mark all as read
              </button>
            )}
          </div>

          {loading && <div className="p-6 text-center text-sm text-clinical-400">Loading…</div>}

          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-sm text-clinical-400">You're all caught up</div>
          )}

          {!loading &&
            items.map((item) => {
              const { Icon, bg, fg } = TYPE_ICON[item.type] ?? DEFAULT_ICON;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`flex gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-clinical-50 transition-colors ${
                    item.read ? '' : 'bg-primary-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <ActorAvatar url={item.actorAvatarUrl} name={item.actorName} onClick={(e) => showActorCard(e, item)} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                      <Icon size={9} className={fg} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13px] text-clinical-800">
                      {item.actorName && <span className="font-medium">{item.actorName} </span>}
                      <span className="text-clinical-600">{item.message}</span>
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-clinical-400">{timeAgo(item.createdAt)}</p>
                  </div>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />}
                </div>
              );
            })}
        </div>
      )}
      {card && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setCard(null)} />
          <div
            className="fixed z-[60] w-[272px] rounded-xl bg-white shadow-xl border border-clinical-200 overflow-hidden"
            style={{ left: card.left, top: card.top }}
          >
            <div className="h-14 bg-primary-600" />
            <div className="px-4 pb-4 -mt-8">
              <div className="inline-block rounded-full border-4 border-white bg-white">
                <ActorAvatar url={card.photo} name={card.name} sizeClass="w-16 h-16" textClass="text-lg" />
              </div>
              <p className="m-0 mt-2 text-sm font-semibold text-clinical-900">{card.name}</p>
              <div className="mt-3 space-y-2 text-[13px]">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-clinical-400">Job title</div>
                  <div className="text-clinical-800">{card.position || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-clinical-400">Department</div>
                  <div className="text-clinical-800">{card.department || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
