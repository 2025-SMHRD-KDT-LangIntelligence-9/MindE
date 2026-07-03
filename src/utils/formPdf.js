import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jsPDF from 'jspdf';
import { getFormPdfBlobApi } from '../api/forms';
import { normalizePerPage, fieldName, fieldPos, fieldSize, isSignatureField, sigId } from './formMappings';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const MM_TO_PT = 72 / 25.4;
// 서명 표시 크기(mm) — 백엔드 서명란이 너무 작아(예: 3mm) 안 보이므로 보이는 크기로 그림
const SIG_DRAW_H_MM = 9;
const SIG_DRAW_MAXW_MM = 45;

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
        const [vx, vy] = vp.convertToViewportPoint(xmm * MM_TO_PT, ymm * MM_TO_PT);
        const fs = fieldSize(f) * RENDER_SCALE;
        ctx.font = `${fs}px "Malgun Gothic","Noto Sans KR","Apple SD Gothic Neo",sans-serif`;
        ctx.fillText(String(val), vx, vy);
      });

      // 서명 이미지 그리기 (위치는 백엔드 좌표, 크기는 보이게 표시)
      for (const f of (perPage[p - 1] || [])) {
        if (!isSignatureField(f)) continue;
        const id = sigId(p - 1, f);
        const sig = signatures?.[id];
        // eslint-disable-next-line no-console
        console.log('[renderFilledPages] sig field', id, 'found:', !!sig, 'dictKeys:', Object.keys(signatures || {}));
        if (!sig) continue;
        const [xmm, ymm] = fieldPos(f);
        const [vx, vy] = vp.convertToViewportPoint(xmm * MM_TO_PT, ymm * MM_TO_PT);
        try {
          const im = await loadImage(sig);
          const dh = SIG_DRAW_H_MM * MM_TO_PT * RENDER_SCALE;          // 표시 높이
          let dw = dh * (im.width / im.height);                        // 비율 유지
          const maxW = SIG_DRAW_MAXW_MM * MM_TO_PT * RENDER_SCALE;
          if (dw > maxW) dw = maxW;
          let left = vx - dw / 2;                                      // 앵커 중심 정렬
          left = Math.max(0, Math.min(left, vp.width - dw));           // 페이지 안으로 클램프
          let top = vy - dh;
          top = Math.max(0, Math.min(top, vp.height - dh));
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

// 렌더된 페이지 이미지들을 PDF 로 조립해 저장(다운로드)
export function savePagesAsPdf(pages, fileName = '민원서식.pdf') {
  let out = null;
  for (const pg of pages) {
    const orientation = pg.wPt > pg.hPt ? 'landscape' : 'portrait';
    if (!out) out = new jsPDF({ unit: 'pt', format: [pg.wPt, pg.hPt], orientation });
    else out.addPage([pg.wPt, pg.hPt], orientation);
    out.addImage(pg.img, 'JPEG', 0, 0, pg.wPt, pg.hPt);
  }
  if (out) out.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

// 렌더 후 바로 저장 (기존 호환)
export async function downloadFilledPdf(templateId, fieldMappings, fields, fileName = '민원서식.pdf', signatures = {}) {
  const pages = await renderFilledPages(templateId, fieldMappings, fields, signatures);
  savePagesAsPdf(pages, fileName);
}
