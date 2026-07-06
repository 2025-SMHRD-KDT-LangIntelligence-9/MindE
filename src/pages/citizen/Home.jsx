import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { useApp } from '../../store/AppContext';
import EmptyState from '../../components/EmptyState';
import { STATUS_STYLE as statusConfig } from '../../utils/statusStyle';
import logo from '../../assets/logo.png';
import heroBg from '../../assets/hero-bg.png';

function Home() {
  const navigate = useNavigate();
  const { stats, currentUser, notifications } = useApp();
  const myComplaints = stats.myComplaints;
  const recentComplaints = myComplaints.slice(0, 3);
  const recentNotifications = notifications.slice(0, 2);
  const complaintTitleMap = Object.fromEntries(myComplaints.map((c) => [c.id, c.title]));
  // 알림 목록(최신순)에서 같은 민원의 한 단계 이전 알림을 찾아 이전 상태로 사용 (없으면 최초 접수 상태)
  const getPrevTag = (n) => {
    const idx = notifications.findIndex((x) => x.id === n.id);
    for (let i = idx + 1; i < notifications.length; i++) {
      if (notifications[i].complaintId === n.complaintId && statusConfig[notifications[i].tag]) {
        return notifications[i].tag;
      }
    }
    return '접수';
  };
  const cReceived   = myComplaints.filter((c) => c.status === '접수').length;
  const cInProgress = myComplaints.filter((c) => ['처리 중', '보완 요청'].includes(c.status)).length;
  const cDone       = myComplaints.filter((c) => c.status === '완료').length;

  return (
    <CitizenLayout pageTitle="대시보드" activeMenu="home" sidebarColor="#aecdfa">
      {/* 환영 히어로 영역 */}
      <section className="relative rounded-3xl p-6 xl:p-10 flex flex-row items-center justify-between gap-6 mb-6 xl:mb-8 overflow-hidden">
        {/* 배경 이미지 */}
        <img src={heroBg} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{ objectPosition: 'center 68%' }} />
        {/* 텍스트 가독성용 오버레이 — 좌측은 밝게, 우측으로 갈수록 투명 */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/45 via-white/30 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-xl xl:text-3xl font-bold text-on-surface mb-2">
            {currentUser.name ? `좋은 아침입니다, ${currentUser.name}님.` : '안녕하세요, 마음이입니다.'}
          </h1>
          <p className="text-on-surface-variant max-w-md">
            시민 여러분의 목소리가 우리 도시를 더 살기 좋게 만듭니다. 마음결은 시민 여러분의 의견을 공감과 투명함으로 경청하겠습니다.
          </p>
          <button onClick={() => navigate('/chatbot')} className="mt-6 bg-primary text-on-primary font-bold py-3 px-8 rounded-xl shadow-md flex items-center gap-2">
            <span className="material-symbols-outlined">add_circle</span>
            민원 신청하기
          </button>
        </div>
        <img src={logo} alt="마음이 로고" className="relative z-10 h-24 sm:h-36 xl:h-48 w-auto drop-shadow-lg shrink-0" />
      </section>

      {/* 상태 요약 카드 3개 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:gap-6 mb-6 xl:mb-8">
        {[
          { label: '접수 완료', value: `${cReceived}건`, icon: 'archive' },
          { label: '처리 중', value: `${cInProgress}건`, icon: 'pending_actions' },
          { label: '처리 완료', value: `${cDone}건`, icon: 'check_circle' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-2xl border border-outline-variant flex flex-row items-center gap-5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">{card.icon}</span>
            </div>
            <div className="text-center text-left">
              <p className="text-[10px] text-sm font-bold text-on-surface-variant mb-1">{card.label}</p>
              <h3 className="text-2xl font-bold text-primary">{card.value}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* 최근 민원 + 바로가기 */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-6">
        <div className="xl:col-span-8 bg-white rounded-2xl p-5 xl:p-8 border border-outline-variant">
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

        <div className="xl:col-span-4 bg-white rounded-2xl p-6 border border-outline-variant flex flex-col">
          {recentNotifications.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-on-surface-variant uppercase">최근 알림</h4>
                <button onClick={() => navigate('/notifications')} className="text-xs text-primary font-bold hover:underline">전체보기</button>
              </div>
              <div className="space-y-1 pb-4 mb-4 border-b border-outline-variant/60">
                {recentNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => navigate(n.complaintId ? `/my-complaints?id=${n.complaintId}` : '/notifications')}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className={`material-symbols-outlined text-base ${n.color ?? 'text-primary'}`}>{n.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{complaintTitleMap[n.complaintId] ?? n.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {statusConfig[n.tag] && (() => {
                          const prevTag = getPrevTag(n);
                          return (
                            <span className="flex items-center gap-1 shrink-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusConfig[prevTag].bg} ${statusConfig[prevTag].text}`}>{prevTag}</span>
                              <span className="text-[9px] text-on-surface-variant">→</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusConfig[n.tag].bg} ${statusConfig[n.tag].text}`}>{n.tag}</span>
                            </span>
                          );
                        })()}
                        <p className="text-[10px] text-on-surface-variant truncate ml-1">{n.time}</p>
                      </div>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            </>
          )}

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
              <button key={item.label} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1.5 py-4 rounded-xl hover:bg-primary/5 transition-colors">
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
