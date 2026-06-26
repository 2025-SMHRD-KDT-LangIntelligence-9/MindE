import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp } from '../../store/AppContext';

const statusStyle = {
  '접수':     { bg: 'bg-blue-50',    text: 'text-blue-600' },
  '처리 중':  { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '보완 요청':{ bg: 'bg-purple-50',  text: 'text-purple-600' },
  '완료':     { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '반려':     { bg: 'bg-red-50',     text: 'text-red-600' },
};

function AdminMonitoring() {
  const { complaints, stats, updateComplaintStatus } = useApp();
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [filterUrgent, setFilterUrgent] = useState('전체');
  const [activeTab,    setActiveTab]    = useState('all');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const tabFilter = (r) => {
    if (activeTab === 'urgent')     return r.urgency === '긴급' && r.status !== '완료';
    if (activeTab === 'inProgress') return r.status === '처리 중' || r.status === '보완 요청';
    if (activeTab === 'done')       return r.status === '완료';
    return true;
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

  const handleStatusChange = (id, newStatus) => {
    updateComplaintStatus(id, newStatus);
    showToast(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
  };

  return (
    <AdminLayout pageTitle="전체 민원 모니터링" activeMenu="monitoring">

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-navy text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      {/* 통계 탭 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'all',        label: '총 민원',     value: `${stats.total}건`,      icon: 'article',         color: 'text-primary',     bg: 'bg-primary/10',       activeBorder: 'border-primary',     activeRing: 'ring-primary/20' },
          { key: 'urgent',     label: '미처리 긴급', value: `${stats.urgent}건`,     icon: 'pending_actions', color: 'text-error',       bg: 'bg-error-container',  activeBorder: 'border-error',       activeRing: 'ring-error/20' },
          { key: 'inProgress', label: '처리 중',     value: `${stats.inProgress}건`, icon: 'sync',            color: 'text-amber-600',   bg: 'bg-amber-50',         activeBorder: 'border-amber-400',   activeRing: 'ring-amber-200' },
          { key: 'done',       label: '처리 완료',   value: `${stats.done}건`,       icon: 'task_alt',        color: 'text-emerald-600', bg: 'bg-emerald-50',       activeBorder: 'border-emerald-500', activeRing: 'ring-emerald-200' },
        ].map((s) => {
          const isActive = activeTab === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleTabClick(s.key)}
              className={`bg-white rounded-2xl border-2 p-5 shadow-sm flex items-center gap-4 w-full text-left transition-all hover:shadow-md ${
                isActive
                  ? `${s.activeBorder} ring-4 ${s.activeRing}`
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant font-medium">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              {isActive && (
                <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">filter_alt</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 민원 리스트 */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-on-surface">상세 민원 리스트</h3>
            {activeTab !== 'all' && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">filter_alt</span>
                {{ urgent: '미처리 긴급', inProgress: '처리 중', done: '처리 완료' }[activeTab]}
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

        <table className="w-full text-left">
          <thead className="border-b border-outline-variant">
            <tr>
              {['번호','민원 제목','시민','담당 부서','상태','긴급도','접수일','상태 변경'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold text-on-surface-variant">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {filtered.map((r) => {
              const cfg = statusStyle[r.status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
              return (
                <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-bold text-primary">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-on-surface max-w-[200px] truncate">{r.title}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{r.citizen}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{r.dept}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.urgency === '긴급' ? 'bg-error-container text-error' : 'bg-surface-container text-on-surface-variant'}`}>
                      {r.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{r.receivedAt}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value)}
                      className="h-7 px-2 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none focus:border-primary"
                    >
                      {['접수', '처리 중', '보완 요청', '완료', '반려'].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-6 py-3.5 border-t border-outline-variant flex justify-between items-center bg-surface-container-low/30">
          <span className="text-xs text-on-surface-variant">전체 {filtered.length}건 (총 {complaints.length}건)</span>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminMonitoring;
