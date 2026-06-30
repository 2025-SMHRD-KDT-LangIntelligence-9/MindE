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
  createdDate: c.created_at ? c.created_at.slice(0, 10) : '',
  updatedAt:   c.updated_at ? new Date(c.updated_at).toLocaleString('ko-KR') : '',
  memo:        c.memo        ?? '',
  reply:       c.reply       ?? null,
  replyDate:   c.reply_date  ?? null,
  citizenFiles: c.attachments ?? [],
});

export const getComplaintsApi = () =>
  client.get('/complaints').then((r) => r.data.map(transform));

// staff/admin 전용: 전체 민원 목록
export const getAllComplaintsApi = () =>
  client.get('/admin/complaints').then((r) => r.data.map(transform));

export const getComplaintApi = (id) =>
  client.get(`/complaints/${id}`).then((r) => transform(r.data));

export const addComplaintApi = (data) =>
  client.post('/complaints', data).then((r) => transform(r.data));

export const updateComplaintStatusApi = (id, koreanStatus, note = null) =>
  client.patch(`/complaints/${id}/status`, {
    status: toEnglishStatus(koreanStatus),
    ...(note && { note }),
  }).then((r) => r.data);

export const getComplaintHistoryApi = (id) =>
  client.get(`/complaints/${id}/history`).then((r) => r.data);

export const saveMemoApi = (id, memo) =>
  client.patch(`/complaints/${id}/memo`, { memo }).then((r) => r.data);

export const saveResponseApi = (id, response) =>
  client.post(`/complaints/${id}/response`, { response }).then((r) => r.data);

export const updateComplaintDeptApi = (id, departmentId) =>
  client.patch(`/complaints/${id}/department`, { department_id: departmentId }).then((r) => r.data);

export const uploadAttachmentApi = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post(`/complaints/${id}/attachments`, form).then((r) => r.data);
};

export const getAttachmentsApi = (id) =>
  client.get(`/complaints/${id}/attachments`).then((r) => r.data);
