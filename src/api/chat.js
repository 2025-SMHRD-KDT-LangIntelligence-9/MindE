import client from './client';

export const chatAskApi = (text, sessionId = null) =>
  client.post('/chat/ask', { text, ...(sessionId ? { session_id: sessionId } : {}) }).then((r) => r.data);

export const chatImageApi = (file, text = '', sessionId = null) => {
  const form = new FormData();
  form.append('file', file);
  if (text) form.append('text', text);
  if (sessionId) form.append('session_id', String(sessionId));
  return client.post('/chat/image', form).then((r) => r.data);
};

// 문서·일반 파일 첨부 (AI 분석 없이 세션에 attachment로 저장)
export const chatFileApi = (file, text = '', sessionId = null) => {
  const form = new FormData();
  form.append('file', file);
  if (text) form.append('text', text);
  if (sessionId) form.append('session_id', String(sessionId));
  return client.post('/chat/file', form).then((r) => r.data);
};

export const chatVoiceApi = (audioFile, sessionId = null) => {
  const form = new FormData();
  form.append('audio', audioFile);
  if (sessionId) form.append('session_id', String(sessionId));
  return client.post('/chat/voice', form).then((r) => r.data);
};

// 답변 텍스트 → 마음결 목소리 mp3 (blob) → 재생용 objectURL 반환
export const chatVoiceReplyApi = (text) =>
  client
    .post('/chat/voice-reply', { text }, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data));

// 세션 첨부파일(GET /chat/files/{filename}, JWT 인증 필요)을 blob으로 받아 objectURL 반환
export const getChatFileBlobUrlApi = (filename) =>
  client
    .get(`/chat/files/${filename}`, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data));

export const saveChatSessionApi = (session) =>
  client.post('/chat/sessions', {
    title: session.title,
    status: session.status,
    messages: session.conversation ?? [],
  }).then((r) => r.data);

export const getChatSessionsApi = () =>
  client.get('/chat/sessions').then((r) => r.data);

export const getChatSessionApi = (sessionId) =>
  client.get(`/chat/sessions/${sessionId}`).then((r) => r.data);

export const updateChatSessionApi = (sessionId, data) =>
  client.patch(`/chat/sessions/${sessionId}`, data).then((r) => r.data);

export const deleteChatSessionApi = (sessionId) =>
  client.delete(`/chat/sessions/${sessionId}`).then((r) => r.data);

// 세션 → 민원 접수 초안 자동 생성 (title/content/attachments 반환)
export const createComplaintDraftApi = (sessionId) =>
  client.post(`/chat/sessions/${sessionId}/draft-complaint`).then((r) => r.data);
