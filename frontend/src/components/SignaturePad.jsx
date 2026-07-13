import { useRef, useEffect, useState } from 'react';

// 서명 획 영역만 잘라 투명 PNG 로 반환 (빈 여백 제거 → 박스에 정확히 채워짐)
function trimToDataUrl(c) {
  const ctx = c.getContext('2d');
  const { width, height } = c;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        found = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return c.toDataURL('image/png');
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

// 마우스/터치로 서명을 그려 PNG data URL 로 반환하는 모달
function SignaturePad({ open, label, prevSignature, onClose, onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); // 투명 배경 (배경 없이 획만 저장)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  }, [open]);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (c.width / r.width), y: (p.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasDrawn(true);
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };
  const save = () => {
    if (!hasDrawn) return;
    onSave(trimToDataUrl(canvasRef.current));
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-outline-variant flex items-center justify-between">
          <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-base">draw</span>
            {label || '서명'}
          </p>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4">
          <canvas
            ref={canvasRef}
            width={440}
            height={180}
            className="w-full border-2 border-dashed border-outline-variant rounded-xl bg-white cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          <p className="text-[11px] text-on-surface-variant mt-1.5">위 영역에 마우스나 손가락으로 서명해 주세요.</p>
        </div>
        <div className="px-4 pb-4 space-y-2">
          {prevSignature && (
            <button
              onClick={() => { onSave(prevSignature); onClose(); }}
              className="w-full py-2 rounded-xl border border-primary/40 text-primary text-sm font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">history</span>
              이전 서명 사용
              <img src={prevSignature} alt="" className="h-5 ml-1 object-contain" />
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={clear}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              지우기
            </button>
            <button
              onClick={save}
              disabled={!hasDrawn}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              서명 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignaturePad;
