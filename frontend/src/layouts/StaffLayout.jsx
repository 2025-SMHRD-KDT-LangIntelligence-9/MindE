import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useApp } from '../store/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';

function StaffLayout({ pageTitle, activeMenu, children }) {
  const navigate = useNavigate();
  const { currentUser, logout, myDeptComplaints } = useApp();
  const handleLogout = () => { logout(); navigate('/login'); };
  const [readIds, setReadIds] = useState(new Set());

  const menuItems = [
    { key: 'complaints', label: '민원 처리', icon: 'assignment',             path: '/staff' },
    { key: 'urgent',     label: '긴급 민원', icon: 'notification_important', path: '/staff/urgent' },
    { key: 'stats',      label: '처리 현황', icon: 'bar_chart',              path: '/staff/stats' },
  ];

  // 담당자 알림: 내 부서의 새 접수 민원
  const rawNotifItems = myDeptComplaints
    .filter((c) => c.status === '접수')
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      title: '새 민원 접수',
      desc: c.title,
      icon: 'inbox',
      color: 'text-primary',
      iconBg: 'bg-primary/10',
      time: c.receivedAt,
    }));

  const notifItems = rawNotifItems.map((n) => ({ ...n, read: readIds.has(n.id) }));
  const handleMarkAllRead = () => setReadIds(new Set(rawNotifItems.map((n) => n.id)));

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="fixed top-0 left-0 w-full h-16 bg-slate-100 border-b border-slate-200 z-50 flex items-center px-6 shadow-sm">

        <button onClick={() => navigate('/staff')} className="shrink-0 mr-6 flex items-center gap-2.5">
          <img src={logo} alt="마음이 로고" className="h-16 w-auto" />
          <span className="text-xs font-bold text-slate-500 border border-slate-300 px-2 py-0.5 rounded-md">담당자</span>
        </button>

        <nav className="flex items-center h-full flex-1 overflow-x-auto">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                activeMenu === item.key
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0 pl-4">
          <NotificationDropdown items={notifItems} onMarkAllRead={handleMarkAllRead} />
          <div className="flex items-center gap-2 pl-3 border-l border-slate-300">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-700">{currentUser.name || '담당자'}</span>
              <span className="text-[10px] text-slate-500">{currentUser.dept}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
              title="로그아웃"
            >
              <span className="material-symbols-outlined text-slate-600 text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default StaffLayout;
