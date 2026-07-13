import { useNavigate } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import { useApp } from '../../store/AppContext';
import { STATUS_STYLE as statusStyle } from '../../utils/statusStyle';


function StatusBadge({ status }) {
  const s = statusStyle[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{status}</span>;
}

const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

function StaffStats() {
  const navigate = useNavigate();
  const { myDeptComplaints, currentUser } = useApp();
  const complaints = myDeptComplaints;

  // 이번 주 요일별 접수 건수 계산
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weeklyData = weekDays.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    return complaints.filter((c) => c.createdDate === dateStr).length;
  });
  const maxWeekly = Math.max(...weeklyData, 1);
  const hasWeeklyData = weeklyData.some((v) => v > 0);

  const total      = complaints.length;
  const received   = complaints.filter((c) => c.status === '접수').length;
  const assigned   = complaints.filter((c) => c.status === '배정').length;
  const urgent     = complaints.filter((c) => c.urgency === '긴급').length;
  const inProgress = complaints.filter((c) => c.status === '처리 중').length;
  const supplement = complaints.filter((c) => c.status === '보완 요청').length;
  const rejected   = complaints.filter((c) => c.status === '반려').length;
  const done       = complaints.filter((c) => c.status === '완료').length;

  // 처리 완료율
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // 긴급도 분포
  const normalCount = complaints.filter((c) => c.urgency === '보통').length;
  const lowCount    = complaints.filter((c) => c.urgency === '낮음').length;
  const urgencyData = [
    { label: '긴급', count: urgent,      pct: total > 0 ? Math.round((urgent      / total) * 100) : 0, bar: 'bg-red-400',     text: 'text-red-600' },
    { label: '보통', count: normalCount, pct: total > 0 ? Math.round((normalCount / total) * 100) : 0, bar: 'bg-amber-400',   text: 'text-amber-600' },
    { label: '낮음', count: lowCount,    pct: total > 0 ? Math.round((lowCount    / total) * 100) : 0, bar: 'bg-emerald-400', text: 'text-emerald-600' },
  ];

  // 최근 처리 이력: 접수 이후 상태 변경된 민원, updatedAt 최신순
  const recentHistory = [...complaints]
    .filter((c) => c.status !== '접수')
    .sort((a, b) => (b.updatedAtRaw > a.updatedAtRaw ? 1 : -1))
    .slice(0, 6);

  return (
    <StaffLayout pageTitle="처리 현황" activeMenu="stats">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* 담당 부서 배너 */}
        <div className="flex items-center gap-3 bg-[#1e3a5f]/8 border border-[#1e3a5f]/20 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-[#1e3a5f] text-lg">business</span>
          <span className="text-sm font-bold text-[#1e3a5f]">{currentUser.dept}</span>
          <span className="text-xs text-on-surface-variant">담당 부서 통계만 집계됩니다.</span>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: '총 민원', value: total,       icon: 'assignment',   color: 'text-[#1e3a5f]',  bg: 'bg-[#1e3a5f]/8' },
            { label: '접수',    value: received,    icon: 'inbox',        color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: '배정',    value: assigned,    icon: 'person_add',   color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: '긴급',    value: urgent,      icon: 'priority_high',color: 'text-red-600',    bg: 'bg-red-50' },
            { label: '처리 중', value: inProgress,  icon: 'pending',      color: 'text-amber-600',  bg: 'bg-amber-50' },
            { label: '보완',    value: supplement,  icon: 'edit_note',    color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '반려',    value: rejected,    icon: 'cancel',       color: 'text-rose-600',   bg: 'bg-rose-50' },
            { label: '완료',    value: done,        icon: 'check_circle', color: 'text-emerald-600',bg: 'bg-emerald-50' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-outline-variant shadow-sm p-4 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-xl ${c.color}`}>{c.icon}</span>
              </div>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-on-surface-variant">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* 처리 완료율 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#1e3a5f] text-lg">task_alt</span>
              <h3 className="font-bold text-sm text-on-surface">처리 완료율</h3>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <p className="text-4xl font-bold text-emerald-600">{completionRate}<span className="text-xl ml-1">%</span></p>
              <p className="text-xs text-on-surface-variant">{done}건 완료 / 총 {total}건</p>
              <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          {/* 긴급도 분포 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#1e3a5f] text-lg">priority_high</span>
              <h3 className="font-bold text-sm text-on-surface">긴급도 분포</h3>
            </div>
            <div className="space-y-3">
              {urgencyData.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${d.text}`}>{d.label}</span>
                    <span className="text-xs text-on-surface-variant">{d.count}건 ({d.pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.bar}`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 요일별 접수 현황 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[#1e3a5f] text-lg">bar_chart</span>
              <h3 className="font-bold text-sm text-on-surface">이번 주 요일별 접수</h3>
            </div>
            {hasWeeklyData ? (
              <div className="flex items-end justify-between gap-2 h-36 mt-13">
                {weeklyData.map((count, i) => (
                  <div key={weekDays[i]} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-on-surface-variant">{count}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                      <div className="w-full rounded-t-lg transition-all bg-primary"
                        style={{ height: `${(count / maxWeekly) * 96}px` }} />
                    </div>
                    <span className="text-[11px] text-on-surface-variant">{weekDays[i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <p className="text-sm text-on-surface-variant">이번 주 접수된 민원이 없습니다.</p>
                <table className="w-full text-xs text-center border-collapse mt-1">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      {weekDays.map((d) => (
                        <th key={d} className="py-1.5 px-2 font-medium text-on-surface-variant">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {weeklyData.map((count, i) => (
                        <td key={weekDays[i]} className="py-1.5 px-2 font-bold text-on-surface">{count}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 처리 상태 변경 이력 */}
        <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#1e3a5f] text-lg">history</span>
            <h3 className="font-bold text-sm text-on-surface">최근 처리 이력</h3>
          </div>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">처리 이력이 없습니다.</p>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {recentHistory.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(c.urgency === '긴급' ? `/staff/urgent?id=${c.id}` : `/staff?id=${c.id}`)}
                  className="flex items-center gap-4 py-3 cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span className="text-[11px] text-on-surface-variant shrink-0 w-28">{c.updatedAt}</span>
                  <span className="text-[11px] text-primary font-bold shrink-0">{c.id}</span>
                  <p className="text-sm text-on-surface flex-1 truncate">{c.title}</p>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </StaffLayout>
  );
}

export default StaffStats;
