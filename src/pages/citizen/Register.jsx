import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useApp, DEPT_OPTIONS } from '../../store/AppContext';
import { registerApi } from '../../api/auth';
import { getPublicDepartmentsApi } from '../../api/admin';

function Register() {
  const navigate = useNavigate();
  const { stats } = useApp();

  const [mode, setMode] = useState('citizen');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [name, setName] = useState('');
  const [phoneMid, setPhoneMid] = useState('');
  const [phoneLast, setPhoneLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedDept, setSelectedDept] = useState(DEPT_OPTIONS[0].dept);
  const [departments, setDepartments] = useState(DEPT_OPTIONS.map((d) => d.dept));
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const phoneMidRef = useRef(null);
  const phoneLastRef = useRef(null);
  const deptBoxRef = useRef(null);

  const isStaff = mode === 'staff';

  // DB 부서 목록 로드 (공개 엔드포인트가 없으면 기본 목록 유지)
  useEffect(() => {
    getPublicDepartmentsApi().then((list) => {
      if (list?.length) {
        const names = list.map((d) => d.name).filter(Boolean);
        if (names.length) {
          setDepartments(names);
          setSelectedDept((cur) => (names.includes(cur) ? cur : names[0]));
        }
      }
    });
  }, []);

  // 부서 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const h = (e) => { if (deptBoxRef.current && !deptBoxRef.current.contains(e.target)) setDeptOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredDepts = departments.filter((d) => d.includes(deptSearch.trim()));

  const handleModeChange = (next) => {
    setMode(next);
    setName(''); setPhoneMid(''); setPhoneLast(''); setEmail(''); setPassword(''); setPasswordConfirm(''); setError(''); setDone(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('이름, 이메일, 비밀번호를 모두 입력해 주세요.');
      return;
    }
    const pwValid = password.length >= 8 && /[^A-Za-z0-9\s]/.test(password);
    if (!pwValid) {
      setError('비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if ((phoneMid || phoneLast) && (phoneMid.length !== 4 || phoneLast.length !== 4)) {
      setError('전화번호는 4자리씩 정확히 입력해 주세요.');
      return;
    }
    const phone = phoneMid && phoneLast ? `010-${phoneMid}-${phoneLast}` : '';

    setLoading(true);
    try {
      await registerApi({
        name,
        email,
        password,
        phone,
        apply_as_staff: isStaff,
      });

      if (isStaff) {
        navigate('/login', { state: { staffRegistered: true } });
      } else {
        navigate('/login', { state: { registered: true } });
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] md:min-h-screen flex items-center justify-center bg-white overflow-hidden md:overflow-auto md:py-4">
      <div className="flex items-stretch mx-auto gap-6 px-4 md:px-10 md:py-4 w-full max-w-[900px] h-full md:h-auto">

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
                { value: `${stats.done}건`, label: '누적 처리' },
                { value: `${stats.total}건`, label: '총 접수' },
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
        <div className="flex w-full md:w-[440px] md:shrink-0 h-full md:h-auto">
          <div className="w-full flex flex-col h-full md:h-auto">
            <div className="bg-white md:rounded-2xl md:border md:border-outline-variant md:shadow-sm overflow-hidden flex flex-col flex-1 h-full md:h-auto">

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
                    className={`flex-1 flex items-center justify-center gap-2 py-2 md:py-4 text-xs md:text-sm font-bold transition-all border-b-2 ${
                      mode === t.key
                        ? 'text-primary border-primary bg-primary/3'
                        : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base md:text-lg">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-3 md:p-6 flex flex-col flex-1 justify-start md:justify-center">

                {/* 모바일 전용 로고 */}
                <div className="md:hidden flex flex-col items-center gap-1 py-2 mb-1">
                  <img src={logo} alt="마음이" className="h-14 w-auto" />
                  <p className="text-xs text-on-surface-variant">AI 기반 공공 민원 서비스</p>
                </div>

                <h2 className="text-sm md:text-base font-bold text-on-surface mb-0.5">
                  {isStaff ? '담당자 회원가입' : '일반 회원가입'}
                </h2>
                <p className="text-xs text-on-surface-variant mb-2 md:mb-4">
                  {isStaff ? '담당 부서를 선택하고 정보를 입력해주세요.' : '정보를 입력하고 마음이 서비스를 시작하세요.'}
                </p>

                {/* 가입 완료 화면 */}
                {done ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                    {isStaff ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-amber-500 text-3xl">schedule</span>
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-base">가입 신청 완료</p>
                          <p className="text-sm text-on-surface-variant mt-1">관리자 승인 후 로그인할 수 있습니다.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-base">회원가입 완료!</p>
                          <p className="text-sm text-on-surface-variant mt-1">마음이 서비스에 오신 것을 환영합니다.</p>
                        </div>
                      </>
                    )}
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
                    <form onSubmit={handleSubmit} className="space-y-2 md:space-y-3">
                      {/* 이름 */}
                      <div>
                        <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">이름</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
                          <input type="text" placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full h-9 md:h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-xs md:text-sm" />
                        </div>
                      </div>

                      {/* 전화번호 */}
                      <div>
                        <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">전화번호</label>
                        <div className="relative flex items-center gap-2 md:gap-2.5 h-9 md:h-11 pl-11 pr-4 border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">phone</span>
                          <span className="text-xs md:text-sm text-on-surface font-medium shrink-0">010</span>
                          <span className="text-outline shrink-0">-</span>
                          <input
                            ref={phoneMidRef}
                            type="tel" inputMode="numeric" maxLength={4} placeholder="0000"
                            value={phoneMid}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setPhoneMid(v);
                              if (v.length === 4) phoneLastRef.current?.focus();
                            }}
                            className="w-12 md:w-14 shrink-0 bg-transparent outline-none text-xs md:text-sm text-center"
                          />
                          <span className="text-outline shrink-0">-</span>
                          <input
                            ref={phoneLastRef}
                            type="tel" inputMode="numeric" maxLength={4} placeholder="0000"
                            value={phoneLast}
                            onChange={(e) => setPhoneLast(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            onKeyDown={(e) => { if (e.key === 'Backspace' && !phoneLast) phoneMidRef.current?.focus(); }}
                            className="w-12 md:w-14 shrink-0 bg-transparent outline-none text-xs md:text-sm text-center"
                          />
                        </div>
                      </div>

                      {/* 이메일 */}
                      <div>
                        <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">이메일</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                          <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-9 md:h-11 pl-10 pr-4 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-xs md:text-sm" />
                        </div>
                      </div>

                      {/* 담당 부서 (담당자만) */}
                      {isStaff && (
                        <div>
                          <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">담당 부서</label>
                          <div className="relative" ref={deptBoxRef}>
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] z-10">business</span>
                            <button
                              type="button"
                              onClick={() => setDeptOpen((o) => !o)}
                              className="w-full h-9 md:h-11 pl-10 pr-9 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left text-xs md:text-sm bg-white flex items-center text-on-surface"
                            >
                              {selectedDept || '담당 부서 선택'}
                            </button>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
                              {deptOpen ? 'expand_less' : 'expand_more'}
                            </span>

                            {deptOpen && (
                              <div className="absolute z-30 mt-1 w-full bg-white border border-outline-variant rounded-xl shadow-lg overflow-hidden">
                                <div className="p-2 border-b border-outline-variant/60">
                                  <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                                    <input
                                      autoFocus
                                      value={deptSearch}
                                      onChange={(e) => setDeptSearch(e.target.value)}
                                      placeholder="부서 검색..."
                                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-outline-variant text-xs outline-none focus:border-primary"
                                    />
                                  </div>
                                </div>
                                <div className="max-h-44 overflow-y-auto">
                                  {filteredDepts.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-on-surface-variant text-center">검색 결과가 없습니다.</p>
                                  ) : filteredDepts.map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => { setSelectedDept(d); setDeptOpen(false); setDeptSearch(''); }}
                                      className={`w-full text-left px-3 py-2 text-xs md:text-sm transition-colors hover:bg-surface-container-low ${
                                        d === selectedDept ? 'text-primary font-bold bg-primary/5' : 'text-on-surface'
                                      }`}
                                    >
                                      {d}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 비밀번호 */}
                      <div>
                        <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">비밀번호</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                          <input type={showPw ? 'text' : 'password'} placeholder="비밀번호를 입력하세요"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-9 md:h-11 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-xs md:text-sm" />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1 pl-1">8자 이상, 특수문자 포함</p>
                      </div>

                      {/* 비밀번호 확인 */}
                      <div>
                        <label className="text-xs md:text-sm font-medium text-on-surface block mb-0.5 md:mb-1.5">비밀번호 확인</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock_reset</span>
                          <input type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호를 다시 입력하세요"
                            value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                            className="w-full h-9 md:h-11 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-xs md:text-sm" />
                          <button type="button" onClick={() => setShowPwConfirm(!showPwConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showPwConfirm ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 에러 */}
                      {error && (
                        <div className="flex items-center gap-2 bg-error-container text-error px-3 py-2.5 rounded-xl text-sm">
                          <span className="material-symbols-outlined text-lg shrink-0">error</span>
                          {error}
                        </div>
                      )}

                      {!isStaff && (
                        <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                          <input type="checkbox" defaultChecked className="w-3.5 h-3.5 md:w-4 md:h-4 accent-primary shrink-0" />
                          <span className="text-xs text-on-surface-variant">민원 처리 결과 및 서비스 알림 수신에 동의합니다.</span>
                        </label>
                      )}

                      <button type="submit" disabled={loading}
                        className="w-full py-2 md:py-3 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs md:text-sm bg-primary text-white hover:brightness-105 shadow-md shadow-primary/30 mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed">
                        {loading ? '처리 중...' : (isStaff ? '담당자 가입 신청' : '회원가입')}
                        <span className="material-symbols-outlined text-lg">{loading ? 'hourglass_empty' : (isStaff ? 'badge' : 'person_add')}</span>
                      </button>
                    </form>

                    <p className="text-center text-xs text-on-surface-variant mt-4">
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
