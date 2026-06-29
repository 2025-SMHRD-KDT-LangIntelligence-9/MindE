import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp, CATEGORY_STYLE, URGENCY_STYLE } from '../../store/AppContext';
import { STATUS_STYLE } from '../../utils/statusStyle';

const Y_TICKS  = [0, 20, 40, 60, 80, 100];
const PRIMARY  = '#6EAEFF';
const CHART_H  = 160;

function BarChart({ bars, labels }) {
  const maxVal = 100;
  const VW = 560;
  const barGroupW = VW / bars.length;
  const barW      = barGroupW * 0.55;
  const barPadX   = barGroupW * 0.225;
  const getY = (v) => CHART_H - (v / maxVal) * CHART_H;

  return (
    <div>
      <div className="flex gap-1">
        <div className="flex flex-col justify-between shrink-0 pr-1" style={{ height: CHART_H }}>
          {[...Y_TICKS].reverse().map((v) => (
            <span key={v} className="text-[10px] text-on-surface-variant leading-none text-right w-6">{v}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${VW} ${CHART_H}`} className="flex-1" style={{ height: CHART_H, overflow: 'visible' }}>
          {Y_TICKS.map((v) => (
            <line key={v} x1={0} y1={getY(v)} x2={VW} y2={getY(v)}
              stroke="#e8edf2" strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? '0' : '4 3'} />
          ))}
          {bars.map((val, i) => {
            const barH = (val / maxVal) * CHART_H;
            const x    = i * barGroupW + barPadX;
            const y    = getY(val);
            const isHigh = val >= 85;
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={PRIMARY} stopOpacity={isHigh ? 1 : 0.35} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={isHigh ? 0.65 : 0.15} />
                  </linearGradient>
                </defs>
                <rect x={x} y={y} width={barW} height={barH} fill={`url(#grad-${i})`} rx={4} />
                {isHigh && <>
                  <rect x={x} y={y} width={barW} height={barH} fill="none" stroke={PRIMARY} strokeWidth={1.5} rx={4} />
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight="bold" fill={PRIMARY}>{val}</text>
                </>}
              </g>
            );
          })}
          <line x1={0} y1={CHART_H} x2={VW} y2={CHART_H} stroke="#e8edf2" strokeWidth={1.5} />
        </svg>
      </div>
      <div className="flex mt-1.5" style={{ paddingLeft: 32 }}>
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-on-surface-variant">{l}시</span>
        ))}
      </div>
    </div>
  );
}

const chartBars   = [40, 60, 75, 50, 85, 65, 95, 70, 80, 55, 90, 72];
const chartLabels = ['09','10','11','12','13','14','15','16','17','18','19','20'];

const deptLoad = [
  { dept: '도로교통과', pct: 88, color: 'bg-error' },
  { dept: '환경보전과', pct: 62, color: 'bg-amber-400' },
  { dept: '사회복지과', pct: 45, color: 'bg-primary' },
  { dept: '공원녹지과', pct: 31, color: 'bg-emerald-500' },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { complaints, stats } = useApp();

  const urgentRows = complaints.filter((c) => c.urgency === '긴급').slice(0, 5);

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

      {/* 차트 + 부서 로드 */}
      <div className="grid grid-cols-12 gap-5 mb-6">
        <div className="col-span-8 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-on-surface">실시간 민원 유입 추이</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">오늘 시간대별 민원 접수 현황</p>
            </div>
            <span className="text-xs text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">실시간</span>
          </div>
          <BarChart bars={chartBars} labels={chartLabels} />
        </div>

        <div className="col-span-4 bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
          <h3 className="font-bold text-sm text-on-surface mb-5">부서별 업무 로드</h3>
          <div className="space-y-4">
            {deptLoad.map((d) => (
              <div key={d.dept}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-on-surface">{d.dept}</span>
                  <span className={`font-bold ${d.pct >= 80 ? 'text-error' : d.pct >= 60 ? 'text-amber-600' : 'text-primary'}`}>{d.pct}%</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-outline-variant">
            <p className="text-xs text-on-surface-variant">
              <span className="text-error font-bold">도로교통과</span>가 업무 과부하 상태입니다.
            </p>
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
