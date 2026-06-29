import { useMemo } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp } from '../../store/AppContext';

const DIST_COLORS = ['bg-primary', 'bg-navy', 'bg-amber-400', 'bg-teal-400', 'bg-purple-400', 'bg-outline-variant'];

function AdminStats() {
  const { complaints } = useApp();

  const getYM = (str) => {
    if (!str) return null;
    const kr = str.match(/(\d{4})\.\s*(\d{1,2})\./);
    if (kr) return { year: +kr[1], month: +kr[2] };
    const iso = str.match(/^(\d{4})-(\d{2})/);
    if (iso) return { year: +iso[1], month: +iso[2] };
    return null;
  };

  const monthData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const rx = complaints.filter((c) => {
        const ym = getYM(c.receivedAt);
        return ym && ym.year === year && ym.month === month;
      }).length;
      const rs = complaints.filter((c) => {
        const ym = getYM(c.updatedAt);
        return ym && ym.year === year && ym.month === month && c.status === '완료';
      }).length;
      return { label: `${month}월`, received: rx, resolved: rs };
    });
  }, [complaints]);

  const maxBar = Math.max(...monthData.map((d) => d.received), 1);

  const total = complaints.length;
  const done  = complaints.filter((c) => c.status === '완료').length;
  const rate  = total > 0 ? Math.round((done / total) * 100) : 0;

  const catMap = complaints.reduce((acc, c) => {
    const key = c.category || '기타';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const distribution = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label, count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

  const titleMap = complaints.reduce((acc, c) => {
    if (c.title) acc[c.title] = (acc[c.title] || 0) + 1;
    return acc;
  }, {});
  const repeatTop = Object.entries(titleMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count], i) => ({ rank: i + 1, title, count }));

  const deptMap = complaints.reduce((acc, c) => {
    if (c.dept) acc[c.dept] = (acc[c.dept] || 0) + 1;
    return acc;
  }, {});
  const deptData = Object.entries(deptMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([dept, count]) => ({ dept, count }));
  const maxDept = Math.max(...deptData.map((d) => d.count), 1);

  return (
    <AdminLayout pageTitle="통계 및 인사이트" activeMenu="stats">

      {/* 요약 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: '총 민원',   value: `${total}건`, icon: 'article',  color: 'text-primary',   bg: 'bg-primary/10' },
          { label: '처리 완료', value: `${done}건`,  icon: 'task_alt', color: 'text-navy',      bg: 'bg-navy/10' },
          { label: '처리율',    value: `${rate}%`,   icon: 'speed',    color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* 월별 추이 + 부서별 민원 건수 */}
      <div className="grid grid-cols-12 gap-5 mb-5">

        {/* 월별 민원 발생 / 처리량 */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-on-surface">월별 민원 발생 / 처리량</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">최근 6개월</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block" />접수</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />완료</span>
            </div>
          </div>
          {total === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-12">데이터가 없습니다.</p>
          ) : (
            <div className="flex items-end gap-3 h-44">
              {monthData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-1" style={{ height: '160px' }}>
                    <div className="flex-1 bg-primary rounded-t transition-all" style={{ height: `${(d.received / maxBar) * 100}%` }} />
                    <div className="flex-1 bg-emerald-400 rounded-t transition-all" style={{ height: `${(d.resolved / maxBar) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-on-surface-variant">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 부서별 민원 건수 */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">부서별 민원 건수</h3>
          {deptData.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {deptData.map((d) => (
                <div key={d.dept}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-on-surface">{d.dept}</span>
                    <span className="font-bold text-primary">{d.count}건</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 유형 분포 + 반복 민원 */}
      <div className="grid grid-cols-12 gap-5">

        {/* 민원 유형 분포 */}
        <div className="col-span-12 md:col-span-6 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">주요 민원 유형 분포</h3>
          {distribution.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {distribution.map((d, i) => (
                <div key={d.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-on-surface">{d.label}</span>
                    <span className="font-bold text-on-surface-variant">{d.count}건 <span className="text-primary">({d.pct}%)</span></span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${DIST_COLORS[i % DIST_COLORS.length]}`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 반복 민원 TOP 5 */}
        <div className="col-span-12 md:col-span-6 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">반복 민원 TOP 5</h3>
          {repeatTop.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">데이터가 없습니다.</p>
          ) : (
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
          )}
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminStats;
