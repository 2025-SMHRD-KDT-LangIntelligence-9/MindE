import client from './client';

export const chatAskApi = (text) =>
  client.post('/chat/ask', { text }).then((r) => r.data);

export const chatImageApi = (file, text = '') => {
  const form = new FormData();
  form.append('file', file);
  if (text) form.append('text', text);
  return client.post('/chat/image', form).then((r) => r.data);
};

export const chatResetApi = () =>
  client.delete('/chat/reset').then((r) => r.data);
