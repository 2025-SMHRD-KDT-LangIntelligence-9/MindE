import logo from '../assets/logo.png';

/* ── 옵션 A: 로고 + 통계 숫자 ── */
function OptionA() {
  return (
    <div className="flex flex-col w-full h-full bg-gradient-to-br from-primary to-[#3a7fd4] px-8 py-8 relative overflow-hidden rounded-3xl shadow-xl">
      <div className="absolute top-[-60px] right-[-60px] w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute bottom-[-40px] left-[-40px] w-44 h-44 rounded-full bg-white/5" />

      {/* 로고 */}
      <div className="flex items-center gap-3 relative z-10 mb-6">
        <img src={logo} alt="로고" className="h-12 w-auto" />
        <div>
          <p className="text-white font-bold text-sm">마음이</p>
          <p className="text-white/60 text-xs">AI 민원 상담 챗봇</p>
        </div>
      </div>

      {/* 헤드라인 */}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">
          마음이와 함께,<br />더 쉽고 빠른 민원 서비스
        </h1>
        <p className="text-white/70 text-xs leading-relaxed mt-2">
          AI가 24시간 답변하고, 쉽고 정확하게<br />안내해 드리는 새로운 민원 서비스입니다.
        </p>
      </div>

      {/* 통계 숫자 */}
      <div className="relative z-10 grid grid-cols-2 gap-3">
        {[
          { value: '12,400+', label: '누적 처리' },
          { value: '98%',     label: '완료율' },
        ].map((s) => (
          <div key={s.label} className="bg-white/15 backdrop-blur rounded-2xl px-3 py-3 text-center">
            <p className="text-white font-bold text-lg leading-tight">{s.value}</p>
            <p className="text-white/65 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 옵션 B: 로고 + 글래스모피즘 카드 ── */
function OptionB() {
  return (
    <div className="flex flex-col w-full h-full bg-gradient-to-br from-primary to-[#3a7fd4] px-8 py-8 relative overflow-hidden rounded-3xl shadow-xl">
      <div className="absolute top-[-60px] right-[-60px] w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute bottom-[-40px] left-[-40px] w-44 h-44 rounded-full bg-white/5" />

      {/* 로고 */}
      <div className="flex justify-center relative z-10 mb-4">
        <img src={logo} alt="로고" className="h-16 w-auto drop-shadow-lg" />
      </div>

      {/* 헤드라인 */}
      <div className="flex-1 flex flex-col justify-center relative z-10 text-center">
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">
          마음이와 함께,<br />더 쉽고 빠른 민원 서비스
        </h1>
        <p className="text-white/70 text-xs leading-relaxed mt-2">
          AI가 24시간 답변하고, 쉽고 정확하게 안내해 드리는 새로운 민원 서비스입니다.
        </p>
      </div>

      {/* 글래스모피즘 카드 */}
      <div className="relative z-10 flex flex-col gap-2">
        {[
          { icon: 'chat_bubble',   label: '민원 상담',      desc: 'AI가 신속하고 정확하게 상담' },
          { icon: 'edit_note',     label: '민원 접수',      desc: '간편한 절차로 빠르게 접수' },
          { icon: 'track_changes', label: '민원 현황 확인', desc: '처리 진행 상황을 실시간 확인' },
        ].map((b) => (
          <div key={b.label} className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/20">
            <span className="material-symbols-outlined text-white text-xl">{b.icon}</span>
            <div>
              <p className="text-white font-bold text-xs">{b.label}</p>
              <p className="text-white/60 text-[10px] mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 옵션 C: 로고 중앙 + 플로팅 카드 ── */
function OptionC() {
  return (
    <div className="flex flex-col w-full h-full bg-gradient-to-br from-primary to-[#3a7fd4] px-8 py-8 relative overflow-hidden rounded-3xl shadow-xl">
      <div className="absolute top-[-60px] right-[-60px] w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute bottom-[-40px] left-[-40px] w-44 h-44 rounded-full bg-white/5" />

      {/* 헤드라인 */}
      <div className="relative z-10 mb-4">
        <h1 className="text-2xl font-bold text-white leading-tight">
          마음이와 함께,<br />더 쉽고 빠른 민원 서비스
        </h1>
        <p className="text-white/70 text-xs leading-relaxed mt-2">
          AI가 24시간 답변하고, 쉽고 정확하게<br />안내해 드리는 새로운 민원 서비스입니다.
        </p>
      </div>

      {/* 로고 중앙 + 플로팅 카드 */}
      <div className="flex-1 relative z-10">
        {/* 중앙 원 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-28 h-28 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center">
            <img src={logo} alt="로고" className="h-16 w-auto" />
          </div>
        </div>
        {/* 플로팅 카드들 */}
        <div className="absolute top-0 left-0 bg-white rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">assignment</span>
          <div>
            <p className="text-[10px] text-on-surface-variant">오늘 접수</p>
            <p className="font-bold text-xs text-on-surface">128건</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 bg-white rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
          <div>
            <p className="text-[10px] text-on-surface-variant">완료율</p>
            <p className="font-bold text-xs text-on-surface">98%</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 bg-white rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-base">bolt</span>
          <div>
            <p className="text-[10px] text-on-surface-variant">평균 처리</p>
            <p className="font-bold text-xs text-on-surface">1.8일</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesignPreview() {
  return (
    <div className="min-h-screen bg-slate-100 p-10">
      <p className="text-center text-sm text-slate-400 mb-8 font-bold">디자인 프리뷰 — 마음에 드는 스타일을 선택해 주세요</p>
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-6">
        {[
          { label: 'A — 로고 + 통계 숫자', Component: OptionA },
          { label: 'B — 로고 + 글래스 카드', Component: OptionB },
          { label: 'C — 로고 중앙 + 플로팅', Component: OptionC },
        ].map(({ label, Component }) => (
          <div key={label} className="flex flex-col gap-3">
            <p className="text-sm font-bold text-slate-600 text-center">{label}</p>
            <div className="h-[480px]">
              <Component />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DesignPreview;
