import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getFormPdfBlobApi } from '../api/forms';
import { normalizePerPage, fieldName, fieldPos, fieldSize, isSignatureField, sigId } from '../utils/formMappings';
import SignaturePad from './SignaturePad';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// 백엔드 field_mappings 좌표 단위 = 밀리미터(mm), 하단 기준(y-up). PDF pt 로 변환.
const MM_TO_PT = 72 / 25.4; // ≈ 2.8346
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 한 페이지: canvas 로 PDF 렌더 + 필드 인풋 절대배치 오버레이
function PdfPage({ pdf, pageNum, pageIndex, scale, pageFields, fields, onEditField, signatures, onRequestSign }) {
  const canvasRef = useRef(null);
  const [dims, setDims] = useState(null);      // 원본 pt 크기 {w, h}
  const [viewport, setViewport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        if (!cancelled) setDims({ w: base.width, h: base.height });
        const vp = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
        await renderTask.promise;
        if (!cancelled) setViewport(vp);
      } catch { /* 렌더 취소/실패 무시 */ }
    })();
    return () => { cancelled = true; if (renderTask) renderTask.cancel(); };
  }, [pdf, pageNum, scale]);

  // 스케일 바뀌면 캔버스 렌더 전에도 레이아웃 크기를 즉시 확보 (휠 확대 앵커 안정화)
  const w = dims ? dims.w * scale : undefined;
  const h = dims ? dims.h * scale : undefined;

  return (
    <div className="relative bg-white shadow-lg" style={{ width: w, height: h }}>
      <canvas ref={canvasRef} className="block" style={{ width: w, height: h }} />
      {viewport && pageFields.map((f, i) => {
        const name = fieldName(f);
        const [xmm, ymm] = fieldPos(f);
        const [vx, vy] = viewport.convertToViewportPoint(xmm * MM_TO_PT, ymm * MM_TO_PT);
        const fs = fieldSize(f) * scale;
        const fw = (Number(f?.width) ? Number(f.width) * MM_TO_PT : (/주소|내용|사유|명세|물건|소재지/.test(name) ? 200 : 90)) * scale;

        if (isSignatureField(f)) {
          // 위치 표기용 클릭 마커 (고정 크기 UI). 실제 서명은 다운로드 시 백엔드 크기대로 삽입.
          const id = sigId(pageIndex, f);
          const sig = signatures?.[id];
          return (
            <button
              key={i}
              data-sign="1"
              onClick={() => onRequestSign?.(id, name)}
              title={sig ? '서명 수정' : '여기에 서명'}
              style={{ position: 'absolute', left: vx, top: vy, transform: 'translate(-50%, -100%)' }}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold cursor-pointer whitespace-nowrap z-10 border bg-transparent ${
                sig ? 'border-emerald-500 text-emerald-600' : 'border-primary text-primary hover:bg-primary/10'
              }`}
            >
              {sig ? (
                <>
                  <img src={sig} alt="" className="h-3.5 max-w-[44px] object-contain" />
                  <span className="material-symbols-outlined text-[11px]">check</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[11px]">draw</span>
                  서명
                </>
              )}
            </button>
          );
        }

        return (
          <input
            key={i}
            type="text"
            value={fields[name] ?? ''}
            onChange={(e) => onEditField(name, e.target.value)}
            title={name}
            style={{ position: 'absolute', left: vx, top: vy - fs, width: fw, height: fs * 1.5, fontSize: Math.max(fs, 7), lineHeight: 1.1, padding: 0 }}
            className="bg-transparent outline-none text-black border border-primary/50 hover:border-primary focus:border-primary rounded-[2px]"
          />
        );
      })}
    </div>
  );
}

// PDF 뷰어 (툴바 + 페이지 + 휠 확대). 인라인/전체화면에서 공용.
function PdfViewer({ pdf, pageBaseW, pageBaseH, perPage, fields, onEditField, signatures, onRequestSign, big, onToggleFullscreen }) {
  const wrapRef = useRef(null);
  const [containerW, setContainerW] = useState(360);
  const [containerH, setContainerH] = useState(480);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1); // 1 = 전체보기(페이지 전체 맞춤)

  const numPages = pdf?.numPages ?? 0;
  const safePage = Math.min(pageIndex, Math.max(0, numPages - 1));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => { setContainerW(el.clientWidth || 360); setContainerH(el.clientHeight || 480); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 페이지 전체가 보이는 기본 스케일(폭·높이 맞춤) × 확대율
  const fitW = (containerW - 24) / (pageBaseW || 595);
  const fitH = (containerH - 16) / (pageBaseH || 842);
  const baseScale = clamp(Math.min(fitW, fitH) * (big ? 0.98 : 0.92), 0.15, 3);
  const scale = baseScale * zoom;

  // 휠 → 커서 위치 기준 확대/축소 (네이티브 non-passive 리스너로 preventDefault 보장)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      const contentX = el.scrollLeft + offX;
      const contentY = el.scrollTop + offY;
      setZoom((z) => {
        const nz = clamp(+(z * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3), 0.4, 4);
        const k = nz / z;
        requestAnimationFrame(() => {
          if (!wrapRef.current) return;
          wrapRef.current.scrollLeft = contentX * k - offX;
          wrapRef.current.scrollTop = contentY * k - offY;
        });
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 드래그로 화면 이동(팬). 입력창 위에서 시작하면 편집으로 넘김.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
    const down = (e) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.closest && t.closest('[data-sign]')))) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY; sl = el.scrollLeft; st = el.scrollTop;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      el.scrollLeft = sl - (e.clientX - sx);
      el.scrollTop = st - (e.clientY - sy);
    };
    const up = () => { dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const ctrlBtn = 'w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-outline-variant/60 bg-white">
        <div className="flex items-center gap-1.5">
          <button className={ctrlBtn} disabled={safePage <= 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))} title="이전 페이지">
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <span className="text-xs font-bold text-on-surface w-14 text-center">{safePage + 1} / {numPages}</span>
          <button className={ctrlBtn} disabled={safePage >= numPages - 1} onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))} title="다음 페이지">
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={ctrlBtn}
            onClick={() => { setZoom(1); if (wrapRef.current) { wrapRef.current.scrollLeft = 0; wrapRef.current.scrollTop = 0; } }}
            title="원래 크기"
          >
            <span className="material-symbols-outlined text-base">fit_screen</span>
          </button>
          <button className={ctrlBtn} disabled={zoom <= 0.4} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)))} title="축소">
            <span className="material-symbols-outlined text-base">zoom_out</span>
          </button>
          <span className="text-xs text-on-surface-variant w-10 text-center">{Math.round(scale * 100)}%</span>
          <button className={ctrlBtn} disabled={zoom >= 4} onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="확대">
            <span className="material-symbols-outlined text-base">zoom_in</span>
          </button>
          {onToggleFullscreen && (
            <button className={ctrlBtn} onClick={onToggleFullscreen} title={big ? '전체화면 닫기' : '전체화면으로 크게 보기'}>
              <span className="material-symbols-outlined text-base">{big ? 'close_fullscreen' : 'fullscreen'}</span>
            </button>
          )}
        </div>
      </div>

      <div ref={wrapRef} className="flex-1 overflow-auto bg-slate-100 min-h-0" style={{ cursor: 'grab' }}>
        <div className="w-max min-w-full flex justify-center p-3">
          <PdfPage
            key={safePage}
            pdf={pdf}
            pageNum={safePage + 1}
            pageIndex={safePage}
            scale={scale}
            pageFields={perPage[safePage] || []}
            fields={fields}
            onEditField={onEditField}
            signatures={signatures}
            onRequestSign={onRequestSign}
          />
        </div>
      </div>
      <p className="shrink-0 text-[10px] text-on-surface-variant text-center py-1 bg-white border-t border-outline-variant/60">
        마우스 휠로 확대/축소 · 드래그로 이동
      </p>
    </div>
  );
}

function FormPdfOverlay({ templateId, fieldMappings, fields, onEditField, signatures, onSign, prevSignature }) {
  const [pdf, setPdf] = useState(null);
  const [pageBaseW, setPageBaseW] = useState(595);
  const [pageBaseH, setPageBaseH] = useState(842);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [signing, setSigning] = useState(null); // { id, label } 서명 중인 필드

  const perPage = normalizePerPage(fieldMappings);

  useEffect(() => {
    if (templateId == null) { setPdf(null); return; }
    let cancelled = false;
    let doc = null;
    setLoading(true); setError(false); setPdf(null); setFullscreen(false);
    getFormPdfBlobApi(templateId)
      .then((blob) => blob.arrayBuffer())
      .then((buf) => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async (d) => {
        if (cancelled) { d.destroy(); return; }
        doc = d;
        try { const vp1 = (await d.getPage(1)).getViewport({ scale: 1 }); if (!cancelled) { setPageBaseW(vp1.width); setPageBaseH(vp1.height); } } catch { /* ignore */ }
        if (!cancelled) setPdf(d);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (doc) doc.destroy(); };
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-3xl animate-spin opacity-40">progress_activity</span>
        <p className="text-xs">서식(PDF) 불러오는 중...</p>
      </div>
    );
  }
  if (error || !pdf) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant text-center px-6">
        <span className="material-symbols-outlined text-4xl opacity-25">picture_as_pdf</span>
        <p className="text-xs">서식 PDF를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const viewerProps = { pdf, pageBaseW, pageBaseH, perPage, fields, onEditField, signatures, onRequestSign: (id, label) => setSigning({ id, label }) };

  return (
    <>
      <PdfViewer {...viewerProps} onToggleFullscreen={() => setFullscreen(true)} />

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col" onClick={() => setFullscreen(false)}>
          <div className="flex items-center justify-between px-4 py-2.5 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-bold">서식 미리보기 (전체화면)</span>
            <button onClick={() => setFullscreen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" title="닫기">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 mx-2 mb-2 bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <PdfViewer {...viewerProps} big onToggleFullscreen={() => setFullscreen(false)} />
          </div>
        </div>
      )}

      <SignaturePad
        open={!!signing}
        label={signing?.label || '서명'}
        prevSignature={prevSignature}
        onClose={() => setSigning(null)}
        onSave={(url) => { if (signing) onSign?.(signing.id, url); }}
      />
    </>
  );
}

export default FormPdfOverlay;
