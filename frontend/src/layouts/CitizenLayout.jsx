import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useApp } from '../store/AppContext';
import NotificationDropdown from '../components/NotificationDropdown';

function CitizenLayout({ pageTitle, activeMenu, children }) {
  const navigate = useNavigate();
  const { notifications, markAllRead, currentUser, logout } = useApp();
  const handleLogout = () => { logout(); navigate('/login'); };

  const menuItems = [
    { key: 'home',          label: '홈',             icon: 'home',             path: '/home' },
    { key: 'chatbot',       label: '민원 상담',       icon: 'chat_bubble',      path: '/chatbot' },
    { key: 'document',      label: '민원 서류 작성',  icon: 'document_scanner', path: '/document' },
    { key: 'complaints',    label: '민원 내역',       icon: 'history',          path: '/my-complaints' },
    { key: 'notifications', label: '알림',            icon: 'notifications',    path: '/notifications' },
    { key: 'faq',           label: '자주 묻는 질문', icon: 'contact_support',   path: '/faq' },
    { key: 'settings',      label: '설정',            icon: 'settings',         path: '/settings' },
  ];

  const notifItems = notifications.map((n) => ({
    ...n,
    iconBg: n.color?.includes('emerald') ? 'bg-emerald-100' : n.color?.includes('amber') ? 'bg-amber-100' : 'bg-primary/10',
  }));

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="fixed top-0 left-0 w-full h-16 bg-slate-100 border-b border-slate-200 z-50 flex items-center px-6 shadow-sm">

        <button onClick={() => navigate('/home')} className="shrink-0 mr-6">
          <img src={logo} alt="마음이 로고" className="h-16 w-auto" />
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
          <NotificationDropdown items={notifItems} onMarkAllRead={markAllRead} />
          <div className="flex items-center gap-2 pl-3 border-l border-slate-300">
            <span className="text-sm font-bold text-slate-700 hidden sm:inline">{currentUser.name || '시민'} 님</span>
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

export default CitizenLayout;
