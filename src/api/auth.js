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

// 비밀번호 재설정 (본인확인: 가입 이메일 + 전화번호 → 새 비밀번호 설정)
// ⚠️ 백엔드에 POST /users/reset-password 엔드포인트 추가 필요
//    request: { email, phone: "010-1234-5678", new_password }
//    성공 시 비밀번호 변경, 이메일·전화 불일치 시 400/404
export const resetPasswordApi = ({ email, phone, newPassword }) =>
  client.post('/users/reset-password', { email, phone, new_password: newPassword }).then((r) => r.data);

// 아이디(이메일) 찾기 (본인확인: 이름 + 전화번호 → 가입 이메일 반환)
// ⚠️ 백엔드에 POST /users/find-email 엔드포인트 추가 필요
//    request: { name, phone: "010-1234-5678" }
//    응답: { email: "user@example.com" }, 불일치 시 404
export const findEmailApi = ({ name, phone }) =>
  client.post('/users/find-email', { name, phone }).then((r) => r.data);

export const updateMeApi = (data) =>
  client.patch('/users/me', data).then((r) => r.data);

export const deleteMeApi = () =>
  client.delete('/users/me').then((r) => r.data);

export const updateNotificationsApi = (enabled) =>
  client.patch('/users/me/notifications', { notification_enabled: enabled }).then((r) => r.data);
