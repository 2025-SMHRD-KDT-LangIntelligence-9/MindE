// api/axiosInstance.js
// 백엔드 API와 통신하기 위한 axios 공통 설정 파일입니다.
// TODO: baseURL 환경변수 처리, 인터셉터(토큰 첨부, 에러 처리) 구현

import axios from "axios";

// TODO: .env에서 VITE_API_BASE_URL 등으로 관리
const axiosInstance = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 5000,
});

export default axiosInstance;
