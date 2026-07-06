import client from './client';

// 좌측 서식 목록 (필드 매핑 제외 — 가벼운 응답)
export const getFormTemplatesApi = () =>
  client.get('/forms/templates').then((r) => r.data);

// 서식 상세 (field_mappings 포함)
export const getFormTemplateApi = (id) =>
  client.get(`/forms/templates/${id}`).then((r) => r.data);

// 원본 PDF (blob)
export const getFormPdfBlobApi = (id) =>
  client.get(`/forms/templates/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data);

// 서버 측 PDF 렌더링 후 Blob 반환 (한글 폰트·정렬 정확)
export const renderFormPdfApi = (templateId, fields) =>
  client
    .post(`/forms/templates/${templateId}/render`, { fields }, { responseType: 'blob' })
    .then((r) => r.data);

// AI 필드 값 채우기. 응답: { template_id, fields: { key: value, ... } }
// 서버가 auto_fill_from(성명/연락처)은 로그인 사용자 값으로 강제 덮어씀.
export const fillFormApi = ({ templateId, userMessage, chatSessionId, currentFields }) =>
  client
    .post('/forms/fill', {
      template_id: templateId,
      ...(userMessage ? { user_message: userMessage } : {}),
      ...(chatSessionId != null ? { chat_session_id: chatSessionId } : {}),
      current_fields: currentFields ?? {},
    })
    .then((r) => r.data);
