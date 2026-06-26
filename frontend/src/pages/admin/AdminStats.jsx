import AdminLayout from '../../layouts/AdminLayout';

const monthLabels = ['1월','2월','3월','4월','5월','6월'];
const received  = [60, 75, 95, 65, 90, 100];
const resolved  = [52, 68, 88, 60, 82, 93];

const distribution = [
  { label: '생활 불편', count: '524건', pct: 42, color: 'bg-primary' },
  { label: '교통/환경', count: '350건', pct: 28, color: 'bg-navy' },
  { label: '복지/행정', count: '187건', pct: 15, color: 'bg-amber-400' },
  { label: '기타',     count: '187건', pct: 15, color: 'bg-outline-variant' },
];

const deptSpeed = [
  { dept: '교통행정과', days: 1.2, pct: 40 },
  { dept: '환경위생과', days: 1.5, pct: 55 },
  { dept: '사회복지과', days: 2.4, pct: 85 },
  { dept: '도로교통과', days: 3.1, pct: 100 },
];

const repeatTop = [
  { rank: 1, title: '불법주정차 단속 요청', count: 84 },
  { rank: 2, title: '도로 파손 신고',       count: 71 },
  { rank: 3, title: '공원 시설 파손',        count: 58 },
  { rank: 4, title: '가로등 불량',           count: 47 },
  { rank: 5, title: '쓰레기 무단 투기',      count: 39 },
];

function AdminStats() {
  const maxBar = Math.max(...received);

  return (
    <AdminLayout pageTitle="통계 및 인사이트" activeMenu="stats">

      {/* 요약 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: '월 총 민원',      value: '1,248건', icon: 'article',     color: 'text-primary',     bg: 'bg-primary/10' },
          { label: '평균 처리 속도',  value: '1.8일',   icon: 'speed',       color: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: '처리율',          value: '94.2%',   icon: 'task_alt',    color: 'text-navy',        bg: 'bg-navy/10' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-outline-variant p-5 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 월별 추이 + 처리 속도 */}
      <div className="grid grid-cols-12 gap-5 mb-5">

        {/* 월별 민원 발생 / 처리량 */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-on-surface">월별 민원 발생 / 처리량</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">2025년 1월 ~ 6월</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block" />접수</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />처리</span>
            </div>
          </div>
          <div className="flex items-end gap-3 h-44">
            {received.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-1" style={{ height: '160px' }}>
                  <div className="flex-1 bg-primary rounded-t transition-all" style={{ height: `${(h / maxBar) * 100}%` }} />
                  <div className="flex-1 bg-emerald-400 rounded-t transition-all" style={{ height: `${(resolved[i] / maxBar) * 100}%` }} />
                </div>
                <span className="text-[10px] text-on-surface-variant">{monthLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 부서별 처리 속도 */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">부서별 평균 처리 속도</h3>
          <div className="space-y-4">
            {deptSpeed.map((d) => (
              <div key={d.dept}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-on-surface">{d.dept}</span>
                  <span className={`font-bold ${d.pct >= 80 ? 'text-error' : d.pct >= 50 ? 'text-amber-600' : 'text-primary'}`}>{d.days}일</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.pct >= 80 ? 'bg-error' : d.pct >= 50 ? 'bg-amber-400' : 'bg-primary'}`}
                    style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 유형 분포 + 반복 민원 */}
      <div className="grid grid-cols-12 gap-5">

        {/* 민원 유형 분포 */}
        <div className="col-span-12 md:col-span-6 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">주요 민원 유형 분포</h3>
          <div className="space-y-3">
            {distribution.map((d) => (
              <div key={d.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-on-surface">{d.label}</span>
                  <span className="font-bold text-on-surface-variant">{d.count} <span className="text-primary">({d.pct}%)</span></span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 반복 민원 TOP 5 */}
        <div className="col-span-12 md:col-span-6 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">반복 민원 TOP 5</h3>
          <div className="space-y-3">
            {repeatTop.map((r) => (
              <div key={r.rank} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  r.rank <= 3 ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                }`}>{r.rank}</span>
                <span className="flex-1 text-sm font-medium text-on-surface">{r.title}</span>
                <span className="text-sm font-bold text-primary">{r.count}건</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminStats;
