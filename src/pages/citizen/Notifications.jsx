import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { useApp } from '../../store/AppContext';
import EmptyState from '../../components/EmptyState';

const TABS = [
  { key: 'all',    label: '전체' },
  { key: 'unread', label: '읽지 않음' },
  { key: 'read',   label: '읽음' },
];

const timeToGroup = (time) => {
  if (!time) return '이전';
  if (time.includes('방금') || time.includes('분') || time.includes('시간')) return '오늘';
  if (time === '1일 전') return '어제';
  return '이전';
};

const GROUP_ORDER = ['오늘', '어제', '이전'];

const iconColorMap = {
  'text-emerald-500': { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  'text-amber-500':   { bg: 'bg-amber-50',   text: 'text-amber-500' },
  'text-red-500':     { bg: 'bg-red-50',     text: 'text-red-500' },
  'text-purple-500':  { bg: 'bg-purple-50',  text: 'text-purple-500' },
  'text-primary':     { bg: 'bg-primary/10', text: 'text-primary' },
};

function Notifications() {
  const navigate = useNavigate();
  const { notifications, markAllRead } = useApp();
  const [tab, setTab] = useState('all');

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.read;
    if (tab === 'read')   return n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const grouped = GROUP_ORDER.reduce((acc, group) => {
    const items = filtered.filter((n) => timeToGroup(n.time) === group);
    if (items.length > 0) acc[group] = items;
    return acc;
  }, {});

  return (
    <CitizenLayout pageTitle="알림 센터" activeMenu="notifications">
      <div className="max-w-2xl mx-auto">

        {/* 헤더 */}
        <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden mb-4">
          <div className="px-4 md:px-6 py-3 md:py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">notifications</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">알림 센터</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  총 {notifications.length}건
                  {unreadCount > 0 && (
                    <span className="ml-1.5 text-primary font-bold">· 읽지 않음 {unreadCount}건</span>
                  )}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant border border-outline-variant px-3.5 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                모두 읽음
              </button>
            )}
          </div>

          {/* 필터 탭 */}
          <div className="flex border-t border-outline-variant/60">
            {TABS.map((t) => {
              const count = t.key === 'all'
                ? notifications.length
                : t.key === 'unread'
                ? unreadCount
                : notifications.length - unreadCount;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-all ${
                    tab === t.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 알림 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-outline-variant">
            <EmptyState
              icon={tab === 'unread' ? 'mark_email_read' : 'notifications_off'}
              title={tab === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
              desc="민원 상태가 변경되면 여기에 표시됩니다."
            />
          </div>
        ) : (
          <div className="space-y-3 md:space-y-5">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                {/* 날짜 구분선 */}
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span className="text-xs font-bold text-on-surface-variant">{group}</span>
                  <div className="flex-1 h-px bg-outline-variant/50" />
                </div>

                <div className="space-y-2">
                  {items.map((n) => {
                    const colors = iconColorMap[n.color] ?? iconColorMap['text-primary'];
                    return (
                      <div
                        key={n.id}
                        onClick={() => navigate(`/my-complaints?id=${n.complaintId}`)}
                        className={`bg-white border rounded-2xl flex gap-3 md:gap-4 p-3 md:p-4 transition-all cursor-pointer hover:shadow-md ${
                          n.read
                            ? 'border-outline-variant/60'
                            : 'border-primary/20 shadow-sm shadow-primary/5'
                        }`}
                      >
                        {/* 아이콘 */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                          <span className={`material-symbols-outlined text-lg ${colors.text}`}>{n.icon}</span>
                        </div>

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold ${n.read ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-on-surface-variant shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{n.desc}</p>
                          <div className="mt-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              n.read ? 'bg-surface-container text-on-surface-variant' : `${colors.bg} ${colors.text}`
                            }`}>
                              {n.tag}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </CitizenLayout>
  );
}

export default Notifications;
