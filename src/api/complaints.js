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

// 파일명 확장자로 미리보기 아이콘용 타입 추정 (백엔드 file_type은 image/document만 줌)
const guessFileType = (name = '', backendType = '') => {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'hwp', 'txt'].includes(ext)) return 'doc';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  return backendType === 'image' ? 'image' : 'file';
};

// 민원 상세 화면의 '민원인 첨부파일' 목록용 (백엔드 응답 → 화면 모양으로 변환)
export const getCitizenAttachmentsApi = (id) =>
  client.get(`/complaints/${id}/attachments`).then((r) =>
    r.data.map((a) => ({
      attachmentId: a.attachment_id,
      name: a.original_filename ?? a.file_url?.split(/[\\/]/).pop() ?? '첨부파일',
      type: guessFileType(a.original_filename, a.file_type),
      size: null, // 백엔드가 파일 크기를 주지 않음
    }))
  );

// 첨부파일을 인증 토큰과 함께 blob으로 받아 미리보기용 objectURL 반환
export const getAttachmentBlobUrlApi = (attachmentId) =>
  client
    .get(`/attachments/${attachmentId}/download`, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data));
