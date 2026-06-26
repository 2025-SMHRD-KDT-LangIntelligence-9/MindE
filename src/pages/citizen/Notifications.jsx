import CitizenLayout from '../../layouts/CitizenLayout';
import { useApp } from '../../store/AppContext';

function Notifications() {
  const { notifications, markAllRead } = useApp();
  const [filter, setFilter] = [
    'all',
    (v) => v,
  ];

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <CitizenLayout pageTitle="알림 센터" activeMenu="notifications">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-on-surface">알림</h2>
            {unread > 0 && (
              <span className="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full">{unread}개 새 알림</span>
            )}
          </div>
          <button
            onClick={markAllRead}
            className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
          >
            <span className="material-symbols-outlined text-lg">done_all</span>
            모두 읽음으로 표시
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-outline-variant p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">notifications_off</span>
            <p className="text-sm">알림이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white border rounded-xl flex gap-4 p-5 transition-colors ${
                  n.read ? 'border-outline-variant opacity-70' : 'border-primary/20 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  n.read ? 'bg-surface-container' : 'bg-secondary-container'
                }`}>
                  <span className={`material-symbols-outlined ${n.read ? 'text-on-surface-variant' : 'text-on-secondary-container'}`}>
                    {n.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-bold text-sm ${n.read ? 'text-on-surface-variant' : 'text-primary'}`}>
                      {n.title}
                      {!n.read && <span className="inline-block w-2 h-2 rounded-full bg-primary ml-2 align-middle" />}
                    </h4>
                    <span className="text-xs text-outline shrink-0 ml-2">{n.time}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-2">{n.desc}</p>
                  <span className="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-bold">
                    {n.tag}
                  </span>
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
