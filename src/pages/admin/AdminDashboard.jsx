import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp, CATEGORY_STYLE, URGENCY_STYLE } from '../../store/AppContext';
import { STATUS_STYLE } from '../../utils/statusStyle';


function AdminDashboard() {
  const navigate = useNavigate();
  const { complaints, stats } = useApp();

  const urgentRows = complaints.filter((c) => c.urgency === '긴급').slice(0, 5);

  // 최근 7일 민원 현황
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const count = complaints.filter((c) => c.receivedAt?.startsWith(dateStr)).length;
    return { date: dateStr.slice(5).replace('-', '/'), count };
  });
  const hasRecentData = last7Days.some((d) => d.count > 0);

  // 부서별 민원 건수 (실제 데이터)
  const deptCountMap = complaints.reduce((acc, c) => {
    if (c.dept) acc[c.dept] = (acc[c.dept] || 0) + 1;
    return acc;
  }, {});
  const deptData = Object.entries(deptCountMap)
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxDeptCount = Math.max(...deptData.map((d) => d.count), 1);

  const total      = complaints.length;
  const cReceived  = complaints.filter((c) => c.status === '접수').length;
  const cUrgent    = complaints.filter((c) => c.urgency === '긴급').length;
  const cProgress  = complaints.filter((c) => c.status === '처리 중').length;
  const cSupplement= complaints.filter((c) => c.status === '보완 요청').length;
  const cRejected  = complaints.filter((c) => c.status === '반려').length;
  const cDone      = complaints.filter((c) => c.status === '완료').length;

  const summaryCards = [
    { label: '총 민원',  value: total,       icon: 'assignment',   color: 'text-[#1e3a5f]',    bg: 'bg-[#1e3a5f]/8' },
    { label: '접수',     value: cReceived,   icon: 'inbox',        color: 'text-blue-600',     bg: 'bg-blue-50' },
    { label: '긴급',     value: cUrgent,     icon: 'priority_high',color: 'text-red-600',      bg: 'bg-red-50' },
    { label: '처리 중',  value: cProgress,   icon: 'pending',      color: 'text-amber-600',    bg: 'bg-amber-50' },
    { label: '보완',     value: cSupplement, icon: 'edit_note',    color: 'text-purple-600',   bg: 'bg-purple-50' },
    { label: '반려',     value: cRejected,   icon: 'cancel',       color: 'text-rose-600',     bg: 'bg-rose-50' },
    { label: '완료',     value: cDone,       icon: 'check_circle', color: 'text-emerald-600',  bg: 'bg-emerald-50' },
  ];


  return (
    <AdminLayout pageTitle="오늘의 대시보드" activeMenu="dashboard">

      {/* 요약 카드 */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-outline-variant p-4 shadow-sm flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-xl ${c.color}`}>{c.icon}</span>
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-on-surface-variant">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 최근 7일 + 부서별 민원 */}
      <div className="grid grid-cols-12 gap-5 mb-6">
        <div className="col-span-8 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-on-surface">최근 7일 민원 접수 현황</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">날짜별 민원 접수 건수</p>
            </div>
          </div>
          {hasRecentData ? (
            <div className="space-y-2">
              {last7Days.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-on-surface-variant w-12 shrink-0">{d.date}</span>
                  <div className="flex-1 h-6 bg-surface-container-low rounded-lg overflow-hidden flex items-center">
                    <div
                      className="h-full bg-primary/70 rounded-lg transition-all"
                      style={{ width: `${Math.max((d.count / Math.max(...last7Days.map(x => x.count), 1)) * 100, d.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-on-surface w-8 text-right shrink-0">{d.count}건</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl text-outline">bar_chart</span>
              <p className="text-sm">최근 7일간 접수된 민원이 없습니다.</p>
              <div className="mt-2 w-full">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      {last7Days.map((d) => (
                        <th key={d.date} className="py-1.5 px-2 font-medium text-on-surface-variant">{d.date}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {last7Days.map((d) => (
                        <td key={d.date} className="py-1.5 px-2 font-bold text-on-surface">{d.count}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-4 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">부서별 민원 현황</h3>
          {deptData.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {deptData.map((d) => {
                const pct = Math.round((d.count / maxDeptCount) * 100);
                return (
                  <div key={d.dept}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-on-surface">{d.dept}</span>
                      <span className="font-bold text-primary">{d.count}건</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 긴급 민원 테이블 */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h3 className="font-bold text-sm text-on-surface">최근 접수된 긴급 민원</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">즉각적인 처리가 필요한 민원입니다.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold text-error bg-error-container px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm">warning</span>
              {urgentRows.length}건 긴급
            </span>
            <button onClick={() => navigate('/admin/monitoring')}
              className="text-xs text-primary font-bold hover:underline">전체 보기 →</button>
          </div>
        </div>
        {urgentRows.length === 0 ? (
          <div className="px-6 py-8 text-center text-on-surface-variant text-sm">긴급 민원이 없습니다.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low/60">
              <tr>
                {['민원번호','카테고리','민원내용','접수자','담당부서','긴급도','접수일자','진행상태'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-bold text-on-surface-variant whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {urgentRows.map((r) => (
                <tr key={r.id}
                  onClick={() => navigate(`/admin/monitoring?id=${r.id}`)}
                  className="hover:bg-surface-container-low/50 cursor-pointer transition-colors">
                  <td className="px-5 py-3 text-xs font-bold text-primary whitespace-nowrap">{r.id}</td>
                  <td className="px-5 py-3">
                    {(() => { const s = CATEGORY_STYLE[r.category] ?? CATEGORY_STYLE['기타']; return <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${s.bg} ${s.text}`}>{r.category}</span>; })()}
                  </td>
                  <td className="px-5 py-3 text-sm text-on-surface max-w-[200px] truncate">{r.title}</td>
                  <td className="px-5 py-3 text-sm text-on-surface-variant whitespace-nowrap">{r.citizen}</td>
                  <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap">{r.dept}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {(() => { const u = URGENCY_STYLE[r.urgency] ?? URGENCY_STYLE['낮음']; return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${u.bg} ${u.text}`}>{r.urgency}</span>; })()}
                  </td>
                  <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap">{r.receivedAt}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[r.status] ? `${STATUS_STYLE[r.status].bg} ${STATUS_STYLE[r.status].text}` : 'bg-surface-container text-on-surface-variant'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </AdminLayout>
  );
}

export default AdminDashboard;
