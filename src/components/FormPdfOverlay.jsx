import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { renderFilledPages } from '../utils/formPdf';
import {
  normalizePerPage, fieldName, fieldPos, fieldSize,
  isSignatureField, isCheckboxField, isMultilineField,
  sigId, sigBoxMM,
} from '../utils/formMappings';
import SignaturePad from './SignaturePad';

const MM_TO_PT = 72 / 25.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function FullscreenWrapper({ children, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

// 필드 오버레이 (편집 + 위치 확인)
function FieldOverlay({ pg, safePage, perPage, imgW, fields, onEditField, signatures, onRequestSign }) {
  if (!pg || imgW <= 0) return null;
  const scale = imgW / pg.wPt;

  return (
    <>
      {(perPage[safePage] || []).map((f, i) => {
        const name = fieldName(f);
        const [xmm, ymm] = fieldPos(f);
        const left = xmm * MM_TO_PT * scale;
        const top  = (pg.hPt - ymm * MM_TO_PT) * scale;
        const fs   = fieldSize(f) * scale;

        if (isSignatureField(f)) {
          const id = sigId(safePage, f);
          const sig = signatures?.[id];
          const [swmm, shmm] = sigBoxMM(f);
          const wPx = Math.max(swmm, 30) * MM_TO_PT * scale;
          const hPx = Math.max(shmm, 7)  * MM_TO_PT * scale;
          return (
            <button key={i} data-sign="1"
              onClick={() => onRequestSign?.(id, name)}
              title={sig ? '서명 수정' : '여기에 서명'}
              style={{ position: 'absolute', left: left - wPx / 3, top: top - hPx * 0.40, width: wPx, height: hPx }}
              className={`flex items-center justify-center rounded-sm border-2 bg-transparent cursor-pointer transition-colors overflow-hidden ${
                sig ? 'border-emerald-400' : 'border-primary/60 hover:bg-primary/10'
              }`}
            >
              {sig
                ? <span className="material-symbols-outlined absolute bottom-0.5 right-0.5 text-emerald-600 bg-white/80 rounded-sm" style={{ fontSize: 14 }}>edit</span>
                : <span className="material-symbols-outlined text-primary" style={{ fontSize: Math.min(fs * 0.8, wPx * 0.6, hPx * 0.6) }}>draw</span>
              }
            </button>
          );
        }

        if (isCheckboxField(f)) {
          const checked = !!(fields[name]);
          const boxSize = Math.max(fs * 1.1, 9);
          // formPdf.js 와 동일한 mm 오프셋 적용 → 두 위치 일치
          const cbLeft = (xmm - 1) * MM_TO_PT * scale;
          const cbTop  = (pg.hPt - (ymm - 0.5) * MM_TO_PT) * scale;
          return (
            <button key={i} type="button"
              onClick={() => onEditField(name, checked ? '' : 'V')}
              title={name}
              style={{ position: 'absolute', left: cbLeft, top: cbTop - boxSize, width: boxSize, height: boxSize }}
              className={`flex items-center justify-center bg-transparent border-2 rounded-[2px] transition-colors ${
                checked ? 'border-primary text-primary bg-primary/10' : 'border-primary/40 hover:border-primary/70'
              }`}
            >
              {checked && (
                <span className="material-symbols-outlined text-primary" style={{ fontSize: Math.max(boxSize * 0.8, 8) }}>check</span>
              )}
            </button>
          );
        }

        if (isMultilineField(f)) {
          const fwPt = Number(f?.width) ? Number(f.width) * MM_TO_PT : 200;
          const fhPt = Number(f?.height) ? Number(f.height) * MM_TO_PT : fs * 3;
          return (
            <textarea key={i}
              value={fields[name] ?? ''}
              onChange={(e) => onEditField(name, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
              title={name}
              style={{ position: 'absolute', left, top: top - fhPt * scale, width: fwPt * scale, height: fhPt * scale, fontSize: Math.max(fs, 6), lineHeight: 1.3, padding: '1px 2px', resize: 'none', textAlign: f?.align || 'left' }}
              className="bg-transparent outline-none text-transparent focus:text-black border border-transparent hover:border-primary/40 focus:border-primary/60 rounded-[2px] overflow-hidden transition-colors"
            />
          );
        }

        const fwPt = Number(f?.width) ? Number(f.width) * MM_TO_PT
          : /주소|내용|사유|명세|물건|소재지/.test(name) ? 200 : 90;
        const fw = fwPt * scale;
        const maxLength = Math.max(4, Math.floor(fw / Math.max(fs * 0.55, 4)));
        return (
          <input key={i} type="text"
            value={fields[name] ?? ''}
            onChange={(e) => onEditField(name, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') e.currentTarget.blur(); }}
            maxLength={maxLength}
            title={name}
            style={{ position: 'absolute', left, top: top - fs, width: fw, height: fs * 1.5, fontSize: Math.max(fs, 6), lineHeight: 1.1, padding: '0 2px', textAlign: f?.align || 'left' }}
            className="bg-transparent outline-none text-transparent focus:text-black border border-transparent hover:border-primary/40 focus:border-primary/60 rounded-[2px] transition-colors"
          />
        );
      })}
    </>
  );
}

// 줌/패닝 + 이미지 + 오버레이를 갖는 독립 뷰어 (각 인스턴스가 자체 상태 보유)
function PagePreview({ pg, safePage, perPage, fields, onEditField, signatures, onRequestSign }) {
  const wrapRef       = useRef(null);
  const imgRef        = useRef(null);
  const scrollAnchor  = useRef(null); // 줌 시 커서 기준 스크롤 보정용
  const [zoom,  setZoom]  = useState(1);
  const [baseW, setBaseW] = useState(600);
  const [imgW,  setImgW]  = useState(0);

  // 컨테이너 너비 (이미지 기준 너비 = baseW * zoom)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setBaseW(Math.max(el.clientWidth - 24, 200));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // imgW: 실제 렌더된 이미지 너비 → FieldOverlay 좌표 변환
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const update = () => setImgW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pg]);

  // zoom 바뀌면 useLayoutEffect에서 스크롤 보정 (페인트 전)
  useLayoutEffect(() => {
    const anchor = scrollAnchor.current;
    if (!anchor || !wrapRef.current) return;
    wrapRef.current.scrollLeft = anchor.cx * anchor.k - anchor.offX;
    wrapRef.current.scrollTop  = anchor.cy * anchor.k - anchor.offY;
    scrollAnchor.current = null;
  }, [zoom]);

  // 마우스 휠 → 줌 (커서 기준)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      // 커서가 가리키는 콘텐츠 좌표 (현재 스크롤 포함)
      const cx = offX + el.scrollLeft;
      const cy = offY + el.scrollTop;
      setZoom((z) => {
        const nz = clamp(+(z * (e.deltaY < 0 ? 1.15 : 0.87)).toFixed(3), 0.3, 5);
        scrollAnchor.current = { cx, cy, offX, offY, k: nz / z };
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 왼쪽 드래그 → 패닝
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let drag = false, sx = 0, sy = 0, sl = 0, st = 0;
    const down = (e) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest?.('[data-sign]'))) return;
      drag = true;
      sx = e.clientX; sy = e.clientY;
      sl = el.scrollLeft; st = el.scrollTop;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const move = (e) => { if (!drag) return; el.scrollLeft = sl - (e.clientX - sx); el.scrollTop = st - (e.clientY - sy); };
    const up   = () => { drag = false; el.style.cursor = 'grab'; };
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { el.removeEventListener('mousedown', down); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  return (
    <div ref={wrapRef} className="flex-1 overflow-auto bg-slate-100 min-h-0 relative" style={{ cursor: 'grab' }}>
      <div style={{ minWidth: '100%', minHeight: '100%', padding: 12, boxSizing: 'border-box' }}>
        {pg ? (
          <div className="relative shadow-lg" style={{ width: baseW * zoom, margin: '0 auto' }}>
            <img ref={imgRef} src={pg.img} alt="서식" draggable={false} style={{ display: 'block', width: '100%' }} />
            <FieldOverlay pg={pg} safePage={safePage} perPage={perPage} imgW={imgW} fields={fields} onEditField={onEditField} signatures={signatures} onRequestSign={onRequestSign} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-32 gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl opacity-25">picture_as_pdf</span>
            <p className="text-xs">서식을 선택해 주세요.</p>
          </div>
        )}
      </div>
      {/* 배율 표시 */}
      {pg && (
        <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none select-none">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}

function FormPdfOverlay({ templateId, fieldMappings, fields, onEditField, signatures, onSign, prevSignature }) {
  const [pages,     setPages]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [signing,   setSigning]   = useState(null);

  const perPage = normalizePerPage(fieldMappings);

  useEffect(() => {
    if (templateId == null) { setPages([]); return; }
    setLoading(true); setError(false);
    const t = setTimeout(async () => {
      try {
        const result = await renderFilledPages(templateId, fieldMappings, fields, signatures);
        setPages(result);
      } catch { setError(true); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [templateId, fields, signatures]); // eslint-disable-line react-hooks/exhaustive-deps

  const numPages = pages.length;
  const safePage = Math.min(pageIndex, Math.max(0, numPages - 1));
  const pg = pages[safePage];

  const ctrlBtn = 'w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  const toolbar = (onToggle, isBig) => (
    <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-outline-variant/60 bg-white">
      <div className="flex items-center gap-1.5">
        <button className={ctrlBtn} disabled={safePage <= 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))} title="이전 페이지">
          <span className="material-symbols-outlined text-base">chevron_left</span>
        </button>
        <span className="text-xs font-bold text-on-surface w-14 text-center">
          {numPages ? `${safePage + 1} / ${numPages}` : '- / -'}
        </span>
        <button className={ctrlBtn} disabled={safePage >= numPages - 1} onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))} title="다음 페이지">
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {loading && <span className="material-symbols-outlined text-base animate-spin text-primary opacity-60">progress_activity</span>}
        <button className={ctrlBtn} onClick={onToggle} title={isBig ? '전체화면 닫기' : '전체화면'}>
          <span className="material-symbols-outlined text-base">{isBig ? 'close_fullscreen' : 'fullscreen'}</span>
        </button>
      </div>
    </div>
  );

  const onRequestSign = (id, label) => setSigning({ id, label });

  const previewProps = { pg, safePage, perPage, fields, onEditField, signatures, onRequestSign };

  return (
    <>
      {/* 메인 뷰어 */}
      <div className="flex flex-col h-full min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-25">picture_as_pdf</span>
            <p className="text-xs">서식 PDF를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <>
            {toolbar(() => setFullscreen(true), false)}
            <PagePreview key={`main-${safePage}`} {...previewProps} />
            <p className="shrink-0 text-[10px] text-on-surface-variant text-center py-1 bg-white border-t border-outline-variant/60">
              휠 확대/축소 · 드래그 이동 · 필드 클릭 수정
            </p>
          </>
        )}
      </div>

      {/* 전체화면 */}
      {fullscreen && (
        <FullscreenWrapper onClose={() => setFullscreen(false)}>
          <div className="flex items-center justify-between px-4 py-2.5 text-white shrink-0">
            <span className="text-sm font-bold">서식 미리보기 (전체화면)</span>
            <button onClick={() => setFullscreen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors" title="닫기 (ESC)">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 mx-2 mb-2 bg-white rounded-lg overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && setFullscreen(false)}>
            {toolbar(() => setFullscreen(false), true)}
            <PagePreview key={`fs-${safePage}`} {...previewProps} />
            <p className="shrink-0 text-[10px] text-on-surface-variant text-center py-1 bg-white border-t border-outline-variant/60">
              휠 확대/축소 · 드래그 이동 · 필드 클릭 수정
            </p>
          </div>
        </FullscreenWrapper>
      )}

      <SignaturePad
        open={!!signing}
        label={signing?.label || '서명'}
        prevSignature={prevSignature}
        onClose={() => setSigning(null)}
        onSave={(url) => { if (signing) onSign?.(signing.id, url); setSigning(null); }}
      />
    </>
  );
}

export default FormPdfOverlay;
