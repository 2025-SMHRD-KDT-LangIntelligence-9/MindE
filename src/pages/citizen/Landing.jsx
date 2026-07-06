import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import landingBg from '../../assets/hero-bg.png';
import { useApp } from '../../store/AppContext';

function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { stats, publicStats } = useApp();

  const [showWithdrawn, setShowWithdrawn] = useState(!!location.state?.withdrawn);

  useEffect(() => {
    if (!location.state?.withdrawn) return;
    window.history.replaceState({}, '');
  }, []);


  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/30">

      {/* 네비게이션 */}
      <nav className="shrink-0 flex items-center justify-between h-12 xl:h-16 px-3 xl:px-14 border-b border-outline-variant/60 bg-blue-50/80 backdrop-blur-md z-50">
        <img src={logo} alt="마음이 로고" className="h-8 xl:h-16 w-auto" />
        <div className="flex items-center gap-1.5 xl:gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-xs xl:text-sm font-bold text-on-surface-variant px-2.5 py-1 xl:px-5 xl:py-2 rounded-lg xl:rounded-xl hover:bg-surface-container transition-colors"
          >
            로그인
          </button>
          <button
            onClick={() => navigate('/register')}
            className="bg-primary text-white text-xs xl:text-sm font-bold px-3 py-1.5 xl:px-6 xl:py-2.5 rounded-lg xl:rounded-xl shadow-sm shadow-primary/20 hover:brightness-105 transition-all"
          >
            회원가입
          </button>
        </div>
      </nav>

      {/* 메인 영역 */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* 히어로 그리드 */}
        <div className="flex-1 flex items-center px-4 py-4 xl:py-0 xl:px-14 relative overflow-hidden">

          {/* 배경 일러스트 이미지 */}
          <img
            src={landingBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none select-none saturate-115 contrast-102"
          />
          {/* 콘텐츠 가독성용 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/32 via-white/10 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col xl:flex-row items-center justify-center gap-8 xl:gap-50 w-full">

            {/* ── 챗봇 목업: 데스크탑만 표시(모바일은 한 화면 유지 위해 숨김) ── */}
            <div className="hidden xl:block order-2 w-auto">

              {/* 모바일 미니 챗봇 프리뷰 */}
              <div className="hidden w-full rounded-2xl border border-outline-variant/60 shadow-lg overflow-hidden bg-white/90 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-primary to-blue-400 px-3 py-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-xs">smart_toy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-xs">마음이 AI 민원 상담</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <div className="px-3 py-2 space-y-2 bg-gradient-to-b from-slate-50 to-white">
                  <div className="flex gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-white text-xs">smart_toy</span>
                    </div>
                    <div className="bg-white border border-outline-variant/50 rounded-xl rounded-tl-sm px-2.5 py-1.5 shadow-sm">
                      <p className="text-[11px] text-on-surface leading-snug">안녕하세요! 😊 불편하신 사항을 말씀해 주세요.</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-row-reverse">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-primary text-xs">person</span>
                    </div>
                    <div className="bg-primary rounded-xl rounded-tr-sm px-2.5 py-1.5">
                      <p className="text-[11px] text-white leading-snug">도로 파손으로 차량이 손상됐어요.</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-white text-xs">smart_toy</span>
                    </div>
                    <div className="bg-white border border-outline-variant/50 rounded-xl rounded-tl-sm px-2.5 py-1.5 shadow-sm">
                      <p className="text-[11px] text-on-surface leading-snug mb-1">국가배상법에 따라 보상 신청 가능합니다! 아래 서류를 준비해 주세요.</p>
                      <div className="space-y-0.5">
                        {['사고 현장 사진', '차량 수리 견적서', '사고 경위서'].map((item) => (
                          <div key={item} className="flex items-center gap-1 text-[10px] text-primary font-bold">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-2">
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full bg-primary text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">edit_document</span>
                    민원 바로 접수하기
                  </button>
                </div>
              </div>

              {/* 데스크탑 풀 챗봇 목업 */}
              <div className="flex justify-center xl:justify-end">
                <div className="w-full max-w-[400px] bg-white rounded-2xl border border-outline-variant shadow-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-blue-400 px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">마음이 AI 민원 상담</p>
                      <p className="text-white/70 text-xs">온라인 · 24시간 응답 가능</p>
                    </div>
                    <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="px-4 py-5 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                      </div>
                      <div className="bg-white border border-outline-variant/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[260px]">
                        <p className="text-xs text-on-surface leading-relaxed">안녕하세요! 😊<br />불편하신 사항을 편하게 말씀해 주세요.</p>
                        <p className="text-[10px] text-on-surface-variant mt-1.5">마음이 · 오전 10:24</p>
                      </div>
                    </div>
                    <div className="flex gap-2.5 flex-row-reverse">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-sm">person</span>
                      </div>
                      <div className="bg-primary rounded-2xl rounded-tr-sm px-4 py-3 max-w-[240px]">
                        <p className="text-xs text-white leading-relaxed">도로 파손으로 차량이 손상됐어요. 보상 받을 수 있나요?</p>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                      </div>
                      <div className="bg-white border border-outline-variant/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[260px]">
                        <p className="text-xs text-on-surface leading-relaxed">국가배상법에 따라 보상 신청이 가능합니다! 아래 서류를 준비해 주세요.</p>
                        <div className="mt-2 space-y-1">
                          {['사고 현장 사진', '차량 수리 견적서', '사고 경위서'].map((item) => (
                            <div key={item} className="flex items-center gap-1.5 text-[10px] text-primary font-bold">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              {item}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-1.5">마음이 · 오전 10:25</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="w-full bg-primary text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20">
                      <span className="material-symbols-outlined text-sm">edit_document</span>
                      민원 바로 접수하기
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 모바일: 아래쪽 / 데스크탑: 왼쪽 ── */}
            <div className="order-1 flex flex-col gap-6">

              {/* 배지 */}
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold w-fit">
                <span className="material-symbols-outlined text-base">verified_user</span>
                AI 기반 공공 민원 서비스
              </div>

              {/* 헤드라인 */}
              <h1 className="text-3xl xl:text-5xl font-bold text-on-surface leading-tight">
                시민의 목소리를<br />
                <span className="text-primary">AI</span>가 빠르게<br />
                전달합니다
              </h1>

              {/* 설명 */}
              <p className="block text-on-surface-variant text-base leading-relaxed max-w-md">
                복잡한 민원 절차, 마음이에게 맡기세요.<br />
                24시간 AI 상담부터 실시간 처리 현황까지 한 번에.
              </p>

              {/* 통계 */}
              <div className="flex items-center gap-6">
                {[
                  { value: `${publicStats?.resolved ?? stats.done}건`, label: '누적 처리' },
                  { value: `${publicStats?.total ?? stats.total}건`, label: '총 접수' },
                  { value: '24시간',  label: '접수 가능' },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-6">
                    <div>
                      <p className="text-xl font-bold text-primary">{s.value}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
                    </div>
                    {i < 2 && <div className="w-px h-8 bg-outline-variant" />}
                  </div>
                ))}
              </div>

              {/* CTA (데스크탑만) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="flex items-center gap-2 bg-primary text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:brightness-105 transition-all text-sm"
                >
                  민원 접수하기
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            </div>


          </div>
        </div>

        {/* ── 하단 서비스 특징 바 ── */}
        <div className="shrink-0 border-t border-outline-variant/60 bg-gradient-to-r from-emerald-50/80 via-sky-50/80 to-emerald-50/80 backdrop-blur-md relative z-10">
          <div className="max-w-6xl mx-auto grid grid-cols-2 xl:grid-cols-4 xl:divide-x divide-outline-variant/40">
            {[
              { icon: 'smart_toy',     label: 'AI 상담',    desc: '24시간 AI 챗봇으로\n민원을 접수하세요',   bg: 'bg-primary/10',  text: 'text-primary' },
              { icon: 'track_changes', label: '실시간 현황', desc: '민원 처리 현황을\n실시간 확인하세요',    bg: 'bg-emerald-100', text: 'text-emerald-600' },
              { icon: 'notifications', label: '즉시 알림',  desc: '상태 변경 시 즉시\n알림을 받으세요',     bg: 'bg-amber-100',   text: 'text-amber-500' },
              { icon: 'verified_user', label: '안전 보호',  desc: '개인정보를\n철저히 보호합니다',         bg: 'bg-cyan-100',    text: 'text-cyan-600' },
            ].map((f) => (
              <div key={f.label} className="flex flex-row items-center xl:items-start gap-2.5 xl:gap-5 px-3 py-2.5 xl:px-8 xl:py-10">
                <div className={`w-9 h-9 xl:w-16 xl:h-16 rounded-2xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined ${f.text} text-xl xl:text-3xl`}>{f.icon}</span>
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm xl:text-base font-bold text-on-surface">{f.label}</p>
                  <p className="hidden xl:block text-xs text-on-surface-variant xl:mt-1.5 leading-relaxed whitespace-pre-line">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* 회원탈퇴 완료 모달 */}
      {showWithdrawn && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowWithdrawn(false)}>
          <div className="flex flex-col items-center gap-4 bg-white border border-outline-variant px-8 xl:px-10 py-8 rounded-3xl shadow-2xl w-full max-w-[360px] mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-primary">favorite</span>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-on-surface mb-1">감사합니다</p>
              <p className="text-sm text-on-surface-variant text-center">
                그동안 마음이 서비스를 이용해 주셔서<br />진심으로 감사드립니다.
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawn(false)}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-105 shadow-md shadow-primary/25"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Landing;
