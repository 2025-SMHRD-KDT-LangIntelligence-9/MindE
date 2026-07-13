import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getFormPdfBlobApi } from '../api/forms';
import { normalizePerPage, fieldName, fieldPos, fieldSize, isSignatureField, sigId, sigBoxMM } from './formMappings';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const MM_TO_PT = 72 / 25.4;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// 원본 PDF 를 캔버스로 렌더 → 필드 값·서명을 좌표대로 그림 → 페이지별 이미지 반환.
// (캔버스 텍스트는 브라우저 시스템 폰트로 한글 정상 렌더 → 폰트 임베드 불필요)
export async function renderFilledPages(templateId, fieldMappings, fields, signatures = {}) {
  const blob = await getFormPdfBlobApi(templateId);
  const buf = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const perPage = normalizePerPage(fieldMappings);
  const RENDER_SCALE = 2; // 고해상도 렌더

  const pages = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      // 필드 값 그리기
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'alphabetic';
      (perPage[p - 1] || []).forEach((f) => {
        if (isSignatureField(f)) return;
        const name = fieldName(f);
        const val = fields[name];
        if (val == null || String(val).trim() === '') return;
        const [xmm, ymm] = fieldPos(f);

        // 체크박스 V: -2mm 왼쪽, +0.5mm 위 오프셋 (xmm이 체크박스 우측을 가리킴)
        const isCheckbox = /\[\s*\]|□/.test(name);
        const offXmm = isCheckbox ? -1 : 0;
        const offYmm = isCheckbox ? -0.5 : 0;

        const [vx, vy] = vp.convertToViewportPoint(
          (xmm + offXmm) * MM_TO_PT,
          (ymm + offYmm) * MM_TO_PT,
        );

        // field.size (pt) 그대로 사용. 체크박스 V는 최소 12pt.
        const rawPt = fieldSize(f); // pt 단위
        const fsPt = isCheckbox ? Math.max(rawPt, 12) : rawPt;
        const fsPx = fsPt * RENDER_SCALE;

        ctx.font = `${fsPx}px "Malgun Gothic","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
        ctx.textAlign = f?.align || 'left';
        ctx.fillText(String(val), vx, vy);
        ctx.textAlign = 'left'; // 기본값 복원
      });

      // 서명 이미지 그리기 (위치는 백엔드 좌표, 크기는 보이게 표시)
      for (const f of (perPage[p - 1] || [])) {
        if (!isSignatureField(f)) continue;
        const id = sigId(p - 1, f);
        const sig = signatures?.[id];
        if (!sig) continue;
        const [xmm, ymm] = fieldPos(f);
        const [vx, vy] = vp.convertToViewportPoint(xmm * MM_TO_PT, ymm * MM_TO_PT);
        try {
          const im = await loadImage(sig);
          const [swmm, shmm] = sigBoxMM(f);
          const dh   = Math.max(shmm, 7)  * MM_TO_PT * RENDER_SCALE;  // 최소 7mm
          const maxW = Math.max(swmm, 30) * MM_TO_PT * RENDER_SCALE;  // 최소 30mm
          let dw = dh * (im.width / im.height);        // 비율 유지
          if (dw > maxW) dw = maxW;
          const left = Math.max(0, Math.min(vx - dw / 3, vp.width - dw));
          const top  = Math.max(0, Math.min(vy - dh * 0.58, vp.height - dh));
          ctx.drawImage(im, left, top, dw, dh);
        } catch { /* 이미지 로드 실패 무시 */ }
      }

      pages.push({
        img: canvas.toDataURL('image/jpeg', 0.92),
        wPt: vp.width / RENDER_SCALE,
        hPt: vp.height / RENDER_SCALE,
      });
    }
  } finally {
    doc.destroy();
  }
  return pages;
}
