import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp, CATEGORY_STYLE, URGENCY_STYLE } from '../../store/AppContext';
import { STATUS_STYLE as statusStyle } from '../../utils/statusStyle';
import { getDepartmentsApi } from '../../api/admin';

const PAGE_SIZE = 10;

function AdminMonitoring() {
  const { complaints, updateComplaintDept } = useApp();
  const [searchParams] = useSearchParams();
  const [deptList, setDeptList] = useState([]);
  useEffect(() => {
    getDepartmentsApi()
      .then((data) => setDeptList(data))
      .catch(() => {});
  }, []);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('전체');
  const [filterUrgent,  setFilterUrgent]  = useState('전체');
  const [activeTab,     setActiveTab]     = useState('all');
  const [toast,         setToast]         = useState('');
  const [page,          setPage]          = useState(1);

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      setSearch(idParam);
      setActiveTab('all');
      setFilterStatus('전체');
      setFilterUrgent('전체');
    }
  }, [searchParams]);

  // 필터/검색/탭이 바뀌면 첫 페이지로
  useEffect(() => { setPage(1); }, [search, filterStatus, filterUrgent, activeTab]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // 요약 통계
  const total       = complaints.length;
  const cReceived   = complaints.filter((c) => c.status === '접수').length;
  const cUrgent     = complaints.filter((c) => c.urgency === '긴급').length;
  const cProgress   = complaints.filter((c) => c.status === '처리 중').length;
  const cSupplement = complaints.filter((c) => c.status === '보완 요청').length;
  const cRejected   = complaints.filter((c) => c.status === '반려').length;
  const cDone       = complaints.filter((c) => c.status === '완료').length;

  const summaryCards = [
    { label: '총 민원',  value: total,        icon: 'assignment',    color: 'text-[#1e3a5f]',   bg: 'bg-[#1e3a5f]/8',  tab: 'all' },
    { label: '접수',     value: cReceived,    icon: 'inbox',         color: 'text-blue-600',    bg: 'bg-blue-50',      tab: '접수' },
    { label: '긴급',     value: cUrgent,      icon: 'priority_high', color: 'text-red-600',     bg: 'bg-red-50',       tab: 'urgent' },
    { label: '처리 중',  value: cProgress,    icon: 'pending',       color: 'text-amber-600',   bg: 'bg-amber-50',     tab: '처리 중' },
    { label: '보완',     value: cSupplement,  icon: 'edit_note',     color: 'text-purple-600',  bg: 'bg-purple-50',    tab: '보완 요청' },
    { label: '반려',     value: cRejected,    icon: 'cancel',        color: 'text-rose-600',    bg: 'bg-rose-50',      tab: '반려' },
    { label: '완료',     value: cDone,        icon: 'check_circle',  color: 'text-emerald-600', bg: 'bg-emerald-50',   tab: '완료' },
  ];

  const tabFilter = (r) => {
    if (activeTab === 'all')    return true;
    if (activeTab === 'urgent') return r.urgency === '긴급';
    return r.status === activeTab; // '접수','처리 중','보완 요청','반려','완료'
  };

  const filtered = complaints.filter((r) => {
    const matchSearch = r.title.includes(search) || r.id.includes(search) || r.citizen.includes(search);
    const matchStatus = filterStatus === '전체' || r.status === filterStatus;
    const matchUrgent = filterUrgent === '전체'
      || (filterUrgent === '긴급' && r.urgency === '긴급')
      || (filterUrgent === '보통' && r.urgency !== '긴급');
    return matchSearch && matchStatus && matchUrgent && tabFilter(r);
  });

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setFilterStatus('전체');
    setFilterUrgent('전체');
    setSearch('');
  };

  // 페이지네이션 (10개씩)
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const windowStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageNums    = [];
  for (let i = windowStart; i <= Math.min(totalPages, windowStart + 4); i++) pageNums.push(i);

  return (
    <AdminLayout pageTitle="전체 민원 모니터링" activeMenu="monitoring">

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-navy text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-3 md:mb-6">
        {summaryCards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.tab && handleTabClick(c.tab)}
            className={`bg-white rounded-2xl border p-2 md:p-4 shadow-sm flex flex-col items-center gap-1 md:gap-2 w-full transition-all ${
              c.tab && activeTab === c.tab
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-outline-variant'
            } ${c.tab ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-base md:text-xl ${c.color}`}>{c.icon}</span>
            </div>
            <p className={`text-base md:text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-on-surface-variant">{c.label}</p>
          </button>
        ))}
      </div>

      {/* 민원 리스트 */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-on-surface">상세 민원 리스트</h3>
            {activeTab !== 'all' && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">filter_alt</span>
                {activeTab === 'urgent' ? '긴급' : activeTab}
                <button onClick={() => handleTabClick('all')} className="ml-0.5 hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border border-outline-variant text-xs text-on-surface bg-white outline-none">
              {['전체', '접수', '처리 중', '보완 요청', '완료', '반려'].map((o) => <option key={o}>{o}</option>)}
            </select>
            <select value={filterUrgent} onChange={(e) => setFilterUrgent(e.target.value)}
              className="h-9 px-3 rounded-xl border border-outline-variant text-xs text-on-surface bg-white outline-none">
              {['전체', '긴급', '보통'].map((o) => <option key={o}>{o}</option>)}
            </select>
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="제목, 번호, 시민 검색"
                className="h-9 pl-3 pr-8 rounded-xl border border-outline-variant text-xs outline-none" />
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-base">search</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low/60">
              <tr>
                {['민원번호', '카테고리', '민원내용', '접수자', '담당부서', '긴급도', '접수일자', '진행상태', '담당부서 변경'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-bold text-on-surface-variant whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-on-surface-variant">
                    조건에 맞는 민원이 없습니다.
                  </td>
                </tr>
              )}
              {paged.map((r) => {
                const cfg = statusStyle[r.status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
                return (
                  <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-5 py-3 text-xs font-bold text-primary whitespace-nowrap">{r.id}</td>
                    <td className="px-5 py-3">
                      {(() => { const s = CATEGORY_STYLE[r.category] ?? CATEGORY_STYLE['기타']; return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>{r.category}</span>; })()}
                    </td>
                    <td className="px-5 py-3 text-sm text-on-surface max-w-[180px] truncate">{r.title}</td>
                    <td className="px-5 py-3 text-sm text-on-surface-variant whitespace-nowrap">{r.citizen}</td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap">{r.dept}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {(() => { const u = URGENCY_STYLE[r.urgency] ?? URGENCY_STYLE['낮음']; return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${u.bg} ${u.text}`}>{r.urgency}</span>; })()}
                    </td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap">{r.receivedAt}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={r.dept}
                        onChange={(e) => {
                          const dept = deptList.find((d) => d.name === e.target.value);
                          if (dept) {
                            updateComplaintDept(r.id, dept.department_id, dept.name);
                            showToast(`담당부서가 '${dept.name}'(으)로 변경되었습니다.`);
                          }
                        }}
                        className="h-7 px-2 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none focus:border-primary"
                      >
                        {deptList.map((d) => <option key={d.department_id} value={d.name}>{d.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-3 md:px-6 py-2 md:py-3.5 border-t border-outline-variant flex flex-wrap gap-2 justify-between items-center bg-surface-container-low/30">
          <span className="text-xs text-on-surface-variant">
            전체 {filtered.length}건 (총 {complaints.length}건)
            {filtered.length > 0 && ` · ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} 표시`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {pageNums.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition-colors ${
                    n === currentPage
                      ? 'bg-primary text-white'
                      : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminMonitoring;
