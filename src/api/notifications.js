import client from './client';

const getTitle = (msg) => {
  if (!msg) return '알림';
  if (msg.includes('공식 답변')) return '답변 등록';
  if (msg.includes('상태가')) return '상태 변경';
  return '알림';
};
const getIcon = (msg) => (msg?.includes('답변') ? 'mark_email_read' : 'swap_horiz');
const getColor = (msg) => (msg?.includes('공식 답변') ? 'text-emerald-500' : 'text-primary');

const getTag = (msg) => {
  if (!msg) return '';
  if (msg.includes('완료')) return '완료';
  if (msg.includes('반려')) return '반려';
  if (msg.includes('보완')) return '보완 요청';
  if (msg.includes('처리 중')) return '처리 중';
  if (msg.includes('배정')) return '배정';
  if (msg.includes('답변')) return '답변완료';
  return '';
};

const transform = (n) => ({
  id:          String(n.notification_id ?? n.id ?? ''),
  complaintId: String(n.complaint_id ?? ''),
  title:       getTitle(n.message),
  desc:        n.message ?? '',
  icon:        getIcon(n.message),
  color:       getColor(n.message),
  tag:         n.type ?? getTag(n.message),
  time:        n.sent_at ? new Date(n.sent_at).toLocaleString('ko-KR') : '',
  read:        n.is_read ?? false,
});

export const getNotificationsApi = () =>
  client.get('/notifications').then((r) => r.data.map(transform));

export const markAllReadApi = () =>
  client.patch('/notifications/read-all').then((r) => r.data);

export const markOneReadApi = (notificationId) =>
  client.patch(`/notifications/${notificationId}/read`).then((r) => r.data);
