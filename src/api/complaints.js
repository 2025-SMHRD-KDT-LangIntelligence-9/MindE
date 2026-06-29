import client from './client';
import { toKoreanStatus, toEnglishStatus } from './statusMap';

const toKoreanUrgency = (score) => {
  if (score >= 0.7) return '긴급';
  if (score >= 0.4) return '보통';
  return '낮음';
};

const transform = (c) => ({
  id:          String(c.complaint_id),
  title:       c.title,
  content:     c.content,
  category:    c.category    ?? '기타',
  dept:        c.department  ?? '민원처리과',
  citizen:     c.citizen_name ?? '',
  citizenId:   String(c.user_id ?? ''),
  status:      toKoreanStatus(c.status),
  urgency:     toKoreanUrgency(c.urgency_score ?? 0.4),
  receivedAt:  c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : '',
  updatedAt:   c.updated_at ? new Date(c.updated_at).toLocaleString('ko-KR') : '',
  memo:        c.memo        ?? '',
  reply:       c.reply       ?? null,
  replyDate:   c.reply_date  ?? null,
  citizenFiles: c.attachments ?? [],
});

export const getComplaintsApi = () =>
  client.get('/complaints').then((r) => r.data.map(transform));

export const getComplaintApi = (id) =>
  client.get(`/complaints/${id}`).then((r) => transform(r.data));

export const addComplaintApi = (data) =>
  client.post('/complaints', data).then((r) => transform(r.data));

export const updateComplaintStatusApi = (id, koreanStatus) =>
  client.patch(`/complaints/${id}/status`, { status: toEnglishStatus(koreanStatus) }).then((r) => r.data);

export const getComplaintHistoryApi = (id) =>
  client.get(`/complaints/${id}/history`).then((r) => r.data);
