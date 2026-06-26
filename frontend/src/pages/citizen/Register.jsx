import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useApp } from '../../store/AppContext';
import { DEPT_OPTIONS } from '../../store/AppContext';

function Register() {
  const navigate = useNavigate();
  const { registerUser } = useApp();

  const [mode, setMode] = useState('citizen');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedDept, setSelectedDept] = useState(DEPT_OPTIONS[0].dept);
  const [done, setDone] = useState(false);

  const isStaff = mode === 'staff';

  const handleModeChange = (next) => {
    setMode(next);
    setName(''); setPhone(''); setEmail(''); setDone(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isStaff) {
      const deptOption = DEPT_OPTIONS.find((d) => d.dept === selectedDept);
      registerUser({ name: name || '담당자', email: email || '', phone: phone || '', role: 'staff', dept: deptOption.dept, deptGroup: deptOption.deptGroup });
      setDone(true);
    } else {
      registerUser({ name: name || '익명', email: email || '', phone: phone || '' });
      navigate('/login');
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-white overflow-hidden">
      <div className="flex items-stretch mx-auto gap-6 px-10 py-4">

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
                마음을 전하는<br />첫 번째 걸음
              </h1>
              <p className="text-white/70 text-sm leading-relaxed">
                회원가입 후 AI 민원 상담 챗봇을 통해<br />언제든지 편하게 민원을 접수하세요.
              </p>
            </div>

            {/* 통계 */}
            <div className="relative z-10 grid grid-cols-3 gap-2">
              {[
                { value: '12,400+', label: '누적 처리' },
                { value: '4.7점',   label: '시민 만족도' },
                { value: '98%',     label: '완료율' },
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
                { icon: 'verified_user',  title: '안전한 서비스',   desc: '안전하고 투명한 공공 민원 시스템' },
                { icon: 'notifications',  title: '실시간 알림',    desc: '민원 처리 현황을 즉시 알림' },
                { icon: 'history',        title: '민원 내역 관리', desc: '접수한 민원을 한눈에 확인' },
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
            <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col flex-1">

              {/* 탭 */}
              <div className="flex border-b border-outline-variant">
                {[
                  { key: 'citizen', label: '일반 회원가입',  icon: 'person' },
                  { key: 'staff',   label: '담당자 회원가입', icon: 'badge' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleModeChange(t.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all border-b-2 ${
                      mode === t.key
                        ? 'text-primary border-primary bg-primary/3'
                        : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-6 flex flex-col flex-1 justify-center">
                <h2 className="text-base font-bold text-on-surface mb-0.5">
                  {isStaff ? '담당자 회원가입' : '일반 회원가입'}
                </h2>
                <p className="text-xs text-on-surface-variant mb-4">
                  {isStaff ? '담당 부서를 선택하고 정보를 입력해주세요.' : '정보를 입력하고 마음이 서비스를 시작하세요.'}
                </p>

                {/* 담당자 가입 완료 → 승인 대기 안내 */}
                {done ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-500 text-3xl">schedule</span>
                    </div>
                    <div>
                      <p className="font-bold text-on-surface text-base">가입 신청 완료</p>
                      <p className="text-sm text-on-surface-variant mt-1">관리자 승인 후 로그인할 수 있습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 shadow-md shadow-primary/30"
                    >
                      로그인 페이지로
                    </button>
                  </div>
                ) : (
                  <>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      {/* 이름 */}
                      <div>
                        <label className="text-sm font-medium text-on-surface block mb-1.5">이름</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
                          <input type="text" placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm" />
                        </div>
                      </div>

                      {/* 전화번호 */}
                      <div>
                        <label className="text-sm font-medium text-on-surface block mb-1.5">전화번호</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">phone</span>
                          <input type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm" />
                        </div>
                      </div>

                      {/* 이메일 */}
                      <div>
                        <label className="text-sm font-medium text-on-surface block mb-1.5">이메일</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                          <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm" />
                        </div>
                      </div>

                      {/* 담당 부서 (담당자만) */}
                      {isStaff && (
                        <div>
                          <label className="text-sm font-medium text-on-surface block mb-1.5">담당 부서</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">business</span>
                            <select
                              value={selectedDept}
                              onChange={(e) => setSelectedDept(e.target.value)}
                              className="w-full h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm bg-white appearance-none"
                            >
                              {DEPT_OPTIONS.map((d) => (
                                <option key={d.dept} value={d.dept}>{d.dept}</option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">expand_more</span>
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1.5 pl-1">
                            관할: {DEPT_OPTIONS.find((d) => d.dept === selectedDept)?.deptGroup.join(', ')}
                          </p>
                        </div>
                      )}

                      {/* 비밀번호 */}
                      <div>
                        <label className="text-sm font-medium text-on-surface block mb-1.5">비밀번호</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                          <input type={showPw ? 'text' : 'password'} placeholder="비밀번호를 입력하세요"
                            className="w-full h-11 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm" />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 비밀번호 확인 */}
                      <div>
                        <label className="text-sm font-medium text-on-surface block mb-1.5">비밀번호 확인</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock_reset</span>
                          <input type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호를 다시 입력하세요"
                            className="w-full h-11 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-sm" />
                          <button type="button" onClick={() => setShowPwConfirm(!showPwConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showPwConfirm ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>

                      {!isStaff && (
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
                          <span className="text-sm text-on-surface-variant">민원 처리 결과 및 서비스 알림 수신에 동의합니다.</span>
                        </label>
                      )}

                      <button type="submit"
                        className="w-full py-3 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm bg-primary text-white hover:brightness-105 shadow-md shadow-primary/30 mt-1">
                        {isStaff ? '담당자 가입 신청' : '회원가입'}
                        <span className="material-symbols-outlined text-lg">{isStaff ? 'badge' : 'person_add'}</span>
                      </button>
                    </form>

                    <p className="text-center text-sm text-on-surface-variant mt-4">
                      이미 계정이 있으신가요?{' '}
                      <button type="button" onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">
                        로그인
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Register;
