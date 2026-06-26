import { useState, useRef } from 'react';
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

function StatusBadge({ status }) {
  const s = statusStyle[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{status}</span>;
}

function PreviewModal({ file, onClose }) {
  if (!file) return null;
  const isImage = file.type === 'image' || (file.mimeType && file.mimeType.startsWith('image/'));
  const isPdf   = file.type === 'pdf';
  const isVideo = file.type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-red-600 text-lg shrink-0">
              {isImage ? 'image' : isPdf ? 'picture_as_pdf' : isVideo ? 'videocam' : 'description'}
            </span>
            <p className="text-sm font-bold text-on-surface truncate">{file.name}</p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center transition-colors ml-3">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="p-6 flex items-center justify-center min-h-64 bg-surface-container-low/40">
          {isImage && file.url ? (
            <img src={file.url} alt={file.name} className="max-w-full max-h-96 rounded-xl object-contain shadow-sm" />
          ) : isImage ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-sky-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-sky-400 text-5xl">image</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">이미지 미리보기 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : isPdf ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-5xl">picture_as_pdf</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">PDF 뷰어 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : isVideo ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-purple-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-400 text-5xl">videocam</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">동영상 플레이어 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-400 text-5xl">description</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">문서 미리보기 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-outline-variant flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffUrgent() {
  const { myDeptComplaints, currentUser, updateComplaintStatus, saveMemo } = useApp();

  const urgentList = myDeptComplaints.filter((c) => c.urgency === '긴급');

  const [selected,     setSelected]     = useState(null);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [searchText,   setSearchText]   = useState('');
  const [memoInput,    setMemoInput]    = useState('');
  const [toast,        setToast]        = useState('');
  const [attachments,  setAttachments]  = useState({});
  const [dragOver,     setDragOver]     = useState(false);
  const [preview,      setPreview]      = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const openDetail = (c) => { setSelected(c); setMemoInput(c.memo); };

  const selectedData = selected ? urgentList.find((c) => c.id === selected.id) ?? selected : null;

  const handleStatusChange = (id, newStatus) => {
    updateComplaintStatus(id, newStatus);
    if (selectedData?.id === id) setSelected((s) => ({ ...s, status: newStatus }));
    showToast(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
  };

  const handleSaveMemo = () => {
    saveMemo(selectedData.id, memoInput);
    showToast('메모가 저장되었습니다.');
  };

  const currentFiles = selectedData ? (attachments[selectedData.id] ?? []) : [];

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    setAttachments((prev) => ({
      ...prev,
      [selectedData.id]: [...(prev[selectedData.id] ?? []), ...newFiles],
    }));
  };

  const removeFile = (index) => {
    setAttachments((prev) => ({
      ...prev,
      [selectedData.id]: prev[selectedData.id].filter((_, i) => i !== index),
    }));
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'picture_as_pdf';
    if (['doc','docx'].includes(ext)) return 'description';
    if (['xls','xlsx'].includes(ext)) return 'table_chart';
    return 'attach_file';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const openFilePreview = (file) => {
    if (file instanceof File && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview({ name: file.name, type: 'image', url, isBlob: true });
    } else if (file instanceof File) {
      setPreview({ name: file.name, type: file.name.split('.').pop().toLowerCase() });
    } else {
      setPreview(file);
    }
  };

  const closePreview = () => {
    if (preview?.isBlob) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const filtered = urgentList.filter((c) => {
    const matchStatus = filterStatus === '전체' || c.status === filterStatus;
    const matchSearch = c.title.includes(searchText) || c.citizen.includes(searchText) || c.id.includes(searchText);
    return matchStatus && matchSearch;
  });

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = urgentList.filter((c) => c.status === s).length;
    return acc;
  }, {});

  return (
    <StaffLayout pageTitle="긴급 민원" activeMenu="urgent">
      <PreviewModal file={preview} onClose={closePreview} />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">

        {/* 담당 부서 안내 */}
        <div className="flex items-center gap-3 bg-red-600/8 border border-red-200 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-red-600 text-lg">business</span>
          <div>
            <span className="text-sm font-bold text-red-700">{currentUser.dept}</span>
            <span className="text-xs text-on-surface-variant ml-2">담당 부서 긴급 민원만 표시됩니다.</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-red-600">
              미완료 {urgentList.filter((c) => c.status !== '완료' && c.status !== '반려').length}건
            </span>
            <span className="text-xs text-on-surface-variant">/ 총 {urgentList.length}건</span>
          </div>
        </div>

        {/* 상태별 카드 */}
        <div className="grid grid-cols-5 gap-3">
          {STATUS_OPTIONS.map((s) => {
            const st = statusStyle[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? '전체' : s)}
                className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md ${
                  filterStatus === s ? 'border-red-500 bg-red-50' : 'bg-white border-outline-variant'
                }`}
              >
                <p className={`text-2xl font-bold ${st.text}`}>{counts[s] ?? 0}</p>
                <p className="text-xs text-on-surface-variant mt-1 font-medium">{s}</p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-5" style={{ height: 'calc(100vh - 16rem)' }}>

          {/* 목록 */}
          <section className="w-[420px] shrink-0 flex flex-col bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant/60 space-y-3">
              <div className="relative">
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="민원번호, 제목, 시민 이름 검색..."
                  className="w-full h-9 pl-9 pr-4 rounded-xl border border-outline-variant text-sm outline-none focus:border-red-500 transition-colors"
                />
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">priority_high</span>
                  긴급 민원
                </span>
                <span className="text-xs text-on-surface-variant">총 {filtered.length}건</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30">check_circle</span>
                  <p className="text-sm">긴급 민원이 없습니다.</p>
                </div>
              ) : filtered.map((c) => {
                const st = statusStyle[c.status] ?? statusStyle['접수'];
                return (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-red-50/50 transition-colors ${
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

          {/* 상세 패널 */}
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
                <StatusBadge status={selectedData.status} />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* 민원 내용 */}
                <div className="bg-surface-container-low/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-on-surface-variant mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">person</span>
                    민원인: {selectedData.citizen}
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed">{selectedData.content}</p>
                </div>

                {/* 민원인 첨부파일 */}
                {(() => {
                  const files = selectedData.citizenFiles ?? [];
                  const fileIcon = (f) => {
                    if (f.type === 'image') return { icon: 'image',          color: 'text-sky-500',    bg: 'bg-sky-50' };
                    if (f.type === 'pdf')   return { icon: 'picture_as_pdf', color: 'text-red-500',    bg: 'bg-red-50' };
                    if (f.type === 'doc')   return { icon: 'description',    color: 'text-blue-500',   bg: 'bg-blue-50' };
                    if (f.type === 'video') return { icon: 'videocam',       color: 'text-purple-500', bg: 'bg-purple-50' };
                    return                         { icon: 'attach_file',    color: 'text-slate-500',  bg: 'bg-slate-100' };
                  };
                  const fmtSize = (b) => b >= 1024*1024 ? `${(b/1024/1024).toFixed(1)}MB` : `${(b/1024).toFixed(0)}KB`;
                  return (
                    <div className="bg-white rounded-xl border border-outline-variant p-4">
                      <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-red-600">folder_open</span>
                        민원인 첨부파일
                        <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${files.length > 0 ? 'bg-red-100 text-red-600' : 'bg-surface-container text-on-surface-variant'}`}>
                          {files.length}개
                        </span>
                      </p>
                      {files.length === 0 ? (
                        <div className="flex items-center gap-2 py-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-xl opacity-30">folder_off</span>
                          <p className="text-xs">첨부된 파일이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {files.map((f, idx) => {
                            const ic = fileIcon(f);
                            return (
                              <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-low/60 rounded-xl">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ic.bg}`}>
                                  <span className={`material-symbols-outlined text-base ${ic.color}`}>{ic.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-on-surface truncate">{f.name}</p>
                                  <p className="text-[10px] text-on-surface-variant">{fmtSize(f.size)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => openFilePreview(f)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline"
                                  >
                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                    미리보기
                                  </button>
                                  <button className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant hover:underline">
                                    <span className="material-symbols-outlined text-sm">download</span>
                                    다운로드
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 상태 변경 */}
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

                {/* 처리 메모 */}
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

                {/* 담당자 첨부파일 */}
                <div className="bg-white rounded-xl border border-outline-variant p-4">
                  <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-red-600">attach_file</span>
                    첨부파일
                    {currentFiles.length > 0 && (
                      <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {currentFiles.length}
                      </span>
                    )}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                  />
                  <div
                    onClick={() => fileInputRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`border-2 border-dashed rounded-xl py-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-red-500 bg-red-50'
                        : 'border-outline-variant hover:border-red-400/50 hover:bg-surface-container-low/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">cloud_upload</span>
                    <p className="text-xs font-bold text-on-surface-variant">클릭하거나 파일을 끌어다 놓으세요</p>
                    <p className="text-[10px] text-on-surface-variant/60">PDF, 이미지, Word, Excel 등</p>
                  </div>
                  {currentFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {currentFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-low/60 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-red-500 text-base">{getFileIcon(file.name)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{file.name}</p>
                            <p className="text-[10px] text-on-surface-variant">{formatSize(file.size)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openFilePreview(file)}
                              className="w-6 h-6 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors"
                              title="미리보기"
                            >
                              <span className="material-symbols-outlined text-red-500 text-base">visibility</span>
                            </button>
                            <button
                              onClick={() => removeFile(idx)}
                              className="w-6 h-6 rounded-lg hover:bg-error/10 flex items-center justify-center transition-colors"
                              title="삭제"
                            >
                              <span className="material-symbols-outlined text-on-surface-variant hover:text-error text-base">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
