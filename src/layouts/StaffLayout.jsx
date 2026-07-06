import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import cityBg from '../assets/city-bg.png';
import { useApp } from '../store/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';

function StaffLayout({ pageTitle, activeMenu, children }) {
  const navigate = useNavigate();
  const { currentUser, logout, myDeptComplaints } = useApp();
  const handleLogout = () => { logout(); navigate('/login'); };
  const [readIds, setReadIds] = useState(new Set());

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  const menuItems = [
    { key: 'complaints', label: '민원 처리', short: '처리', icon: 'assignment',             path: '/staff' },
    { key: 'urgent',     label: '긴급 민원', short: '긴급', icon: 'notification_important', path: '/staff/urgent' },
    { key: 'stats',      label: '처리 현황', short: '현황', icon: 'bar_chart',              path: '/staff/stats' },
  ];

  const rawNotifItems = myDeptComplaints
    .filter((c) => c.status === '접수')
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      complaintId: c.id,
      urgency: c.urgency,
      title: c.urgency === '긴급' ? '긴급 민원 접수' : '새 민원 접수',
      desc: c.title,
      icon: c.urgency === '긴급' ? 'notification_important' : 'inbox',
      color: c.urgency === '긴급' ? 'text-red-500' : 'text-primary',
      iconBg: c.urgency === '긴급' ? 'bg-red-50' : 'bg-primary/10',
      time: c.receivedAt,
    }));

  const notifItems = rawNotifItems.map((n) => ({ ...n, read: readIds.has(n.id) }));
  const handleMarkAllRead = () => setReadIds(new Set(rawNotifItems.map((n) => n.id)));

  return (
    <div className="min-h-screen text-on-background xl:min-w-[1280px]">
      <img src={cityBg} aria-hidden alt="" className="fixed inset-0 w-full h-full object-cover object-bottom pointer-events-none select-none opacity-[0.28] -z-10" />
      <header className="fixed top-0 left-0 w-full h-12 xl:h-16 bg-slate-100 border-b border-slate-200 z-50 flex items-center px-3 xl:px-6 shadow-sm xl:min-w-[1280px]">

        <button onClick={() => navigate('/staff')} className="shrink-0 xl:mr-6 flex items-center gap-2.5">
          <img src={logo} alt="마음이 로고" className="h-9 xl:h-16 w-auto" />
          <span className="text-[10px] xl:text-xs font-bold text-slate-500 border border-slate-300 px-1.5 xl:px-2 py-0.5 rounded-md">담당자</span>
        </button>

        {/* 데스크탑 가로 메뉴 */}
        <nav className="hidden xl:flex items-center h-full flex-1 overflow-x-auto">
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

        <div className="flex items-center gap-2 shrink-0 ml-auto xl:ml-0 xl:pl-4">
          <NotificationDropdown
            items={notifItems}
            onMarkAllRead={handleMarkAllRead}
            onReadItem={(n) => setReadIds((prev) => new Set(prev).add(n.id))}
            onClickItem={(n) => navigate(n.urgency === '긴급' ? `/staff/urgent?id=${n.complaintId}` : `/staff?id=${n.complaintId}`)}
          />
          <div className="flex items-center gap-2 pl-2 xl:pl-3 border-l border-slate-300">
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

      <main className="pt-12 xl:pt-16 min-h-screen">
        <div className="p-3 pb-24 xl:p-6 xl:pb-6">{children}</div>
      </main>

      {/* 모바일 하단 탭바 */}
      <nav className="xl:hidden fixed bottom-0 left-0 w-full h-16 bg-white/95 backdrop-blur border-t border-slate-200 z-50 flex items-stretch justify-around px-0.5 shadow-[0_-1px_6px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors ${
              activeMenu === item.key ? 'text-primary' : 'text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
            <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">{item.short ?? item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default StaffLayout;
