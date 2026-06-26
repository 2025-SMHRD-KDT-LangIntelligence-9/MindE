import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useApp } from '../../store/AppContext';
import { STAFF_ACCOUNTS } from '../../store/AppContext';

const CITIZEN_ACCOUNT = { email: 'user@test.com',  password: '1234' };
const ADMIN_ACCOUNT   = { email: 'admin@test.com', password: 'admin' };

const PRESET_ACCOUNTS = [
  { label: '일반 시민',   email: CITIZEN_ACCOUNT.email, password: CITIZEN_ACCOUNT.password },
  { label: '관리자',     email: ADMIN_ACCOUNT.email,   password: ADMIN_ACCOUNT.password },
  ...STAFF_ACCOUNTS.map((a) => ({ label: a.dept, email: a.email, password: a.password })),
];

function Login() {
  const navigate = useNavigate();
  const { login, users } = useApp();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const emailRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (email === ADMIN_ACCOUNT.email) {
      login('admin');
      navigate('/admin');
      return;
    }

    const staffAccount = STAFF_ACCOUNTS.find((a) => a.email === email);
    if (staffAccount) {
      login('staff', staffAccount);
      navigate('/staff');
      return;
    }

    const pendingUser = users.find((u) => u.role === 'staff' && u.status === 'pending' && u.email === email);
    if (pendingUser) {
      setError('pending');
      return;
    }

    const activeStaff = users.find((u) => u.role === 'staff' && u.status === 'active' && u.email === email);
    if (activeStaff) {
      login('staff', activeStaff);
      navigate('/staff');
      return;
    }

    login('citizen');
    navigate('/chatbot');
  };

  const selectAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    setShowDropdown(false);
  };

  return (
    <>
    <div className="h-screen flex items-center justify-center bg-white overflow-hidden relative">
      <div className="flex items-stretch mx-auto gap-6 px-10 py-4 relative z-10">

        {/* ── 왼쪽: 브랜드 ── */}
        <div className="hidden lg:flex w-[400px] shrink-0">
          <div className="flex flex-col w-full h-full bg-gradient-to-b from-[#2563eb] via-[#60a5fa] to-[#93c5fd] px-8 py-10 relative overflow-hidden rounded-3xl shadow-xl gap-7">
            <div className="absolute top-[-80px] right-[-80px] w-62 h-72 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-white/5 pointer-events-none" />

            {/* 로고 */}
            <div className="flex justify-center relative z-10">
              <img src={logo} alt="마음이 로고" className="h-44 w-auto drop-shadow-lg" />
            </div>

            {/* 헤드라인 */}
            <div className="relative z-10 text-center">
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                마음이와 함께,<br />더 쉽고 빠른 민원 서비스
              </h1>
              <p className="text-white/70 text-sm leading-relaxed">
                AI가 24시간 답변하고, 쉽고 정확하게<br />안내해 드리는 새로운 민원 서비스입니다.
              </p>
            </div>

            {/* 통계 */}
            <div className="relative z-10 grid grid-cols-3 gap-2">
              {[
                { value: '12,400+', label: '누적 처리' },
                { value: '1.8일',   label: '평균 처리 속도' },
                { value: '24시간',  label: '언제든 접수' },
              ].map((s) => (
                <div key={s.label} className="bg-white/15 rounded-2xl py-3.5 text-center border border-white/20">
                  <p className="text-white font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-white/60 text-[10px] mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* 기능 카드 */}
            <div className="relative z-10 flex flex-col gap-2.5">
              {[
                { icon: 'chat_bubble',   title: '민원 상담',      desc: 'AI가 신속하고 정확하게 상담' },
                { icon: 'edit_note',     title: '민원 접수',      desc: '간편한 절차로 빠르게 접수' },
                { icon: 'track_changes', title: '민원 현황 확인', desc: '처리 진행 상황을 실시간 확인' },
              ].map((b) => (
                <div key={b.title} className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3.5 flex items-center gap-3.5 border border-white/20">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-lg">{b.icon}</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{b.title}</p>
                    <p className="text-white/60 text-xs mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 폼 ── */}
        <div className="flex w-[440px] shrink-0">
          <div className="w-full flex flex-col">

            <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden relative flex flex-col flex-1">
              <img
                src={logo}
                alt=""
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] opacity-[0.06] pointer-events-none select-none"
              />

              <div className="relative z-10 flex flex-col flex-1 justify-between">

                {/* 상단 환영 배너 */}
                <div className="px-10 pt-10 pb-6 border-b border-outline-variant/50 bg-gradient-to-r from-primary/5 to-blue-50/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
                      <span className="material-symbols-outlined text-white text-xl">waving_hand</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-on-surface leading-tight">환영합니다!</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">마음이 AI 민원 서비스에 로그인하세요.</p>
                    </div>
                  </div>
                </div>

                {/* 폼 영역 */}
                <div className="px-10 py-8 flex flex-col gap-6">

                  <div>
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-5 rounded-full bg-primary" />
                      <span className="text-base font-bold text-on-surface">로그인</span>
                    </div>

                    {/* 이메일 */}
                    <div className="flex flex-col gap-5">
                      <div>
                        <label className="text-xs font-bold text-on-surface-variant block mb-1.5">이메일</label>
                        <div className="relative" ref={emailRef}>
                          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px] z-10">mail</span>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            placeholder="이메일을 입력하거나 선택하세요"
                            className="w-full h-12 pl-11 pr-10 border-2 border-outline-variant rounded-xl focus:border-primary outline-none transition-all text-on-surface text-sm bg-surface-container-low/40 focus:bg-white"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setShowDropdown((v) => !v); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {showDropdown ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>

                          {showDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                              <p className="text-[10px] font-bold text-on-surface-variant px-4 pt-2.5 pb-1 uppercase tracking-wide">계정 선택</p>
                              {PRESET_ACCOUNTS.map((a) => (
                                <button
                                  key={a.email}
                                  type="button"
                                  onMouseDown={() => selectAccount(a)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors text-left"
                                >
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-sm">person</span>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-on-surface">{a.label}</p>
                                    <p className="text-[11px] text-on-surface-variant">{a.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 비밀번호 */}
                      <div>
                        <label className="text-xs font-bold text-on-surface-variant block mb-1.5">비밀번호</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                          <input
                            type={showPw ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="비밀번호를 입력하세요"
                            className="w-full h-12 pl-11 pr-10 border-2 border-outline-variant rounded-xl focus:border-primary outline-none transition-all text-on-surface text-sm bg-surface-container-low/40 focus:bg-white"
                          />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 기억하기 / 찾기 */}
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-primary" />
                      <span className="text-sm text-on-surface-variant">아이디 기억하기</span>
                    </label>
                    <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(''); setForgotSent(false); }} className="text-sm text-primary font-bold hover:underline">비밀번호 찾기</button>
                  </div>

                  {/* 에러 */}
                  {error === 'pending' ? (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl text-sm">
                      <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">schedule</span>
                      <div>
                        <p className="font-bold text-amber-700">승인 대기 중</p>
                        <p className="text-amber-600 text-xs mt-0.5">관리자 승인 후 로그인할 수 있습니다.</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center gap-2 bg-error-container text-error px-4 py-3 rounded-xl text-sm font-medium">
                      <span className="material-symbols-outlined text-lg">error</span>
                      {error}
                    </div>
                  ) : null}

                  {/* 로그인 버튼 */}
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    className="w-full py-3.5 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base bg-primary text-white hover:brightness-105 shadow-lg shadow-primary/25"
                  >
                    로그인
                    <span className="material-symbols-outlined">login</span>
                  </button>

                  <p className="text-center text-sm text-on-surface-variant">
                    아직 계정이 없으신가요?{' '}
                    <button type="button" onClick={() => navigate('/register')} className="text-primary font-bold hover:underline">
                      회원가입
                    </button>
                  </p>
                </div>

                {/* 하단 서비스 특징 */}
                <div className="px-10 py-5 border-t border-outline-variant/50 bg-slate-50/80">
                  <div className="flex items-center justify-around">
                    {[
                      { icon: 'smart_toy',      label: 'AI 민원 상담' },
                      { icon: 'edit_note',      label: '간편 접수' },
                      { icon: 'track_changes',  label: '실시간 현황' },
                    ].map((f) => (
                      <div key={f.label} className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-lg">{f.icon}</span>
                        </div>
                        <span className="text-[11px] font-medium text-on-surface-variant">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* 비밀번호 찾기 모달 */}
    {showForgot && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowForgot(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>

          {/* 모달 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b border-outline-variant/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg">lock_reset</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">비밀번호 찾기</h3>
                  <p className="text-xs text-on-surface-variant">가입한 이메일로 재설정 링크를 보내드립니다.</p>
                </div>
              </div>
              <button onClick={() => setShowForgot(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* 모달 본문 */}
          <div className="px-6 py-5">
            {forgotSent ? (
              <div className="flex flex-col items-center py-4 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-500 text-3xl">mark_email_read</span>
                </div>
                <div>
                  <p className="font-bold text-on-surface">이메일을 전송했습니다</p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    <span className="text-primary font-bold">{forgotEmail}</span>으로<br />비밀번호 재설정 링크를 보냈습니다.
                  </p>
                </div>
                <button
                  onClick={() => setShowForgot(false)}
                  className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 shadow-md shadow-primary/25"
                >
                  확인
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">가입한 이메일</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full h-12 pl-11 pr-4 border-2 border-outline-variant rounded-xl focus:border-primary outline-none transition-all text-on-surface text-sm bg-surface-container-low/40 focus:bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForgot(false)}
                    className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { if (forgotEmail) setForgotSent(true); }}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 shadow-md shadow-primary/25"
                  >
                    재설정 링크 전송
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default Login;
