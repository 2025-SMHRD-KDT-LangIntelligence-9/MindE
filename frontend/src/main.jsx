// main.jsx
// React 앱을 DOM에 마운트하는 진입 파일입니다.
// TODO: 전역 스타일, Provider(store 등) 연결

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
