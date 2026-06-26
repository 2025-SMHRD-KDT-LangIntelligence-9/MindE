import { useState, useRef, useEffect } from 'react';

function NotificationDropdown({ items, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = () => { onMarkAllRead?.(); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full hover:bg-slate-200 transition-colors relative"
      >
        <span className="material-symbols-outlined text-slate-600">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error rounded-full border-2 border-slate-100 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white leading-none px-0.5">{unread > 9 ? '9+' : unread}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-outline-variant rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface">알림</span>
              {unread > 0 && (
                <span className="bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-primary font-bold hover:underline">
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/30">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="material-symbols-outlined text-slate-300 text-4xl">notifications_off</span>
                <p className="text-sm text-on-surface-variant">새 알림이 없습니다.</p>
              </div>
            ) : items.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? 'bg-white' : 'bg-primary/3'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.iconBg ?? 'bg-slate-100'}`}>
                  <span className={`material-symbols-outlined text-base ${n.color ?? 'text-slate-500'}`}>{n.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-on-surface">{n.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{n.desc}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
