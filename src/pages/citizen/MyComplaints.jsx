import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { useApp, CATEGORY_STYLE } from '../../store/AppContext';
import EmptyState from '../../components/EmptyState';
import { STATUS_STYLE as statusConfig } from '../../utils/statusStyle';

const steps = ['접수', '검토', '처리', '완료'];

const statusToStep = { '접수': 1, '처리 중': 2, '보완 요청': 2, '완료': 4, '반려': 4 };

const categoryFilterOptions = ['전체 유형', '도로/교통', '환경/위생', '시설/안전', '시설/환경', '교통/주차'];
const statusFilterOptions   = ['전체 상태', '접수', '처리 중', '보완 요청', '완료', '반려'];

function MyComplaints() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { stats, notifications, staffFiles } = useApp();
  const complaints = stats.myComplaints;

  const [filterType,   setFilterType]   = useState('전체 유형');
  const [filterStatus, setFilterStatus] = useState('전체 상태');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState(null);

  // URL ?id= 파라미터로 진입 시 해당 민원 자동 선택
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const found = complaints.find((c) => c.id === idParam);
      if (found) setSelected(found);
    }
  }, [searchParams, complaints]);

  // selected 복원: complaints가 업데이트되면 최신 데이터 반영
  const selectedData = selected ? complaints.find((c) => c.id === selected.id) ?? selected : null;

  const filtered = complaints.filter((c) => {
    const matchType   = filterType   === '전체 유형' || c.category === filterType;
    const matchStatus = filterStatus === '전체 상태' || c.status   === filterStatus;
    const matchSearch = c.title.includes(search) || c.id.includes(search);
    return matchType && matchStatus && matchSearch;
  });

  const myNotifs = notifications.filter((n) =>
    complaints.some((c) => c.id === n.complaintId)
  ).slice(0, 4);

  /* ── 상태별 카운트 ── */
  const countOf = (s) => complaints.filter((c) => c.status === s).length;
  const urgentCount = complaints.filter((c) => c.urgency === '긴급').length;

  /* ── 상세 화면 ── */
  if (selectedData) {
    const c   = selectedData;
    const cfg = statusConfig[c.status] ?? statusConfig['접수'];
    const step = statusToStep[c.status] ?? 1;

    // 이 민원과 관련된 알림 이력 (담당자 처리 기록)
    const complaintHistory = notifications
      .filter((n) => n.complaintId === c.id)
      .slice(0, 10);

    return (
      <CitizenLayout pageTitle="민원 상세" activeMenu="complaints">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => { setSelected(null); navigate('/my-complaints'); }}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary mb-5 transition-colors">
            <span className="material-symbols-outlined text-lg">arrow_back</span>목록으로
          </button>
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">

            {/* 헤더 */}
            <div className="px-8 py-6 border-b border-outline-variant">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-primary font-bold mb-1">{c.id}</p>
                  <h2 className="text-xl font-bold text-on-surface">{c.title}</h2>
                  <div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant">
                    <span>{c.category}</span><span>·</span><span>{c.dept}</span><span>·</span>
                    <span>접수일 {c.receivedAt}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${cfg.bg} ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                  </span>
                  {c.updatedAt && (
                    <p className="text-[10px] text-on-surface-variant">최종 수정 {c.updatedAt}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 진행 단계 */}
            <div className="px-8 py-6 border-b border-outline-variant bg-surface-container-low/40">
              <p className="text-xs font-bold text-on-surface-variant mb-4">처리 진행 현황</p>
              <div className="flex items-center">
                {steps.map((s, i) => {
                  const done = i < step; const current = i === step - 1;
                  return (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          current ? 'bg-primary border-primary text-white shadow-md'
                            : done ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-white border-outline-variant text-on-surface-variant'}`}>
                          {done && !current ? <span className="material-symbols-outlined text-[16px]">check</span> : i + 1}
                        </div>
                        <p className={`text-[11px] mt-1.5 font-bold ${done ? 'text-primary' : 'text-on-surface-variant'}`}>{s}</p>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < step - 1 ? 'bg-primary/40' : 'bg-outline-variant'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 반려 사유 (반려 상태일 때) */}
            {c.status === '반려' && c.memo && (
              <div className="px-8 py-5 border-b border-outline-variant">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-red-500 text-base">cancel</span>
                  <p className="text-xs font-bold text-red-600">반려 사유</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-800 leading-relaxed">{c.memo}</p>
                </div>
              </div>
            )}

            {/* 보완 요청 안내 (보완 요청 상태일 때) */}
            {c.status === '보완 요청' && (
              <div className="px-8 py-5 border-b border-outline-variant">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-purple-500 text-base">edit_note</span>
                  <p className="text-xs font-bold text-purple-600">보완 요청</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-purple-800 leading-relaxed">
                    {c.memo || '담당자가 추가 서류 또는 정보 보완을 요청하였습니다. 아래 추가 상담 버튼을 눌러 내용을 확인하세요.'}
                  </p>
                </div>
              </div>
            )}

            {/* 민원 내용 */}
            <div className="px-8 py-6 border-b border-outline-variant">
              <p className="text-xs font-bold text-on-surface-variant mb-3">민원 내용</p>
              <p className="text-sm text-on-surface leading-relaxed">{c.content}</p>
            </div>

            {/* 처리 이력 (담당자 상태 변경 기록) */}
            {complaintHistory.length > 0 && (
              <div className="px-8 py-6 border-b border-outline-variant">
                <p className="text-xs font-bold text-on-surface-variant mb-4">처리 이력</p>
                <div className="relative pl-5">
                  {/* 세로 라인 */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/60" />
                  <div className="space-y-4">
                    {complaintHistory.map((n, idx) => (
                      <div key={n.id} className="relative flex gap-3">
                        {/* 점 */}
                        <div className={`absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm shrink-0 ${
                          idx === 0 ? 'bg-primary' : 'bg-outline-variant'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`material-symbols-outlined text-sm ${n.color}`}>{n.icon}</span>
                            <span className="text-xs font-bold text-on-surface">{n.title}</span>
                            {n.tag && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                statusConfig[n.tag]?.bg ?? 'bg-surface-container'
                              } ${statusConfig[n.tag]?.text ?? 'text-on-surface-variant'}`}>
                                {n.tag}
                              </span>
                            )}
                            <span className="text-[10px] text-on-surface-variant ml-auto">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{n.desc}</p>
                        </div>
                      </div>
                    ))}
                    {/* 최초 접수 */}
                    <div className="relative flex gap-3">
                      <div className="absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-outline-variant shadow-sm shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">inbox</span>
                          <span className="text-xs font-bold text-on-surface">민원 접수</span>
                          <span className="text-[10px] text-on-surface-variant ml-auto">{c.receivedAt}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1">민원이 정상적으로 접수되었습니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 담당 부서 답변 */}
            <div className="px-8 py-6 border-b border-outline-variant">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-on-surface-variant">담당 부서 답변</p>
                {c.reply
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">답변 완료</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">답변 대기 중</span>
                }
              </div>
              {c.reply ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">business</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{c.dept}</p>
                      <p className="text-[11px] text-on-surface-variant">{c.replyDate} 답변</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed">{c.reply}</p>
                </div>
              ) : (
                <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline text-xl">hourglass_empty</span>
                  <p className="text-sm text-on-surface-variant">담당 부서에서 검토 중입니다. 답변이 등록되면 알림을 보내드립니다.</p>
                </div>
              )}
            </div>

            {/* 담당자 첨부파일 */}
            {(staffFiles[c.id] ?? []).length > 0 && (
              <div className="px-8 py-6 border-b border-outline-variant">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-base">attach_file</span>
                  <p className="text-xs font-bold text-on-surface-variant">담당자 첨부 파일</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{staffFiles[c.id].length}개</span>
                </div>
                <div className="flex flex-col gap-2">
                  {staffFiles[c.id].map((file, idx) => {
                    const ext = file.name.split('.').pop().toLowerCase();
                    const isImg = file.type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext);
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-sm">
                            {isImg ? 'image' : ext === 'pdf' ? 'picture_as_pdf' : 'description'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-on-surface truncate">{file.name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {file.size < 1024 ? `${file.size}B` : file.size < 1024*1024 ? `${(file.size/1024).toFixed(1)}KB` : `${(file.size/(1024*1024)).toFixed(1)}MB`}
                          </p>
                        </div>
                        {isImg && file.url && (
                          <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">open_in_new</span>보기
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 담당 부서 */}
            <div className="px-8 py-6 border-b border-outline-variant">
              <p className="text-xs font-bold text-on-surface-variant mb-3">담당 부서</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg">business</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{c.dept}</p>
                  <p className="text-xs text-primary">☎ 02-123-4567</p>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-8 py-5 flex gap-3">
              <button
                onClick={() => navigate('/chatbot')}
                className="flex items-center gap-2 text-sm font-bold text-primary border border-primary/40 px-5 py-2.5 rounded-xl hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">chat_bubble</span>추가 상담
              </button>
              {c.status === '보완 요청' && (
                <button
                  onClick={() => navigate('/chatbot', { state: { supplement: true, complaintId: c.id, complaintTitle: c.title } })}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-purple-600 px-5 py-2.5 rounded-xl hover:brightness-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">upload_file</span>서류 보완 제출
                </button>
              )}
            </div>

          </div>
        </div>
      </CitizenLayout>
    );
  }

  /* ── 목록 화면 ── */
  return (
    <CitizenLayout pageTitle="내 민원 내역" activeMenu="complaints">
      <div className="grid grid-cols-12 gap-5">
        {/* 왼쪽 */}
        <div className="col-span-8 flex flex-col gap-5">
          {/* 통계 카드 */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: '접수됨',    value: countOf('접수'),     icon: 'inbox',                color: 'text-blue-600',    bg: 'bg-blue-50' },
              { label: '처리중',    value: countOf('처리 중'),  icon: 'pending_actions',      color: 'text-amber-600',   bg: 'bg-amber-50' },
              { label: '완료',      value: countOf('완료'),     icon: 'check_circle',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: '긴급 민원', value: urgentCount,          icon: 'local_fire_department', color: 'text-red-500',     bg: 'bg-red-50' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-outline-variant p-4 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
                </div>
                <p className="text-xs text-on-surface-variant font-medium">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color} leading-tight`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* 목록 테이블 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 className="text-sm font-bold text-on-surface">제출한 민원 목록</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-outline-variant bg-surface-container-low/30">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="h-9 px-3 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none">
                {categoryFilterOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 px-3 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none">
                {statusFilterOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
              <div className="relative flex-1 min-w-[150px]">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="민원 제목 검색"
                  className="w-full h-9 pl-3 pr-8 rounded-lg border border-outline-variant text-xs outline-none bg-white" />
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-base">search</span>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant">
                <tr>
                  {['접수번호','민원 제목','유형','담당 부서','상태','접수일'].map((h) => (
                    <th key={h} className="px-5 py-3 text-xs font-bold text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon="search_off"
                        title="검색 결과가 없습니다"
                        desc="필터나 검색어를 변경해 보세요."
                      />
                    </td>
                  </tr>
                ) : filtered.map((c) => {
                  const cfg = statusConfig[c.status] ?? statusConfig['접수'];
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-surface-container-low/50 cursor-pointer transition-colors">
                      <td className="px-5 py-3 text-xs font-bold text-primary">{c.id}</td>
                      <td className="px-5 py-3 text-sm text-on-surface">{c.title}</td>
                      <td className="px-5 py-3">{(() => { const s = CATEGORY_STYLE[c.category] ?? CATEGORY_STYLE['기타']; return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{c.category}</span>; })()}</td>
                      <td className="px-5 py-3 text-xs text-on-surface-variant">{c.dept}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-on-surface-variant">{c.receivedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽 사이드 */}
        <div className="col-span-4 flex flex-col gap-5">
          {/* 실시간 알림 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
              <p className="text-sm font-bold text-on-surface">실시간 알림</p>
              <button onClick={() => navigate('/notifications')} className="text-xs text-primary font-bold hover:underline">더보기 ›</button>
            </div>
            <div className="divide-y divide-outline-variant/50">
              {myNotifs.length === 0 ? (
                <p className="px-5 py-4 text-xs text-on-surface-variant">알림이 없습니다.</p>
              ) : myNotifs.map((n) => (
                <div key={n.id} className="px-5 py-3 hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${n.color}`}>{n.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{n.title}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{n.desc}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 민원 상태 요약 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
            <p className="text-sm font-bold text-on-surface mb-4">상태별 현황</p>
            <div className="space-y-3">
              {[
                { label: '접수됨', value: countOf('접수'),    total: complaints.length, color: 'bg-primary' },
                { label: '처리중', value: countOf('처리 중'), total: complaints.length, color: 'bg-amber-400' },
                { label: '완료',   value: countOf('완료'),    total: complaints.length, color: 'bg-emerald-500' },
                { label: '긴급',   value: urgentCount,         total: complaints.length, color: 'bg-red-400' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant">{r.label}</span>
                    <span className="font-bold text-on-surface">{r.value}건</span>
                  </div>
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.color}`}
                      style={{ width: r.total > 0 ? `${(r.value / r.total) * 100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}

export default MyComplaints;
