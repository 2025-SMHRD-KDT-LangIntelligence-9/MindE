import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import cityBg from '../assets/city-bg.png';
import { useApp } from '../store/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';

function CitizenLayout({ pageTitle, activeMenu, children }) {
  const navigate = useNavigate();
  const { notifications, markAllRead, markOneRead, currentUser, logout } = useApp();
  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    if (!sessionStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  const menuItems = [
    { key: 'home',          label: '홈',             short: '홈',   icon: 'home',             path: '/home' },
    { key: 'chatbot',       label: '민원 상담',       short: '상담', icon: 'chat_bubble',      path: '/chatbot' },
    { key: 'document',      label: '민원 서류 작성',  short: '서류', icon: 'document_scanner', path: '/document' },
    { key: 'complaints',    label: '민원 내역',       short: '내역', icon: 'history',          path: '/my-complaints' },
    { key: 'notifications', label: '알림',            short: '알림', icon: 'notifications',    path: '/notifications' },
    { key: 'faq',           label: '자주 묻는 질문', short: 'FAQ',  icon: 'contact_support',   path: '/faq' },
    { key: 'settings',      label: '설정',            short: '설정', icon: 'settings',         path: '/settings' },
  ];

  const notifItems = notifications.map((n) => ({
    ...n,
    iconBg: n.color?.includes('emerald') ? 'bg-emerald-100' : n.color?.includes('amber') ? 'bg-amber-100' : 'bg-primary/10',
  }));

  return (
    <div className="min-h-screen text-on-background xl:min-w-[1280px]">
      <img src={cityBg} aria-hidden alt="" className="fixed inset-0 w-full h-full object-cover object-bottom pointer-events-none select-none opacity-[0.28] -z-10" />
      <header className="fixed top-0 left-0 w-full h-12 xl:h-16 bg-slate-100 border-b border-slate-200 z-50 flex items-center px-3 xl:px-6 shadow-sm xl:min-w-[1280px]">

        <button onClick={() => navigate('/home')} className="shrink-0 xl:mr-6">
          <img src={logo} alt="마음이 로고" className="h-9 xl:h-16 w-auto" />
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
          <NotificationDropdown items={notifItems} onMarkAllRead={markAllRead} onReadItem={(n) => markOneRead(n.id)} />
          <div className="flex items-center gap-2 pl-2 xl:pl-3 border-l border-slate-300">
            <span className="hidden sm:inline text-sm font-bold text-slate-700">{currentUser.name || '시민'} 님</span>
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

export default CitizenLayout;
