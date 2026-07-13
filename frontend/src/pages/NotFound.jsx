import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" style={{ minWidth: 320 }}>

      <div className="relative overflow-hidden bg-white rounded-2xl border border-outline-variant shadow-sm p-10 flex flex-col items-center text-center max-w-md w-full">
        {/* 배경 로고 워터마크 */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{
            width: 400,
            opacity: 0.06,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* 카드 콘텐츠 */}
        <div className="relative z-10 flex flex-col items-center text-center w-full">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">search_off</span>
          </div>

          <p className="text-5xl font-black text-[#1e3a5f] mb-3">404</p>
          <h1 className="text-xl font-bold text-on-surface mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-on-surface-variant mb-8">
            요청하신 주소가 존재하지 않거나<br />
            이동되었을 수 있습니다.
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 h-11 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              이전으로
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 h-11 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">home</span>
              홈으로
            </button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-on-surface-variant">
        마음결 AI 민원 서비스
      </p>
    </div>
  );
}

export default NotFound;
