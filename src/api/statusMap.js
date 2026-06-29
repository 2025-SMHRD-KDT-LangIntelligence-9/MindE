// 백엔드 status 값 → 프론트 한국어
const STATUS_TO_KO = {
  received:        '접수',
  assigned:        '배정',
  in_progress:     '처리 중',
  needs_more_info: '보완 요청',
  answered:        '답변완료',
  closed:          '완료',
  rejected:        '반려',
};

// 프론트 한국어 → 백엔드 status 값
const STATUS_TO_EN = {
  '접수':     'received',
  '배정':     'assigned',
  '처리 중':  'in_progress',
  '보완 요청':'needs_more_info',
  '답변완료': 'answered',
  '완료':     'closed',
  '반려':     'rejected',
};

export const toKoreanStatus = (s) => STATUS_TO_KO[s] ?? s;
export const toEnglishStatus = (s) => STATUS_TO_EN[s] ?? s;
