import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

function Landing() {
  const navigate = useNavigate();
  const [flowIndex, setFlowIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);

  const steps = [
    { title: '마음을 전하는 접수', desc: '격식에 얽매이지 않고 편안하게 고민을 남겨주세요.', icon: 'edit_note', highlight: false },
    { title: '결 AI의 정밀 분석', desc: '인공지능이 민원의 기술적 요건과 시급성을 분석해 담당자에게 연결합니다.', icon: 'psychology', highlight: false },
    { title: '공감 어린 답변', desc: '문제 해결은 물론, 시민의 마음까지 어루만지는 답변으로 신뢰 행정을 실천합니다.', icon: 'volunteer_activism', highlight: false },
  ];

  const features = [
    { icon: 'smart_toy', title: 'AI 민원 상담', desc: '24시간 언제든지 AI 챗봇이 민원 접수를 도와드립니다.' },
    { icon: 'track_changes', title: '실시간 처리 현황', desc: '접수한 민원의 처리 단계를 실시간으로 확인할 수 있습니다.' },
    { icon: 'notifications_active', title: '즉시 알림', desc: '민원 상태가 변경되면 즉시 알림으로 안내해 드립니다.' },
    { icon: 'verified_user', title: '안전한 개인정보', desc: '시민의 개인정보는 철저한 보안 체계로 안전하게 보호됩니다.' },
  ];

  const stats = [
    { value: '12,400+', label: '누적 민원 처리' },
    { value: '1.8일', label: '평균 처리 속도' },
    { value: '24시간', label: '언제든 접수 가능' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setFlowIndex((i) => (i + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [steps.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((i) => (i + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [features.length]);

  const currentStep = steps[flowIndex];
  const currentFeature = features[featureIndex];

  return (
    <div className="min-h-screen bg-background">

      {/* 네비게이션 */}
      <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between h-16 px-6 md:px-12 bg-white/80 backdrop-blur-md border-b border-outline-variant">
        <img src={logo} alt="마음이 로고" className="h-18 w-auto" />
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="text-sm font-bold text-primary px-4 py-2">로그인</button>
          <button onClick={() => navigate('/register')} className="bg-primary text-white text-sm font-bold px-6 py-2 rounded-full">회원가입</button>
        </div>
      </nav>

      <main className="pt-16">

        {/* 히어로 */}
        <section className="bg-white px-6 md:px-12 py-20 md:py-28 relative overflow-hidden">
          <img
            src={logo}
            alt=""
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] opacity-[0.08] pointer-events-none select-none"
          />
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">

            {/* 왼쪽 텍스트 */}
            <div className="translate-x-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-6">
                <span className="material-symbols-outlined text-base">verified_user</span>
                시민을 위한 따뜻한 혁신, 공감 행정
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-primary leading-tight mb-6">
                기관과 시민의 마음을
                <br />
                <span className="text-secondary">공감</span>으로 잇는 '마음이'
              </h1>
              <p className="text-on-surface-variant text-lg max-w-lg mb-8 leading-relaxed">
                마음이는 AI 기반 정밀 분석을 통해 시민의 고충을 깊이 이해하고,
                기관이 진심 어린 행정으로 응답할 수 있도록 돕습니다.
              </p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => navigate('/register')} className="bg-primary text-white py-4 px-10 rounded-xl text-base font-bold shadow-lg flex items-center gap-2">
                  무료로 시작하기
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* 오른쪽: 슬라이드 패널 */}
            <div className="hidden md:flex flex-col h-[460px] rounded-3xl bg-white border border-outline-variant shadow-md overflow-hidden translate-x-30">

              {/* 상단: 민원 처리 흐름 */}
              <div className="flex-1 flex flex-col p-5 border-b border-outline-variant">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-lg">linear_scale</span>
                  <span className="text-xs font-bold text-on-surface">민원 처리 흐름</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] font-bold text-outline">0{flowIndex + 1} / 0{steps.length}</span>
                    <button
                      onClick={() => setFlowIndex((i) => (i - 1 + steps.length) % steps.length)}
                      className="w-7 h-7 rounded-full border border-outline-variant flex items-center justify-center hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_left</span>
                    </button>
                    <button
                      onClick={() => setFlowIndex((i) => (i + 1) % steps.length)}
                      className="w-7 h-7 rounded-full border border-outline-variant flex items-center justify-center hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* 카드 */}
                <div
                  key={`flow-${flowIndex}`}
                  className={`flex-1 flex items-center gap-4 px-4 py-4 rounded-2xl animate-fadein ${
                    currentStep.highlight ? 'bg-primary' : 'bg-slate-50'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                    currentStep.highlight ? 'bg-white/20' : 'bg-primary/10'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl ${currentStep.highlight ? 'text-white' : 'text-primary'}`}>
                      {currentStep.icon}
                    </span>
                  </div>
                  <div>
                    <p className={`font-bold text-base mb-1.5 ${currentStep.highlight ? 'text-white' : 'text-on-surface'}`}>
                      {currentStep.title}
                    </p>
                    <p className={`text-sm leading-relaxed ${currentStep.highlight ? 'text-white/80' : 'text-on-surface-variant'}`}>
                      {currentStep.desc}
                    </p>
                  </div>
                </div>

                {/* 점 인디케이터 */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFlowIndex(i)}
                      className={`rounded-full transition-all ${
                        flowIndex === i ? 'w-5 h-2 bg-primary' : 'w-2 h-2 bg-outline-variant'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* 하단: 주요 서비스 */}
              <div className="flex-1 flex flex-col p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-lg">apps</span>
                  <span className="text-xs font-bold text-on-surface">주요 서비스</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] font-bold text-outline">0{featureIndex + 1} / 0{features.length}</span>
                    <button
                      onClick={() => setFeatureIndex((i) => (i - 1 + features.length) % features.length)}
                      className="w-7 h-7 rounded-full border border-outline-variant flex items-center justify-center hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_left</span>
                    </button>
                    <button
                      onClick={() => setFeatureIndex((i) => (i + 1) % features.length)}
                      className="w-7 h-7 rounded-full border border-outline-variant flex items-center justify-center hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* 카드 */}
                <div
                  key={`feature-${featureIndex}`}
                  className="flex-1 flex items-center gap-4 px-4 py-4 rounded-2xl bg-slate-50 animate-fadein"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-3xl text-primary">{currentFeature.icon}</span>
                  </div>
                  <div>
                    <p className="font-bold text-base text-on-surface mb-1.5">{currentFeature.title}</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{currentFeature.desc}</p>
                  </div>
                </div>

                {/* 점 인디케이터 */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {features.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFeatureIndex(i)}
                      className={`rounded-full transition-all ${
                        featureIndex === i ? 'w-5 h-2 bg-primary' : 'w-2 h-2 bg-outline-variant'
                      }`}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 통계 */}
        <section className="bg-primary py-14 px-6 md:px-12">
          <div className="max-w-6xl mx-auto grid grid-cols-3 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold mb-1 text-white">{s.value}</p>
                <p className="text-white/70 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>


      </main>

      <footer className="bg-white border-t border-outline-variant py-10 px-6 md:px-12 text-center text-xs text-on-surface-variant">
        © 2024 마음이(Maum-i). All rights reserved.
      </footer>
    </div>
  );
}

export default Landing;
