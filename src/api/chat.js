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

export const chatVoiceApi = (audioFile, sessionId = null) => {
  const form = new FormData();
  form.append('audio', audioFile);
  if (sessionId) form.append('session_id', String(sessionId));
  return client.post('/chat/voice', form).then((r) => r.data);
};

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
