import { useRef, useEffect, useLayoutEffect, useState } from 'react';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function ZoomableImage({ src, alt }) {
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [baseW, setBaseW] = useState(600);

  // 컨테이너 너비 측정 (이미지 픽셀 너비 = baseW * zoom)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setBaseW(Math.max(el.clientWidth - 32, 200));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollAnchor = useRef(null);

  useLayoutEffect(() => {
    const anchor = scrollAnchor.current;
    if (!anchor || !wrapRef.current) return;
    wrapRef.current.scrollLeft = anchor.cx * anchor.k - anchor.offX;
    wrapRef.current.scrollTop  = anchor.cy * anchor.k - anchor.offY;
    scrollAnchor.current = null;
  }, [zoom]);

  // 마우스 휠 → 확대/축소 (커서 위치 기준)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
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

  // 마우스 왼쪽 드래그 → 이동(패닝)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let drag = false, sx = 0, sy = 0, sl = 0, st = 0;
    const down = (e) => {
      if (e.button !== 0) return;
      drag = true;
      sx = e.clientX; sy = e.clientY;
      sl = el.scrollLeft; st = el.scrollTop;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const move = (e) => {
      if (!drag) return;
      el.scrollLeft = sl - (e.clientX - sx);
      el.scrollTop  = st - (e.clientY - sy);
    };
    const up = () => { drag = false; el.style.cursor = 'grab'; };
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full h-full overflow-auto select-none bg-slate-100"
      style={{ cursor: 'grab' }}
    >
      <div style={{ minWidth: '100%', minHeight: '100%', padding: 16, boxSizing: 'border-box' }}>
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ display: 'block', width: baseW * zoom, maxWidth: 'none', margin: '0 auto' }}
          className="shadow-lg border border-slate-200"
        />
      </div>
      <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none select-none">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

export default ZoomableImage;
