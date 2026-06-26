import { useState } from 'react';
import StaffLayout from '../../layouts/StaffLayout';
import { useApp } from '../../store/AppContext';

const STATUS_OPTIONS = ['접수', '처리 중', '보완 요청', '완료', '반려'];

const statusStyle = {
  '접수':     { bg: 'bg-blue-50',    text: 'text-blue-600' },
  '처리 중':  { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '보완 요청':{ bg: 'bg-purple-50',  text: 'text-purple-600' },
  '완료':     { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '반려':     { bg: 'bg-red-50',     text: 'text-red-600' },
};

const URGENCY_REASONS = {
  '도로/교통': '도로 파손 → 차량/보행자 사고 위험. 즉시 현장 점검 필요.',
  '시설/안전': '안전시설 이상 → 인명사고 위험. 신속 대응 필요.',
  '교통/안전': '스쿨존/교통 안전 위험. 어린이 피해 가능성 높음.',
  '시설/환경': '수도·전기 등 기반시설 긴급 상황.',
};

function StaffUrgent() {
  const { myDeptComplaints, currentUser, updateComplaintStatus, saveMemo } = useApp();

  const urgentList = myDeptComplaints.filter((c) => c.urgency === '긴급');

  const [selected, setSelected] = useState(null);
  const [memoInput, setMemoInput] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const openDetail = (c) => { setSelected(c); setMemoInput(c.memo); };

  const selectedData = selected ? myDeptComplaints.find((c) => c.id === selected.id) ?? selected : null;

  const handleStatusChange = (id, newStatus) => {
    updateComplaintStatus(id, newStatus);
    if (selectedData?.id === id) setSelected((s) => ({ ...s, status: newStatus }));
    showToast(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
  };

  const handleSaveMemo = () => {
    saveMemo(selectedData.id, memoInput);
    showToast('메모가 저장되었습니다.');
  };

  return (
    <StaffLayout pageTitle="긴급 민원" activeMenu="urgent">

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">
        {/* 담당 부서 안내 */}
        <div className="flex items-center gap-3 bg-[#1e3a5f]/8 border border-[#1e3a5f]/20 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-[#1e3a5f] text-lg">business</span>
          <span className="text-sm font-bold text-[#1e3a5f]">{currentUser.dept}</span>
          <span className="text-xs text-on-surface-variant">담당 부서 긴급 민원만 표시됩니다.</span>
        </div>

        {/* 배너 */}
        <div className="bg-gradient-to-r from-red-600 to-red-400 rounded-2xl px-6 py-5 flex items-center gap-4 text-white shadow">
          <span className="material-symbols-outlined text-4xl">notification_important</span>
          <div>
            <p className="font-bold text-lg">긴급 민원 현황</p>
            <p className="text-sm text-white/80">즉시 대응이 필요한 긴급 민원 목록입니다. 신속하게 처리해 주세요.</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-bold">{urgentList.filter((c) => c.status !== '완료' && c.status !== '반려').length}</p>
            <p className="text-xs text-white/70">미완료 긴급 건</p>
          </div>
        </div>

        <div className="flex gap-5" style={{ height: 'calc(100vh - 18rem)' }}>
          {/* 목록 */}
          <section className="w-[400px] shrink-0 flex flex-col bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant/60 bg-red-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-lg">priority_high</span>
              <span className="text-sm font-bold text-red-700">긴급 민원 {urgentList.length}건</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40">
              {urgentList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30">check_circle</span>
                  <p className="text-sm">긴급 민원이 없습니다.</p>
                </div>
              ) : urgentList.map((c) => {
                const st = statusStyle[c.status] ?? statusStyle['접수'];
                return (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={`w-full text-left px-4 py-4 hover:bg-red-50/50 transition-colors ${
                      selectedData?.id === c.id ? 'bg-red-50 border-l-4 border-red-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">긴급</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{c.status}</span>
                      <span className="text-[10px] text-on-surface-variant ml-auto">{c.id}</span>
                    </div>
                    <p className="text-sm font-bold text-on-surface truncate">{c.title}</p>
                    <p className="text-xs text-red-600 mt-1 line-clamp-1">
                      {URGENCY_REASONS[c.category] ?? '즉시 대응 필요.'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-on-surface-variant">{c.citizen}</span>
                      <span className="text-on-surface-variant/40">·</span>
                      <span className="text-[11px] text-on-surface-variant">{c.receivedAt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 상세 */}
          {selectedData ? (
            <section className="flex-1 flex flex-col bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="shrink-0 px-6 py-4 border-b border-red-200 bg-red-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">긴급</span>
                    <span className="text-[11px] text-on-surface-variant">{selectedData.id}</span>
                    <span className="text-[11px] text-on-surface-variant bg-white px-2 py-0.5 rounded-full border">{selectedData.category}</span>
                  </div>
                  <h2 className="text-base font-bold text-on-surface">{selectedData.title}</h2>
                  <p className="text-xs text-red-600 font-medium mt-1">
                    {URGENCY_REASONS[selectedData.category] ?? '즉시 대응 필요.'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">접수: {selectedData.receivedAt}</p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusStyle[selectedData.status]?.bg ?? 'bg-slate-100'} ${statusStyle[selectedData.status]?.text ?? 'text-slate-500'}`}>
                  {selectedData.status}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="bg-surface-container-low/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-on-surface-variant mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">person</span>
                    민원인: {selectedData.citizen}
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed">{selectedData.content}</p>
                </div>

                <div className="bg-white rounded-xl border border-outline-variant p-4">
                  <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-red-600">swap_horiz</span>
                    처리 상태 변경
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => {
                      const st = statusStyle[s];
                      const isActive = selectedData.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(selectedData.id, s)}
                          className={`text-xs font-bold px-4 py-2 rounded-xl border-2 transition-all ${
                            isActive
                              ? `${st.bg} ${st.text} border-current`
                              : 'bg-white text-on-surface-variant border-outline-variant hover:border-red-600 hover:text-red-600'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-outline-variant p-4">
                  <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-red-600">edit_note</span>
                    처리 메모
                  </p>
                  <textarea
                    value={memoInput}
                    onChange={(e) => setMemoInput(e.target.value)}
                    placeholder="긴급 대응 조치 내용을 기록하세요..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm outline-none focus:border-red-500 resize-none"
                  />
                  <button
                    onClick={handleSaveMemo}
                    className="mt-2 w-full bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">save</span>
                    메모 저장
                  </button>
                </div>

                {selectedData.memo && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-700 mb-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                      저장된 메모
                    </p>
                    <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{selectedData.memo}</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-outline-variant shadow-sm">
              <div className="text-center text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-5xl opacity-20">notification_important</span>
                <p className="text-sm">왼쪽 목록에서 긴급 민원을 선택하세요.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}

export default StaffUrgent;
