import axios from 'axios';

// 배포/직접호출용 API 주소. VITE_API_URL 또는 VITE_API_BASE_URL 중 설정된 값 사용.
// 둘 다 없으면 상대경로 → dev 서버(vite proxy)가 백엔드로 전달.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url ?? '';
    const isAuthExcluded = url.includes('/users/login') || url.includes('/users/me');
    if (err.response?.status === 401 && localStorage.getItem('token') && !isAuthExcluded) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
