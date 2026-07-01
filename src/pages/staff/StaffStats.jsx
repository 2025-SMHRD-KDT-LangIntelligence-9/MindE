import { useNavigate } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import { useApp } from '../../store/AppContext';
import { STATUS_STYLE as statusStyle } from '../../utils/statusStyle';

const barColors    = ['bg-sky-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-400', 'bg-purple-400'];

const CATEGORIES = ['도로/교통', '시설/안전', '환경/위생', '시설/환경', '교통/주차', '교통/안전'];

function StatusBadge({ status }) {
  const s = statusStyle[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{status}</span>;
}

const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

function StaffStats() {
  const navigate = useNavigate();
  const { myDeptComplaints, currentUser, notifications } = useApp();
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
    return complaints.filter((c) => c.receivedAt?.startsWith(dateStr)).length;
  });
  const maxWeekly = Math.max(...weeklyData, 1);
  const hasWeeklyData = weeklyData.some((v) => v > 0);

  const total      = complaints.length;
  const received   = complaints.filter((c) => c.status === '접수').length;
  const urgent     = complaints.filter((c) => c.urgency === '긴급').length;
  const inProgress = complaints.filter((c) => c.status === '처리 중').length;
  const supplement = complaints.filter((c) => c.status === '보완 요청').length;
  const rejected   = complaints.filter((c) => c.status === '반려').length;
  const done       = complaints.filter((c) => c.status === '완료').length;

  // 유형별 분포
  const categoryData = CATEGORIES.map((cat) => {
    const count = complaints.filter((c) => c.category === cat).length;
    return { label: cat, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  }).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);

  // 최근 상태 변경 이력 (알림에서 추출)
  const recentHistory = notifications.slice(0, 6);

  return (
    <StaffLayout pageTitle="처리 현황" activeMenu="stats">
      <div className="max-w-6xl mx-auto space-y-3 md:space-y-5">

        {/* 담당 부서 배너 */}
        <div className="flex items-center gap-3 bg-[#1e3a5f]/8 border border-[#1e3a5f]/20 rounded-xl px-3 md:px-5 py-2 md:py-3">
          <span className="material-symbols-outlined text-[#1e3a5f] text-lg">business</span>
          <span className="text-sm font-bold text-[#1e3a5f]">{currentUser.dept}</span>
          <span className="text-xs text-on-surface-variant">담당 부서 통계만 집계됩니다.</span>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: '총 민원', value: total,       icon: 'assignment',   color: 'text-[#1e3a5f]',  bg: 'bg-[#1e3a5f]/8' },
            { label: '접수',    value: received,    icon: 'inbox',        color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: '긴급',    value: urgent,      icon: 'priority_high',color: 'text-red-600',    bg: 'bg-red-50' },
            { label: '처리 중', value: inProgress,  icon: 'pending',      color: 'text-amber-600',  bg: 'bg-amber-50' },
            { label: '보완',    value: supplement,  icon: 'edit_note',    color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '반려',    value: rejected,    icon: 'cancel',       color: 'text-rose-600',   bg: 'bg-rose-50' },
            { label: '완료',    value: done,        icon: 'check_circle', color: 'text-emerald-600',bg: 'bg-emerald-50' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-outline-variant shadow-sm p-2 md:p-4 flex flex-col items-center gap-1 md:gap-2">
              <div className={`w-7 h-7 md:w-10 md:h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-base md:text-xl ${c.color}`}>{c.icon}</span>
              </div>
              <p className={`text-base md:text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-on-surface-variant">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
          {/* 민원 유형별 분포 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-3 md:p-5">
            <div className="flex items-center gap-2 mb-3 md:mb-5">
              <span className="material-symbols-outlined text-[#1e3a5f] text-lg">donut_large</span>
              <h3 className="font-bold text-sm text-on-surface">민원 유형별 분포</h3>
              <span className="text-xs text-on-surface-variant ml-auto">총 {total}건</span>
            </div>
            {categoryData.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">데이터 없음</p>
            ) : (
              <div className="space-y-3">
                {categoryData.map((d, i) => (
                  <div key={d.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-on-surface font-medium">{d.label}</span>
                      <span className="text-xs text-on-surface-variant">{d.count}건 ({d.pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                        style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 요일별 접수 현황 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-3 md:p-5">
            <div className="flex items-center gap-2 mb-3 md:mb-5">
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
        <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-3 md:p-5">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span className="material-symbols-outlined text-[#1e3a5f] text-lg">history</span>
            <h3 className="font-bold text-sm text-on-surface">최근 처리 이력</h3>
          </div>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">처리 이력이 없습니다.</p>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {recentHistory.map((n) => {
                const complaint = complaints.find((c) => c.id === n.complaintId);
                const isUrgent = complaint?.urgency === '긴급';
                return (
                  <div
                    key={n.id}
                    onClick={() => navigate(isUrgent ? `/staff/urgent?id=${n.complaintId}` : `/staff?id=${n.complaintId}`)}
                    className="flex items-center gap-4 py-3 cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <span className="text-[11px] text-on-surface-variant shrink-0 w-20">{n.time}</span>
                    <span className="text-[11px] text-primary font-bold shrink-0">{n.complaintId}</span>
                    <p className="text-sm text-on-surface flex-1 truncate">{n.desc}</p>
                    <StatusBadge status={n.tag} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </StaffLayout>
  );
}

export default StaffStats;
