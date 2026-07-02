import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useApp } from '../store/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';

function AdminLayout({ pageTitle, activeMenu, children }) {
  const navigate = useNavigate();
  const { users, complaints, logout } = useApp();
  const handleLogout = () => { logout(); navigate('/login'); };
  const [readIds, setReadIds] = useState(new Set());

  // 로그인(토큰) 없이 접근하면 로그인 페이지로 (뒤로/앞으로가기 포함)
  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  const menuItems = [
    { key: 'dashboard',  label: '대시보드',     icon: 'dashboard',     path: '/admin' },
    { key: 'monitoring', label: '민원 모니터링', icon: 'monitor_heart', path: '/admin/monitoring' },
    { key: 'stats',      label: '통계 분석',    icon: 'leaderboard',   path: '/admin/stats' },
    { key: 'settings',   label: '시스템 설정',  icon: 'settings',      path: '/admin/settings' },
  ];

  // 관리자 알림: 담당자 가입 승인 대기 + 긴급 민원
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const urgentComplaints = complaints.filter((c) => c.urgency === '긴급' && c.status === '접수');

  const rawNotifItems = [
    ...pendingUsers.map((u) => ({
      id: `pending-${u.id}`,
      title: '담당자 가입 승인 대기',
      desc: `${u.name}(${u.dept}) 님이 담당자 가입을 신청했습니다.`,
      icon: 'person_add',
      color: 'text-amber-500',
      iconBg: 'bg-amber-100',
      time: u.joinedAt,
    })),
    ...urgentComplaints.map((c) => ({
      id: `urgent-${c.id}`,
      complaintId: c.id,
      title: '긴급 민원 접수',
      desc: c.title,
      icon: 'priority_high',
      color: 'text-red-500',
      iconBg: 'bg-red-100',
      time: c.receivedAt,
    })),
  ];

  const notifItems = rawNotifItems.map((n) => ({ ...n, read: readIds.has(n.id) }));
  const handleMarkAllRead = () => setReadIds(new Set(rawNotifItems.map((n) => n.id)));

  return (
    <div className="min-h-screen bg-background text-on-background">

      <header className="fixed top-0 left-0 w-full h-10 md:h-16 bg-slate-100 border-b border-slate-200 z-50 flex items-center px-3 md:px-6 shadow-sm">

        <button onClick={() => navigate('/admin')} className="shrink-0 mr-2 md:mr-6 flex items-center gap-1.5 md:gap-2.5">
          <img src={logo} alt="마음이 로고" className="h-10 md:h-16 w-auto" />
          <span className="text-xs font-bold text-slate-500 border border-slate-300 px-2 py-0.5 rounded-md">관리자</span>
        </button>

        <nav className="hidden md:flex items-center h-full flex-1 overflow-x-auto">
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

        <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-auto md:ml-0 md:pl-4">
          <NotificationDropdown
            items={notifItems}
            onMarkAllRead={handleMarkAllRead}
            onClickItem={(n) => {
              if (n.complaintId) navigate(`/admin/monitoring?id=${n.complaintId}`);
              else navigate('/admin/settings?tab=users');
            }}
          />
          <div className="flex items-center gap-1 md:gap-2 pl-2 md:pl-3 border-l border-slate-300">
            <span className="text-sm font-bold text-slate-700 hidden sm:inline">시스템 관리자</span>
            <button
              onClick={handleLogout}
              className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
              title="로그아웃"
            >
              <span className="material-symbols-outlined text-slate-600 text-lg md:text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 하단 탭바 */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 z-50 flex items-center justify-around">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 py-2 flex-1 transition-colors ${
              activeMenu === item.key ? 'text-primary' : 'text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="pt-10 md:pt-16 pb-16 md:pb-0 min-h-screen">
        <div className="p-3 md:p-6">{children}</div>
      </main>

    </div>
  );
}

export default AdminLayout;
