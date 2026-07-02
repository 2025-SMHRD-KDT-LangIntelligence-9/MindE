import { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getAllStatsApi } from '../../api/stats';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#2563eb', '#0ea5e9', '#f59e0b', '#14b8a6', '#a855f7', '#ef4444', '#64748b', '#84cc16'];
const URGENCY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981' };

const STATUS_KO = {
  received: '접수', assigned: '배정', in_progress: '처리중', answered: '답변완료',
  closed: '종료', rejected: '반려', needs_more_info: '보완요청',
};

const pct = (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—');
const mmdd = (d) => (d ? d.slice(5) : '');

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-outline-variant p-3 md:p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function ChartTitle({ title, sub }) {
  return (
    <div className="mb-3 md:mb-5">
      <h3 className="font-bold text-sm text-on-surface">{title}</h3>
      {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  );
}

function Empty({ label = '데이터가 없습니다.' }) {
  return <p className="text-sm text-on-surface-variant text-center py-10">{label}</p>;
}

function AdminStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getAllStatsApi()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <AdminLayout pageTitle="통계 및 인사이트" activeMenu="stats">
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          통계를 불러오는 중...
        </div>
      </AdminLayout>
    );
  }

  const s   = data?.summary?.complaints ?? {};
  const rm  = data?.responseMetrics ?? {};
  const ar  = data?.attachmentRate ?? {};
  const um  = data?.userMetrics ?? {};

  const kpis = [
    { label: '총 민원',   value: s.total ?? 0,         icon: 'article',      color: 'text-primary',   bg: 'bg-primary/10' },
    { label: '오늘 접수', value: s.today ?? 0,         icon: 'today',        color: 'text-sky-600',   bg: 'bg-sky-50' },
    { label: '처리중',    value: s.in_progress ?? 0,   icon: 'sync',         color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '답변완료',  value: s.answered ?? 0,      icon: 'task_alt',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '긴급',      value: s.urgent ?? 0,        icon: 'priority_high', color: 'text-red-600',  bg: 'bg-red-50' },
    { label: '답변율',    value: pct(rm.answer_rate),  icon: 'speed',        color: 'text-teal-600',  bg: 'bg-teal-50' },
    { label: '첨부율',    value: pct(ar.attachment_rate), icon: 'attach_file', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '총 사용자', value: um.total ?? 0,        icon: 'group',        color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const byCategory = (data?.byCategory ?? []).map((c) => ({ name: c.category ?? '미분류', count: c.count }));
  const byStatus   = (data?.byStatus ?? []).map((x) => ({ name: STATUS_KO[x.status] ?? x.status, value: x.count }));
  const byDept     = (data?.byDepartment ?? []).map((d) => ({ name: d.department ?? '미배정', total: d.total }));
  const timeline   = (data?.timeline ?? []).map((t) => ({ ...t, label: mmdd(t.date) }));
  const urgency    = data?.urgency
    ? [
        { key: 'critical', name: '심각', value: data.urgency.critical ?? 0 },
        { key: 'high',     name: '높음', value: data.urgency.high ?? 0 },
        { key: 'medium',   name: '보통', value: data.urgency.medium ?? 0 },
        { key: 'low',      name: '낮음', value: data.urgency.low ?? 0 },
      ].filter((u) => u.value > 0)
    : [];
  const userByType = um.by_type
    ? Object.entries(um.by_type).map(([k, v]) => ({
        name: k === 'staff' ? '담당자' : k === 'admin' ? '관리자' : '시민', value: v,
      }))
    : [];
  const urgentTop  = data?.urgentTop ?? [];
  const clusters   = data?.hotClusters ?? [];
  const maxCluster = Math.max(...clusters.map((c) => c.complaint_count), 1);

  return (
    <AdminLayout pageTitle="통계 및 인사이트" activeMenu="stats">

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 md:mb-5">
        {kpis.map((k) => (
          <Card key={k.label} className="flex items-center gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-lg md:text-xl ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">{k.label}</p>
              <p className={`text-lg md:text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* 일별 추이 + 상태 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5 mb-3 md:mb-5">
        <Card className="md:col-span-8">
          <ChartTitle title="일별 민원 접수 / 답변" sub="최근 7일" />
          {timeline.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" name="접수" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="answered" name="답변" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="md:col-span-4">
          <ChartTitle title="상태별 분포" />
          {byStatus.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* 카테고리 + 긴급도 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5 mb-3 md:mb-5">
        <Card className="md:col-span-8">
          <ChartTitle title="카테고리별 민원 건수" />
          {byCategory.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="건수" radius={[6, 6, 0, 0]}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="md:col-span-4">
          <ChartTitle title="긴급도 분포" />
          {urgency.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={urgency} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {urgency.map((u, i) => <Cell key={i} fill={URGENCY_COLORS[u.key] ?? COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* 부서별 + 사용자 유형 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5 mb-3 md:mb-5">
        <Card className="md:col-span-8">
          <ChartTitle title="부서별 민원 건수" />
          {byDept.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="건수" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="md:col-span-4">
          <ChartTitle title="사용자 유형" sub={`이번 주 신규 ${um.new_this_week ?? 0}명`} />
          {userByType.length === 0 ? <Empty /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={userByType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {userByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* 긴급 민원 TOP + 인기 클러스터 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5">
        <Card className="md:col-span-6">
          <ChartTitle title="긴급 민원 TOP" sub="긴급도 점수 순" />
          {urgentTop.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {urgentTop.slice(0, 6).map((c, i) => (
                <div key={c.complaint_id ?? i} className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-low/60 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{c.title}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{c.department ?? '미배정'} · {c.citizen_name ?? '-'}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600 shrink-0">{Math.round((c.urgency_score ?? 0) * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="md:col-span-6">
          <ChartTitle title="자주 발생하는 민원 (클러스터)" sub="유사 민원 그룹" />
          {clusters.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {clusters.slice(0, 8).map((c, i) => (
                <div key={c.cluster_id ?? i}>
                  <div className="flex justify-between items-center gap-2 text-xs mb-1">
                    <span className="font-medium text-on-surface truncate">{c.representative_content}</span>
                    <span className="font-bold text-primary shrink-0">{c.complaint_count}건</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.complaint_count / maxCluster) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </AdminLayout>
  );
}

export default AdminStats;
