import client from './client';

export const loginApi = async (email, password) => {
  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', password);
  const { data } = await client.post('/users/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
};

export const registerApi = (data) =>
  client.post('/users', data).then((r) => r.data);

export const getMeApi = () =>
  client.get('/users/me').then((r) => r.data);

export const updateMeApi = (data) =>
  client.patch('/users/me', data).then((r) => r.data);

export const deleteMeApi = () =>
  client.delete('/users/me').then((r) => r.data);
