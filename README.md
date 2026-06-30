# MindE (마음이) — Frontend

> AI 기반 공공 민원 서비스 **마음이**의 프론트엔드입니다.
> React + Vite 기반이며 백엔드 API와 실시간 연동됩니다.

---

## 기술 스택

| 항목 | 버전 |
|------|------|
| React | 19 |
| Vite | 5 |
| Tailwind CSS | 4 |
| React Router DOM | 7 |
| Axios | 1.6 |
| Material Symbols | (CDN) |

---

## 시작하기

```bash
# 패키지 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

> 백엔드 서버가 `http://localhost:8000` 에서 실행 중이어야 합니다.

---

## 프로젝트 구조

```
src/
├── api/
│   ├── client.js              # Axios 공통 인스턴스 (baseURL, 토큰 인터셉터)
│   ├── auth.js                # 로그인 / 회원가입 / 내 정보 / 탈퇴
│   ├── complaints.js          # 민원 CRUD / 상태변경 / 메모 / 답변 / 첨부파일
│   ├── notifications.js       # 알림 조회 / 읽음 처리
│   ├── admin.js               # 사용자 목록 / 승인 / 거절 / 부서 배정 / 부서 조회
│   ├── chat.js                # 챗봇 질문 / 이미지 분석 / 대화 초기화
│   └── statusMap.js           # 백엔드 status 영문 ↔ 한국어 변환
├── assets/
│   └── logo.png
├── components/
│   ├── EmptyState.jsx
│   ├── FilePreviewModal.jsx
│   └── NotificationDropdown.jsx
├── layouts/
│   ├── CitizenLayout.jsx
│   ├── StaffLayout.jsx
│   └── AdminLayout.jsx
├── pages/
│   ├── citizen/
│   │   ├── Landing.jsx        # 랜딩 페이지
│   │   ├── Login.jsx          # 로그인 (JWT 인증)
│   │   ├── Register.jsx       # 회원가입 (시민 / 담당자)
│   │   ├── Home.jsx           # 시민 홈
│   │   ├── Chatbot.jsx        # AI 민원 상담 챗봇 (STT / TTS / 이미지 / 파일)
│   │   ├── DocumentOCR.jsx    # 문서 업로드 → AI OCR → 민원 접수
│   │   ├── MyComplaints.jsx   # 내 민원 현황
│   │   ├── Notifications.jsx  # 알림 센터
│   │   ├── Faq.jsx            # 자주 묻는 질문
│   │   └── Settings.jsx       # 계정 설정 (프로필 / 비밀번호 / 탈퇴)
│   ├── staff/
│   │   ├── StaffComplaints.jsx  # 담당자 민원 처리
│   │   ├── StaffUrgent.jsx      # 긴급 민원 관리
│   │   └── StaffStats.jsx       # 부서별 통계
│   └── admin/
│       ├── AdminDashboard.jsx   # 관리자 대시보드
│       ├── AdminUsers.jsx       # 사용자 관리 / 승인
│       ├── AdminSettings.jsx    # 시스템 설정 (카테고리 / 부서 / 사용자)
│       ├── AdminMonitoring.jsx  # 실시간 민원 모니터링
│       └── AdminStats.jsx       # 전체 통계
├── store/
│   └── AppContext.jsx           # 전역 상태 관리 (Context API)
├── utils/
│   └── statusStyle.js           # 상태별 색상/뱃지 스타일
└── App.jsx                      # 라우팅 정의
```

---

## 사용자 역할 및 라우팅

| 역할 | 진입 경로 | 주요 기능 |
|------|-----------|-----------|
| 시민 | `/home` | AI 챗봇 상담, 민원 접수, 현황 조회, 알림 확인 |
| 담당자 | `/staff` | 부서별 민원 처리, 상태 변경, 공식 답변 등록 |
| 관리자 | `/admin` | 사용자 승인/거절, 부서 관리, 전체 통계 |

---

## 주요 기능

### 시민
- **AI 챗봇 민원 상담** — 텍스트/이미지 입력 → GPT-4o 분석 → 자동 카테고리/부서 분류
- **음성 입력 (STT)** — 브라우저 SpeechRecognition API (Chrome 권장)
- **음성 답변 (TTS)** — AI 답변 말풍선 하단 "음성으로 듣기" 버튼
- **OCR 민원 접수** — 문서 이미지 업로드 → GPT-4o Vision으로 필드 자동 입력 → 민원 접수
- **내 민원 현황** — 접수/처리 중/완료 상태 추적, 담당자 공식 답변 확인
- **알림 센터** — 민원 상태 변경 시 알림 수신, 읽음 처리 (로그아웃 후 재로그인 유지)
- **계정 설정** — 프로필 수정 / 비밀번호 변경 / 회원 탈퇴

### 담당자
- **민원 목록** — 소관 부서 민원 자동 필터링 (deptGroup 기반)
- **상태 변경** — 접수 / 배정 / 처리 중 / 보완 요청 / 반려 / 완료
- **메모 저장** — 내부 처리 메모 (시민 미노출)
- **공식 답변 등록** — 시민에게 공개되는 답변 등록
- **첨부파일 업로드** — 민원 관련 파일 첨부

### 관리자
- **대시보드** — 최근 7일 민원 접수 현황 그래프, 긴급 민원 목록
- **사용자 관리** — 전체 회원 조회, 담당자 가입 승인/거절, 부서 배정
- **시스템 설정** — 민원 카테고리 / 조직 및 부서 관리
- **모니터링** — 실시간 전체 민원 현황 조회 및 부서 변경

---

## 인증 방식

- 로그인 성공 시 JWT 토큰을 `localStorage`에 저장
- Axios 인터셉터가 모든 요청에 `Authorization: Bearer {token}` 헤더 자동 추가
- 앱 시작 시 토큰이 있으면 `/users/me` 호출로 세션 자동 복원

---

## 상태 관리 (AppContext)

`src/store/AppContext.jsx`에서 전역 상태를 Context API로 관리합니다.

| 상태 | 설명 |
|------|------|
| `complaints` | 전체 민원 목록 (API에서 로드) |
| `notifications` | 알림 목록 (API에서 로드) |
| `users` | 사용자 목록 (관리자 전용, API에서 로드) |
| `currentUser` | 현재 로그인 사용자 (role / name / dept / deptGroup) |
| `stats` | 파생 통계 (접수 / 처리중 / 완료 / 긴급 건수 등) |
| `myDeptComplaints` | 담당자 본인 부서 민원 (deptGroup 기반 필터) |

---

## 민원 상태 값

| 화면 표시 | 백엔드 값 |
|-----------|-----------|
| 접수 | `received` |
| 배정 | `assigned` |
| 처리 중 | `in_progress` |
| 보완 요청 | `needs_more_info` |
| 답변완료 | `answered` |
| 완료 | `closed` |
| 반려 | `rejected` |

