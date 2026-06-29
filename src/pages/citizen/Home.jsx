import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { useApp } from '../../store/AppContext';
import EmptyState from '../../components/EmptyState';
import { STATUS_STYLE as statusConfig } from '../../utils/statusStyle';
import logo from '../../assets/logo.png';

function Home() {
  const navigate = useNavigate();
  const { stats } = useApp();
  const myComplaints = stats.myComplaints;
  const recentComplaints = myComplaints.slice(0, 3);
  const cReceived   = myComplaints.filter((c) => c.status === '접수').length;
  const cInProgress = myComplaints.filter((c) => ['처리 중', '보완 요청'].includes(c.status)).length;
  const cDone       = myComplaints.filter((c) => c.status === '완료').length;

  return (
    <CitizenLayout pageTitle="대시보드" activeMenu="home" sidebarColor="#aecdfa">
      {/* 환영 히어로 영역 */}
      <section className="bg-primary/10 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">좋은 아침입니다, 철수님.</h1>
          <p className="text-on-surface-variant max-w-md">
            철수님의 목소리가 우리 도시를 더 살기 좋게 만듭니다. 마음결은 시민 여러분의 의견을 공감과 투명함으로 경청하겠습니다.
          </p>
          <button onClick={() => navigate('/chatbot')} className="mt-6 bg-primary text-on-primary font-bold py-3 px-8 rounded-xl shadow-md flex items-center gap-2">
            <span className="material-symbols-outlined">add_circle</span>
            민원 신청하기
          </button>
        </div>
        <img src={logo} alt="마음이 로고" className="h-48 w-auto drop-shadow-lg hidden md:block" />
      </section>

      {/* 상태 요약 카드 3개 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: '접수 완료', value: `${cReceived}건`, icon: 'archive' },
          { label: '처리 중', value: `${cInProgress}건`, icon: 'pending_actions' },
          { label: '처리 완료', value: `${cDone}건`, icon: 'check_circle' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-2xl border border-outline-variant flex items-center gap-5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">{card.icon}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface-variant mb-1">{card.label}</p>
              <h3 className="text-2xl font-bold text-primary">{card.value}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* 최근 민원 + 바로가기 */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl p-8 border border-outline-variant">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-on-surface">최근 민원 처리 현황</h4>
            <button onClick={() => navigate('/my-complaints')} className="text-primary text-sm font-bold hover:underline">전체 보기</button>
          </div>
          <div className="space-y-3">
            {recentComplaints.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="접수된 민원이 없습니다"
                desc="AI 챗봇으로 첫 번째 민원을 접수해보세요."
                action={{ label: '민원 신청하기', icon: 'add_circle', onClick: () => navigate('/chatbot') }}
              />
            ) : recentComplaints.map((c) => {
              const cfg = statusConfig[c.status] ?? statusConfig['접수'];
              return (
                <div key={c.id} className="p-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`/my-complaints?id=${c.id}`)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg">description</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface text-sm truncate">{c.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{c.dept} · {c.receivedAt}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {c.status}
                    </span>
                  </div>
                  {c.reply && (
                    <div className="mt-3 ml-13 pl-3 border-l-2 border-emerald-200">
                      <p className="text-xs text-on-surface-variant font-bold mb-0.5">담당자 답변 · {c.replyDate}</p>
                      <p className="text-xs text-on-surface leading-relaxed line-clamp-2">{c.reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-outline-variant flex flex-col">
          <h4 className="text-sm font-bold text-on-surface-variant uppercase mb-4">주요 서비스 바로가기</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'AI 민원상담',    icon: 'smart_toy',        path: '/chatbot' },
              { label: '서류 작성',      icon: 'document_scanner', path: '/document' },
              { label: '민원 내역',      icon: 'history',          path: '/my-complaints' },
              { label: '알림',           icon: 'notifications',    path: '/notifications' },
              { label: '자주 묻는 질문', icon: 'contact_support',  path: '/faq' },
              { label: '설정',           icon: 'settings',         path: '/settings' },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-2 py-4 rounded-xl hover:bg-primary/5 transition-colors">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-5 border-t border-outline-variant/60">
            <div className="flex items-start gap-3 bg-primary/5 rounded-2xl px-4 py-3.5">
              <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">volunteer_activism</span>
              <div>
                <p className="text-xs font-bold text-primary mb-0.5">시민의 목소리가 도시를 만듭니다</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">마음이는 여러분의 의견을 공감과 투명함으로 경청하겠습니다.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CitizenLayout>
  );
}

export default Home;
