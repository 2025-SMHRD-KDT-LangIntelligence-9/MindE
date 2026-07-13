import client from './client';

const getTitle = (msg) => {
  if (!msg) return '알림';
  if (msg.includes('공식 답변')) return '답변 등록';
  if (msg.includes('상태가')) return '상태 변경';
  return '알림';
};
const getIcon = (msg) => (msg?.includes('답변') ? 'mark_email_read' : 'swap_horiz');
const getColor = (msg) => (msg?.includes('공식 답변') ? 'text-emerald-500' : 'text-primary');

// 알림 메시지에서 쓰는 상태 용어 → STATUS_STYLE 키로 정규화
// (예: 백엔드 알림은 '완료' 대신 '종료', 띄어쓰기 없는 '처리중' 등을 사용)
const NOTIF_STATUS_MAP = {
  '접수':     '접수',
  '배정':     '배정',
  '처리중':   '처리 중',
  '처리 중':  '처리 중',
  '보완요청': '보완 요청',
  '보완 요청':'보완 요청',
  '답변완료': '답변완료',
  '답변':     '답변완료',
  '종료':     '완료',
  '완료':     '완료',
  '반려':     '반려',
};

const getTag = (msg) => {
  if (!msg) return '';
  // "민원 상태가 [종료](으)로 변경되었습니다" 형태 → 대괄호 안 상태명 우선 추출
  const bracket = msg.match(/\[([^\]]+)\]/);
  if (bracket && NOTIF_STATUS_MAP[bracket[1].trim()]) return NOTIF_STATUS_MAP[bracket[1].trim()];
  // 대괄호가 없는 메시지(답변 등록 등) fallback
  for (const [word, tag] of Object.entries(NOTIF_STATUS_MAP)) {
    if (msg.includes(word)) return tag;
  }
  return '';
};

const transform = (n) => ({
  id:          String(n.notification_id ?? n.id ?? ''),
  complaintId: String(n.complaint_id ?? ''),
  title:       getTitle(n.message),
  desc:        n.message ?? '',
  icon:        getIcon(n.message),
  color:       getColor(n.message),
  tag:         getTag(n.message) || n.type || '',
  time:        n.sent_at ? new Date(n.sent_at).toLocaleString('ko-KR') : '',
  read:        n.is_read ?? false,
});

export const getNotificationsApi = () =>
  client.get('/notifications').then((r) => r.data.map(transform));

export const markAllReadApi = () =>
  client.patch('/notifications/read-all').then((r) => r.data);

export const markOneReadApi = (notificationId) =>
  client.patch(`/notifications/${notificationId}/read`).then((r) => r.data);
