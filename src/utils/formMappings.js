// 서식 field_mappings 정규화 유틸.
// 백엔드 구조가 확정 전이라, 아래 여러 형태를 모두 방어적으로 처리한다.
//   - 페이지별 배열:  [[{...}, {...}], [], ...]
//   - 평면 배열:      [{ page, ... }, ...]
//   - 페이지 키 객체: { "0": [...], "1": [...] }

// 서명 박스 크기(mm) = 백엔드가 준 값 그대로 (프론트 보정 없음).
// size[w,h] 또는 width/height 사용. 값이 없을 때만 최소한의 클릭 영역 확보.
export const sigBoxMM = (f) => {
  const s = Array.isArray(f?.size) ? f.size : [f?.width, f?.height];
  return [Number(s?.[0]) || 6, Number(s?.[1]) || 6];
};

export const fieldName = (f) => f?.name ?? f?.key ?? f?.id ?? '';

// [x, y] 좌표 (PDF 사용자 좌표, 하단 기준일 수 있음)
export const fieldPos = (f) => {
  if (Array.isArray(f?.position)) return [Number(f.position[0]) || 0, Number(f.position[1]) || 0];
  if (f?.position && typeof f.position === 'object') return [Number(f.position.x) || 0, Number(f.position.y) || 0];
  if (f?.x != null) return [Number(f.x) || 0, Number(f.y) || 0];
  return [0, 0];
};

export const fieldSize = (f) => Number(f?.size ?? f?.font_size ?? 11) || 11;

// 서명/이미지 필드 여부
export const isSignatureField = (f) => f?.type === 'image' || f?.type === 'signature';

// 체크박스 필드 여부 - type이 checkbox이거나 이름에 [] / □ 포함 (백엔드는 type:"text"로 내려오고 이름으로 구분)
export const isCheckboxField = (f) => f?.type === 'checkbox' || /\[\s*\]|□/.test(fieldName(f));

// 서명 필드 고유 키 (같은 이름이 여러 곳이어도 위치로 구분 → 누른 곳에만 서명)
export const sigId = (pageIndex, f) => { const [x, y] = fieldPos(f); return `${pageIndex}:${x}:${y}`; };

// 여러 줄 입력 여부 (height 가 크거나 multiline 플래그)
export const isMultilineField = (f) => !!f?.multiline || (Number(f?.height) || 0) > 40;

// 페이지별 배열로 정규화 (index = 0-based 페이지)
export function normalizePerPage(fm) {
  if (!fm) return [];
  if (Array.isArray(fm) && fm.length && Array.isArray(fm[0])) return fm.map((a) => a || []);
  if (Array.isArray(fm)) {
    const maxPage = fm.reduce((m, f) => Math.max(m, f?.page ?? 0), 0);
    const pages = Array.from({ length: maxPage + 1 }, () => []);
    fm.forEach((f) => { pages[f?.page ?? 0].push(f); });
    return pages;
  }
  if (typeof fm === 'object') {
    const entries = Object.entries(fm).map(([k, v]) => [Number(k) || 0, v]);
    const maxPage = entries.reduce((m, [k]) => Math.max(m, k), 0);
    const pages = Array.from({ length: maxPage + 1 }, () => []);
    entries.forEach(([k, v]) => { if (Array.isArray(v)) pages[k] = v; });
    return pages;
  }
  return [];
}

export const flattenMappings = (fm) => normalizePerPage(fm).flat();
