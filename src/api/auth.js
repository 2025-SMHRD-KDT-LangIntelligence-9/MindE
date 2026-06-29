import client from './client';

export const loginApi = (email, password) =>
  client.post('/users/login', { email, password }).then((r) => r.data);

export const registerApi = (data) =>
  client.post('/users', data).then((r) => r.data);

export const getMeApi = () =>
  client.get('/users/me').then((r) => r.data);
