import axios from 'axios';

// 배포/직접호출용 API 주소. VITE_API_URL 또는 VITE_API_BASE_URL 중 설정된 값 사용.
// 둘 다 없으면 상대경로 → dev 서버(vite proxy)가 백엔드로 전달.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '',
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url ?? '';
    const isAuthExcluded = url.includes('/users/login') || url.includes('/users/me');

    if (status === 401 && sessionStorage.getItem('token') && !isAuthExcluded) {
      sessionStorage.removeItem('token');
      window.location.href = '/error/401';
    } else if (status === 403) {
      window.location.href = '/error/403';
    } else if (status === 500) {
      // 챗봇·폼·첨부파일 API는 개별 오류 처리에 맡김 (전역 리다이렉트 제외)
      const is500Excluded = url.includes('/chat') || url.includes('/forms') || url.includes('/attachments');
      if (!is500Excluded) window.location.href = '/error/500';
    }

    return Promise.reject(err);
  }
);

export default client;
