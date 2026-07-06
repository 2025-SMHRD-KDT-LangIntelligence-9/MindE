import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp, CATEGORY_STYLE, URGENCY_STYLE } from '../../store/AppContext';
import { STATUS_STYLE } from '../../utils/statusStyle';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { DEPARTMENTS } from '../../utils/departments';

const CATEGORY_COLORS = {
  '교통':     '#3B82F6',
  '환경':     '#14B8A6',
  '건축':     '#F59E0B',
  '상하수도': '#06B6D4',
  '농축산':   '#10B981',
  '보건위생': '#A855F7',
  '행정':     '#F97316',
  '기타':     '#94A3B8',
};

const PIE_COLORS = [
  '#E74C3C', // 빨강
  '#3498DB', // 파랑
  '#2ECC71', // 초록
  '#F39C12', // 주황
  '#9B59B6', // 보라
  '#1ABC9C', // 청록
  '#E67E22', // 진주황
  '#2980B9', // 진파랑
  '#27AE60', // 진초록
  '#8E44AD', // 진보라
  '#F1C40F', // 노랑
  '#16A085', // 다크청록
  '#C0392B', // 다크빨강
  '#D35400', // 다크주황
  '#7D3C98', // 인디고보라
  '#117A65', // 다크초록
  '#2471A3', // 스틸블루
  '#CB4335', // 코럴레드
  '#1F618D', // 네이비
  '#A93226', // 마룬
];

const DEPT_COLOR_MAP = Object.fromEntries(
  DEPARTMENTS.map((d, i) => [d.name, PIE_COLORS[i % PIE_COLORS.length]])
);


function AdminDashboard() {
  const navigate = useNavigate();
  const { complaints, stats } = useApp();

  const urgentRows = complaints.filter((c) => c.urgency === '긴급').slice(0, 5);

  // 카테고리별 민원 건수
  const categoryCountMap = complaints.reduce((acc, c) => {
    const cat = c.category ?? '기타';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const categoryData = Object.entries(CATEGORY_COLORS)
    .map(([name, color]) => ({ name, value: categoryCountMap[name] || 0, color }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const categoryTotal = categoryData.reduce((s, d) => s + d.value, 0);

  // 금일 부서별 접수 현황
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCountMap = complaints
    .filter((c) => c.createdDate === todayStr && c.dept)
    .reduce((acc, c) => { acc[c.dept] = (acc[c.dept] || 0) + 1; return acc; }, {});
  const todayDeptData = DEPARTMENTS
    .map((dept) => ({ name: dept.name, value: todayCountMap[dept.name] || 0, color: DEPT_COLOR_MAP[dept.name] }))
    .sort((a, b) => b.value - a.value);
  const todayTotal = todayDeptData.reduce((s, d) => s + d.value, 0);

  // 이번달 부서별 접수 현황
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const monthCountMap = complaints
    .filter((c) => c.createdDate?.startsWith(thisMonthStr) && c.dept)
    .reduce((acc, c) => { acc[c.dept] = (acc[c.dept] || 0) + 1; return acc; }, {});
  const monthDeptData = DEPARTMENTS
    .map((dept) => ({ name: dept.name, value: monthCountMap[dept.name] || 0, color: DEPT_COLOR_MAP[dept.name] }))
    .sort((a, b) => b.value - a.value);
  const monthDeptTotal = monthDeptData.reduce((s, d) => s + d.value, 0);

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

      {/* 3개 도넛 차트 */}
      <div className="grid grid-cols-3 gap-5 mb-6">

        {/* 금일 부서별 접수현황 */}
        <div className="bg-white rounded-2xl border border-outline-variant p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">금일 부서별 접수현황</h3>
          <p className="text-xs text-on-surface-variant mb-3">오늘 접수된 민원 {todayTotal}건</p>
          <div className="flex items-center gap-3">
            <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={todayDeptData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={2}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      if (percent < 0.05) return null;
                      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                      return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="700">{`${Math.round(percent * 100)}%`}</text>;
                    }}
                    labelLine={false}
                  >
                    {todayDeptData.filter(d => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>{todayTotal}</span>
                <span style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>건</span>
              </div>
            </div>
            <div className="flex-1 min-w-0" style={{ columns: 3, columnGap: '8px' }}>
              {todayDeptData.map((d) => (
                <div key={d.name} className="flex items-center gap-1 min-w-0 break-inside-avoid mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-on-surface truncate flex-1">{d.name}</span>
                  <span className="text-[10px] font-bold tabular-nums flex-shrink-0 ml-0.5" style={{ color: d.value > 0 ? '#1e3a5f' : '#d1d5db' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 이번달 부서별 접수현황 */}
        <div className="bg-white rounded-2xl border border-outline-variant p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">이번달 부서별 접수현황</h3>
          <p className="text-xs text-on-surface-variant mb-3">이번달 접수된 민원 {monthDeptTotal}건</p>
          <div className="flex items-center gap-3">
            <div style={{ width: 140, height: 140, flexShrink: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={monthDeptData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={2}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      if (percent < 0.05) return null;
                      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                      return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="700">{`${Math.round(percent * 100)}%`}</text>;
                    }}
                    labelLine={false}
                  >
                    {monthDeptData.filter(d => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>{monthDeptTotal}</span>
                <span style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>건</span>
              </div>
            </div>
            <div className="flex-1 min-w-0" style={{ columns: 3, columnGap: '8px' }}>
              {monthDeptData.map((d) => (
                <div key={d.name} className="flex items-center gap-1 min-w-0 break-inside-avoid mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-on-surface truncate flex-1">{d.name}</span>
                  <span className="text-[10px] font-bold tabular-nums flex-shrink-0 ml-0.5" style={{ color: d.value > 0 ? '#1e3a5f' : '#d1d5db' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 카테고리별 민원 건수 */}
        <div className="bg-white rounded-2xl border border-outline-variant p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">카테고리별 민원건수</h3>
          <p className="text-xs text-on-surface-variant mb-3">전체 민원 {categoryTotal}건</p>
          <div className="flex flex-col items-center gap-3">
            <div style={{ width: 150, height: 150, flexShrink: 0, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      if (percent < 0.05) return null;
                      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                      return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="700">{`${Math.round(percent * 100)}%`}</text>;
                    }}
                    labelLine={false}
                  >
                    {categoryData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>{categoryTotal}</span>
                <span style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>건</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-x-3 gap-y-0.5">
              {categoryData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-on-surface flex-1 truncate">{d.name}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
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
          <div className="overflow-x-auto">
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
          </div>
        )}
      </div>

    </AdminLayout>
  );
}

export default AdminDashboard;
