import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { getFormTemplatesApi, getFormTemplateApi, fillFormApi, renderFormPdfApi, getFormDebugPreviewApi } from '../../api/forms';
import FormPdfOverlay from '../../components/FormPdfOverlay';
import ZoomableImage from '../../components/ZoomableImage';
import { flattenMappings, fieldName } from '../../utils/formMappings';

// 서식 이름 → 아이콘 (서버 응답엔 아이콘이 없어 프론트에서 매핑)
function iconForName(name) {
  const n = name || '';
  if (/소음/.test(n)) return 'volume_up';
  if (/환경|위생/.test(n)) return 'eco';
  if (/도로|시설|교통/.test(n)) return 'construction';
  return 'edit_document';
}

// 챗봇에서 formTemplateId를 못 받았을 때 폴백용
function pickTemplateId(templates, category) {
  return templates[0]?.form_template_id ?? null;
}

function DocumentOCR() {
  const navigate = useNavigate();
  const location = useLocation();

  // 챗봇에서 넘어온 상태 (첫 렌더에서 캡처)
  const navState = useRef(location.state?.formTab ? location.state : null).current;
  const chatSessionId = navState?.sessionId ?? null;

  const [templates, setTemplates]             = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [formSearch, setFormSearch]           = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [template, setTemplate]               = useState(null);   // 상세 (field_mappings)
  const [fields, setFields]                   = useState({});
  const [signatures, setSignatures]           = useState({}); // { 위치키: PNG dataURL }
  const [lastSignature, setLastSignature]     = useState(null); // 직전 서명(재사용용)
  const [formChat, setFormChat]               = useState([]);
  const [formChatInput, setFormChatInput]     = useState('');
  const [formChatLoading, setFormChatLoading] = useState(false);
  const [downloading, setDownloading]         = useState(false);
  const [downloadPages, setDownloadPages]     = useState(null); // 확인 모달용 렌더 결과
  const [dlPage, setDlPage]                   = useState(0);

  const filteredTemplates = templates.filter(
    (t) => (t.name || '').includes(formSearch) || (t.description || '').includes(formSearch)
  );
  const selectedTemplate = template ?? templates.find((t) => t.form_template_id === selectedTemplateId) ?? null;

  // AI 필드 값 채우기 (POST /forms/fill)
  const runFill = async (id, userMessage, currentFields) => {
    setFormChatLoading(true);
    try {
      const res = await fillFormApi({
        templateId: id,
        userMessage: userMessage?.trim() || undefined,
        chatSessionId,
        currentFields,
      });
      const nextFields = res?.fields ?? {};
      setFields(nextFields);
      setFormChat((c) => [...c, {
        role: 'assistant',
        text: res?.message ?? '반영했어요. 추가로 수정할 내용이 있으면 이어서 말씀해 주세요.',
      }]);
    } catch (e) {
      const msg = e?.response?.status === 400
        ? '상담 세션 정보가 유효하지 않습니다. 상황을 직접 입력해 주세요.'
        : '작성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      setFormChat((c) => [...c, { role: 'assistant', text: msg }]);
    } finally {
      setFormChatLoading(false);
    }
  };

  // 서식 선택 → 상세 로드 + 기본 필드 초기화 (+ 챗봇 진입 시 자동 작성)
  const selectTemplate = async (id, { boot = false } = {}) => {
    setSelectedTemplateId(id);
    setTemplate(null);
    setFields({});
    setSignatures({});
    setFormChat(boot && navState?.sourceText?.trim() ? [{ role: 'user', text: '상담 내용을 바탕으로 서식을 작성해 주세요.' }] : []);
    try {
      const tpl = await getFormTemplateApi(id);
      setTemplate(tpl);
      // 필드는 빈 값으로 초기화만 한다. 자동 채움(성명/연락처 등)은 백엔드 /forms/fill이 처리.
      const flat = flattenMappings(tpl.field_mappings);
      const init = {};
      flat.forEach((f) => { init[fieldName(f)] = ''; });
      setFields(init);
      if (boot && (navState?.sourceText?.trim() || chatSessionId != null)) {
        runFill(id, navState?.sourceText || '', init);
      }
    } catch {
      setTemplate(null);
    }
  };

  const sendFormChat = () => {
    const text = formChatInput.trim();
    if (!text || formChatLoading || !selectedTemplateId) return;
    setFormChat((c) => [...c, { role: 'user', text }]);
    setFormChatInput('');
    runFill(selectedTemplateId, text, fields);
  };

  const onEditField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));
  const onSign = (id, url) => { if (!id) return; setSignatures((prev) => ({ ...prev, [id]: url })); setLastSignature(url); };

  const openDebugPreview = async () => {
    if (!selectedTemplateId) return;
    try {
      const blob = await getFormDebugPreviewApi(selectedTemplateId);
      console.log('[debug-preview] blob:', blob.type, blob.size);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) alert('팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.');
    } catch (e) {
      console.error('[debug-preview] error:', e);
      alert(`좌표 확인 실패: ${e?.response?.status ?? e?.message ?? '알 수 없는 오류'}`);
    }
  };

  // 파일 다운로드 → 먼저 실제 출력물을 렌더해 확인 모달로 보여줌
  const handleDownload = async () => {
    if (!template || downloading) return;
    setDownloading(true);
    try {
      const { renderFilledPages } = await import('../../utils/formPdf');
      const pages = await renderFilledPages(selectedTemplateId, template.field_mappings, fields, signatures);
      setDlPage(0);
      setDownloadPages(pages);
    } catch { /* 렌더 실패 무시 */ }
    finally { setDownloading(false); }
  };

  // 확인 모달에서 실제 다운로드 — 백엔드 렌더 엔드포인트 사용 (한글 폰트·정렬 정확)
  const confirmDownload = async () => {
    if (!downloadPages) return;
    setDownloading(true);
    try {
      const blob = await renderFormPdfApi(selectedTemplateId, fields);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate?.name || '민원서식'}_filled.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
      setDownloadPages(null);
    }
  };

  // 마운트: 서식 목록 로드 + 초기 서식 선택 (1회)
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setTemplatesLoading(true);
    getFormTemplatesApi()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setTemplates(arr);
        const initialId = navState?.formTemplateId ?? (navState ? pickTemplateId(arr, navState.category) : arr[0]?.form_template_id);
        if (initialId != null) selectTemplate(initialId, { boot: !!navState });
      })
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 제출 가능 여부: 값이 하나라도 채워져 있으면 제출 가능
  const flatFields = flattenMappings(template?.field_mappings);
  const canSubmit = !!template && !formChatLoading && Object.values(fields).some((v) => String(v ?? '').trim());

  // 제출하기 → 완성된 서식을 파일로 만들어 민원 상담(챗봇)으로 전달
  const handleSubmitToChat = () => {
    if (!canSubmit) return;
    const fileText =
      `[${selectedTemplate?.name || '민원 서식'}]\n\n` +
      flatFields.map((f) => `${fieldName(f)}: ${fields[fieldName(f)] || ''}`).join('\n');
    const titleField = flatFields.find((f) => /제목/.test(fieldName(f)));
    const title = ((titleField && fields[fieldName(titleField)]) || selectedTemplate?.name || '민원').trim();
    navigate('/chatbot', {
      state: {
        formSubmit: {
          formName: selectedTemplate?.name || '민원 서식',
          fileName: `${selectedTemplate?.name || '민원서식'}.txt`,
          fileText,
          title,
          content: fileText,
          category: navState?.category ?? null,
        },
      },
    });
  };

  return (
    <CitizenLayout pageTitle="민원 서류 작성" activeMenu="document">
      <div className="flex flex-col xl:flex-row gap-5 xl:[min-height:calc(100vh-8rem)]">

        {/* ── 왼쪽 사이드 ── */}
        <aside className="flex w-full xl:w-56 shrink-0 flex-col gap-4">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            홈으로 돌아가기
          </button>

          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white shadow-sm">
            <span className="material-symbols-outlined text-xl">description</span>
            <span className="text-base font-bold">민원 서류 작성</span>
          </div>

          <div className="mt-auto bg-primary/5 rounded-2xl border border-primary/15 p-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-white">smart_toy</span>
            </div>
            <h4 className="text-sm font-bold text-primary mb-1">서식 작성 도움말</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
              상황을 설명하면 AI가 민원 서식을 대신 작성해 드립니다.
            </p>
            <ul className="space-y-1.5 mb-3">
              {['성명·연락처 등 기본 정보 자동 입력', '채팅으로 서식 내용 자동 작성', '미리보기에서 직접 수정 가능'].map((t) => (
                <li key={t} className="text-xs text-on-surface-variant flex gap-1.5 items-start">
                  <span className="text-primary mt-0.5 shrink-0">•</span>{t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/faq', { state: { category: 'OCR / 서류' } })}
              className="flex items-center gap-1 text-xs text-primary font-bold hover:underline"
            >
              이용 가이드 보기
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </aside>

        {/* ── 메인: 서식 리스트 / 채팅 작성 / 실시간 미리보기 ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:h-[calc(100vh-11rem)]">

            {/* 왼쪽: 서식 리스트 + 검색 */}
            <div className="xl:col-span-3 min-h-[360px] xl:min-h-0 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
              <div className="px-4 py-3.5 border-b border-outline-variant shrink-0">
                <p className="text-sm font-bold text-on-surface mb-2.5">민원 서식 목록</p>
                <div className="relative">
                  <input
                    value={formSearch}
                    onChange={(e) => setFormSearch(e.target.value)}
                    placeholder="서식 검색..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary transition-colors"
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {templatesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant py-10">
                    <span className="material-symbols-outlined text-3xl animate-spin opacity-40">progress_activity</span>
                    <p className="text-xs">서식 불러오는 중...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant py-10">
                    <span className="material-symbols-outlined text-3xl opacity-30">search_off</span>
                    <p className="text-xs">{templates.length === 0 ? '서식을 불러올 수 없습니다.' : '검색 결과가 없습니다.'}</p>
                  </div>
                ) : filteredTemplates.map((t) => {
                  const active = t.form_template_id === selectedTemplateId;
                  return (
                    <button
                      key={t.form_template_id}
                      onClick={() => selectTemplate(t.form_template_id)}
                      className={`group w-full text-left px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-3 ${
                        active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-surface-container-low'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border transition-colors ${
                        active
                          ? 'bg-gradient-to-br from-primary to-primary/70 text-white border-primary/30'
                          : 'bg-gradient-to-br from-primary/8 to-primary/15 text-primary border-primary/15 group-hover:border-primary/25'
                      }`}>
                        <span className="material-symbols-outlined text-[22px]">{iconForName(t.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${active ? 'text-primary' : 'text-on-surface'}`}>{t.name}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 가운데: 마음이 AI 채팅 */}
            <div className="xl:col-span-5 min-h-[480px] xl:min-h-0 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant shrink-0 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">마음이 · 서식 작성 도우미</p>
                  <p className="text-[11px] text-on-surface-variant">상황을 설명하면 서식을 대신 작성해 드려요</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-surface-container-low/30">
                {formChat.length === 0 && !formChatLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant text-center px-6">
                    <span className="material-symbols-outlined text-4xl opacity-25">smart_toy</span>
                    <p className="text-xs leading-relaxed">
                      상황을 편하게 설명해 주시면<br /><span className="font-bold text-primary">AI가 서식 내용을 작성</span>해 드려요.<br />
                      성명·연락처 등 기본 정보는 자동으로 채워집니다.
                    </p>
                  </div>
                ) : (
                  <>
                    {formChat.map((m, i) => {
                      const isAI = m.role !== 'user';
                      return (
                        <div key={i} className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isAI ? 'bg-primary' : 'bg-primary/15'}`}>
                            <span className={`material-symbols-outlined text-base ${isAI ? 'text-white' : 'text-primary'}`}>{isAI ? 'smart_toy' : 'person'}</span>
                          </div>
                          <div className="max-w-[80%]">
                            <p className={`text-[10px] text-[11px] text-on-surface-variant mb-1 ${isAI ? 'ml-1' : 'mr-1 text-right'}`}>
                              {isAI ? '마음이' : '나'}
                            </p>
                            <div className={`px-3 py-2.5 px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              isAI
                                ? 'bg-white border border-outline-variant/40 rounded-tl-sm text-on-surface'
                                : 'bg-primary text-white rounded-tr-sm'
                            }`}>
                              {m.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {formChatLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-primary">
                          <span className="material-symbols-outlined text-base text-white">smart_toy</span>
                        </div>
                        <div className="max-w-[80%]">
                          <p className="text-[10px] text-[11px] text-on-surface-variant mb-1 ml-1">마음이</p>
                          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-outline-variant/40 shadow-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-base animate-spin">progress_activity</span>
                            <span className="text-xs text-on-surface-variant">작성 중입니다...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-4 py-3 border-t border-outline-variant shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={formChatInput}
                    onChange={(e) => setFormChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFormChat(); } }}
                    rows={1}
                    disabled={formChatLoading || !selectedTemplateId}
                    placeholder={formChatLoading ? 'AI가 작성 중입니다...' : '상황을 편하게 설명해 주세요...'}
                    className="flex-1 max-h-28 px-3 py-2.5 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary resize-none disabled:bg-surface-container-low/50"
                  />
                  <button
                    onClick={sendFormChat}
                    disabled={!formChatInput.trim() || formChatLoading || !selectedTemplateId}
                    className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:brightness-95 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 오른쪽: 실시간 미리보기 (직접 편집 가능) */}
            <div className="xl:col-span-4 min-h-[480px] xl:min-h-0 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-outline-variant shrink-0 flex items-center justify-between">
                <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">visibility</span>
                  미리보기
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openDebugPreview}
                    disabled={!selectedTemplateId}
                    title="필드 좌표 디버그 미리보기 (새 탭)"
                    className="text-[11px] text-on-surface-variant hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">bug_report</span>
                    좌표 확인
                  </button>
                  <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-lg">직접 수정 가능</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
                {!selectedTemplateId ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-on-surface-variant text-center px-6">
                    <span className="material-symbols-outlined text-4xl opacity-25">description</span>
                    <p className="text-xs">왼쪽에서 서식을 선택해 주세요.</p>
                  </div>
                ) : (
                  <FormPdfOverlay
                    templateId={selectedTemplateId}
                    fieldMappings={template?.field_mappings}
                    fields={fields}
                    onEditField={onEditField}
                    signatures={signatures}
                    onSign={onSign}
                    prevSignature={lastSignature}
                  />
                )}
              </div>
              {/* 파일 다운로드 · 제출하기 */}
              <div className="px-4 py-3 border-t border-outline-variant shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={!template || downloading}
                    className="w-full border border-primary/40 text-primary text-sm font-bold py-3 rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className={`material-symbols-outlined text-base ${downloading ? 'animate-spin' : ''}`}>{downloading ? 'progress_activity' : 'download'}</span>
                    {downloading ? '생성 중...' : '파일 다운로드'}
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant text-center mt-1.5">
                  {'내용을 작성하면 다운로드할 수 있어요.'}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 다운로드 확인 모달 — 실제 출력물 미리보기 후 다운로드 */}
      {downloadPages && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col p-6" onClick={() => setDownloadPages(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto flex flex-col overflow-hidden max-h-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-outline-variant flex items-center justify-between shrink-0">
              <p className="text-sm font-bold text-on-surface truncate">다운로드 미리보기 · {selectedTemplate?.name}</p>
              <button onClick={() => setDownloadPages(null)} className="text-on-surface-variant hover:text-on-surface shrink-0">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ZoomableImage
                key={dlPage}
                src={downloadPages[dlPage]?.img}
                alt={`${dlPage + 1}페이지`}
              />
            </div>
            {downloadPages.length > 1 && (
              <div className="flex items-center justify-center gap-3 py-2 border-t border-outline-variant/60 shrink-0">
                <button
                  disabled={dlPage <= 0}
                  onClick={() => setDlPage((p) => Math.max(0, p - 1))}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span className="text-xs font-bold text-on-surface w-14 text-center">{dlPage + 1} / {downloadPages.length}</span>
                <button
                  disabled={dlPage >= downloadPages.length - 1}
                  onClick={() => setDlPage((p) => Math.min(downloadPages.length - 1, p + 1))}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            )}
            <div className="flex gap-2 px-5 py-3 border-t border-outline-variant shrink-0">
              <button
                onClick={() => setDownloadPages(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDownload}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">download</span>
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </CitizenLayout>
  );
}

export default DocumentOCR;
