import { useParams, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const ERROR_CONFIG = {
  401: {
    icon: 'lock',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    code: '401',
    title: '세션이 만료됐습니다',
    desc: '로그인 후 다시 이용해 주세요.',
    buttons: [{ label: '로그인하기', icon: 'login', action: 'login', primary: true }],
  },
  403: {
    icon: 'block',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-400',
    code: '403',
    title: '접근 권한이 없습니다',
    desc: '이 페이지에 접근할 권한이 없습니다.',
    buttons: [
      { label: '이전으로', icon: 'arrow_back', action: 'back', primary: false },
      { label: '홈으로', icon: 'home', action: 'home', primary: true },
    ],
  },
  500: {
    icon: 'cloud_off',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-400',
    code: '500',
    title: '서버에 연결할 수 없습니다',
    desc: '일시적인 오류입니다. 잠시 후 다시 시도하거나\n관리자에게 문의하세요.',
    buttons: [
      { label: '새로고침', icon: 'refresh', action: 'reload', primary: false },
      { label: '홈으로', icon: 'home', action: 'home', primary: true },
    ],
  },
};

function ErrorPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const config = ERROR_CONFIG[code] ?? ERROR_CONFIG[500];

  const handleAction = (action) => {
    if (action === 'back') navigate(-1);
    else if (action === 'home') navigate('/');
    else if (action === 'login') navigate('/login');
    else if (action === 'reload') window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" style={{ minWidth: 320 }}>
      <div className="relative overflow-hidden bg-white rounded-2xl border border-outline-variant shadow-sm p-10 flex flex-col items-center text-center max-w-md w-full">
        {/* 배경 로고 워터마크 */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ width: 400, opacity: 0.06, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        />

        <div className="relative z-10 flex flex-col items-center text-center w-full">
          <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mb-5`}>
            <span className={`material-symbols-outlined ${config.iconColor} text-3xl`}>{config.icon}</span>
          </div>

          <p className="text-5xl font-black text-[#1e3a5f] mb-3">{config.code}</p>
          <h1 className="text-xl font-bold text-on-surface mb-2">{config.title}</h1>
          <p className="text-sm text-on-surface-variant mb-8 whitespace-pre-line">{config.desc}</p>

          <div className="flex gap-3 w-full">
            {config.buttons.map((btn) => (
              <button
                key={btn.action}
                onClick={() => handleAction(btn.action)}
                className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  btn.primary
                    ? 'bg-[#1e3a5f] text-white hover:brightness-110'
                    : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-base">{btn.icon}</span>
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-on-surface-variant">마음결 AI 민원 서비스</p>
    </div>
  );
}

export default ErrorPage;
