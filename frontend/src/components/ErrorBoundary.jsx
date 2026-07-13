import { Component } from 'react';
import logo from '../assets/logo.png';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message ?? '알 수 없는 오류가 발생했습니다.';

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
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-error text-3xl">error</span>
            </div>

            <h1 className="text-xl font-bold text-on-surface mb-2">오류가 발생했습니다</h1>
            <p className="text-sm text-on-surface-variant mb-6">
              페이지를 불러오는 중 문제가 생겼습니다.<br />
              새로고침하거나 홈으로 돌아가 주세요.
            </p>

            <details className="w-full mb-6 text-left">
              <summary className="text-xs text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors">
                오류 상세 보기
              </summary>
              <pre className="mt-2 p-3 bg-slate-100 rounded-xl text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all">
                {msg}
              </pre>
            </details>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 h-11 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                새로고침
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                className="flex-1 h-11 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">home</span>
                홈으로
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-on-surface-variant">
          문제가 계속되면 관리자에게 문의하세요.
        </p>
      </div>
    );
  }
}

export default ErrorBoundary;
