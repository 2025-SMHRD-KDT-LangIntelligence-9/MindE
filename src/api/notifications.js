import client from './client';

const transform = (n) => ({
  id:          String(n.notification_id ?? n.id ?? ''),
  complaintId: String(n.complaint_id ?? ''),
  title:       n.title   ?? '알림',
  desc:        n.message ?? '',
  icon:        'notifications',
  color:       'text-primary',
  tag:         n.status  ?? '',
  time:        n.sent_at ? new Date(n.sent_at).toLocaleString('ko-KR') : '',
  read:        n.is_read ?? false,
});

export const getNotificationsApi = () =>
  client.get('/notifications').then((r) => r.data.map(transform));

export const markAllReadApi = () =>
  client.patch('/notifications/read-all').then((r) => r.data);
