import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp, CATEGORY_STYLE, URGENCY_STYLE } from '../../store/AppContext';
import { STATUS_STYLE } from '../../utils/statusStyle';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import WordCloud from 'react-d3-cloud';
import { DEPARTMENTS } from '../../utils/departments';
import { getStatsHotClustersApi } from '../../api/stats';

const PIE_COLORS = ['#4472C4', '#FF9F43', '#54A7E0', '#00B4D8', '#7B68EE', '#FF6384', '#36A2EB', '#4BC0C0', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

const DEPT_COLOR_MAP = Object.fromEntries(
  DEPARTMENTS.map((d, i) => [d.name, PIE_COLORS[i % PIE_COLORS.length]])
);


function AdminDashboard() {
  const navigate = useNavigate();
  const { complaints, stats } = useApp();

  const [clusterWords, setClusterWords] = useState([]);
  useEffect(() => {
    getStatsHotClustersApi()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.clusters ?? []);
        setClusterWords(
          list
            .filter((c) => c.representative_content && c.complaint_count > 0)
            .map((c) => ({ text: c.representative_content, value: c.complaint_count }))
            .sort((a, b) => b.value - a.value)
        );
      })
      .catch(() => {});
  }, []);

  const urgentRows = complaints.filter((c) => c.urgency === '긴급').slice(0, 5);

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-3 md:mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-outline-variant p-2 md:p-4 shadow-sm flex flex-col items-center gap-1 md:gap-2">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-base md:text-xl ${c.color}`}>{c.icon}</span>
            </div>
            <p className={`text-base md:text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-on-surface-variant">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 3개 도넛 차트 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 mb-3 md:mb-6">

        {/* 금일 부서별 접수현황 */}
        <div className="bg-white rounded-2xl border border-outline-variant p-3 md:p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">금일 부서별 접수현황</h3>
          <p className="text-xs text-on-surface-variant mb-3">오늘 접수된 민원 {todayTotal}건</p>
          <div className="flex items-start gap-3">
            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={todayDeptData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {todayDeptData.filter(d => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
                    <Label content={({ viewBox: { cx, cy } }) => (
                      <text textAnchor="middle">
                        <tspan x={cx} y={cy - 4} fontSize={15} fontWeight="700" fill="#1e3a5f">{todayTotal}</tspan>
                        <tspan x={cx} y={cy + 11} fontSize={9} fill="#6b7280">건</tspan>
                      </text>
                    )} position="center" />
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
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
        <div className="bg-white rounded-2xl border border-outline-variant p-3 md:p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">이번달 부서별 접수현황</h3>
          <p className="text-xs text-on-surface-variant mb-3">이번달 접수된 민원 {monthDeptTotal}건</p>
          <div className="flex items-start gap-3">
            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={monthDeptData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {monthDeptData.filter(d => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
                    <Label content={({ viewBox: { cx, cy } }) => (
                      <text textAnchor="middle">
                        <tspan x={cx} y={cy - 4} fontSize={15} fontWeight="700" fill="#1e3a5f">{monthDeptTotal}</tspan>
                        <tspan x={cx} y={cy + 11} fontSize={9} fill="#6b7280">건</tspan>
                      </text>
                    )} position="center" />
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
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

        {/* 반복민원 키워드 */}
        <div className="bg-white rounded-2xl border border-outline-variant p-3 md:p-5 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-0.5">반복민원 키워드</h3>
          <p className="text-xs text-on-surface-variant mb-3">반복 접수된 민원 클러스터</p>
          {clusterWords.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-6">클러스터 데이터가 없습니다.</p>
          ) : (
            <div style={{ height: 220 }}>
              <WordCloud
                data={clusterWords}
                width={500}
                height={220}
                font="Noto Sans KR, Malgun Gothic, sans-serif"
                fontWeight="bold"
                fontSize={(d) => Math.sqrt(d.value) * 12}
                rotate={(_, i) => (i % 3 === 0 ? 90 : 0)}
                padding={3}
                fill={(_, i) => PIE_COLORS[i % PIE_COLORS.length]}
              />
            </div>
          )}
        </div>

      </div>

      {/* 긴급 민원 테이블 */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-outline-variant">
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
