# MindE (마음이) — Frontend

> AI 기반 공공 민원 서비스 **마음이**의 프론트엔드입니다.
> React + Vite 기반이며 백엔드 API(`http://minde.ai.kr:8000`)와 실시간 연동됩니다.

---

## 기술 스택

| 라이브러리 | 버전 | 용도 |
|------------|------|------|
| React | 19 | UI 컴포넌트 프레임워크 |
| Vite | 5 | 번들러 / 개발 서버 |
| Tailwind CSS | 4 | 유틸리티 기반 CSS 스타일링 |
| React Router DOM | 7 | 클라이언트 사이드 라우팅 |
| Axios | 1.6 | HTTP 클라이언트 (API 통신) |
| Recharts | 3 | 관리자 통계 차트 (파이·도넛·라인 차트) |
| pdfjs-dist | 4 | PDF 파일을 이미지로 렌더링 (서류 미리보기) |
| jsPDF | 4 | 서식 PDF 클라이언트 생성 (백엔드 렌더 실패 시 폴백 다운로드) |
| Material Symbols | (CDN) | 아이콘 폰트 (Google Fonts) |
| Public Sans / Noto Sans KR | (CDN) | 본문 폰트 (Google Fonts) |

---

## 시작하기

```bash
# 패키지 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

### 환경 변수

`.env.example`을 복사해서 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

```env
# 백엔드 API 서버 주소
VITE_API_URL=http://your-backend-url:8000
```

> 로컬 백엔드 사용 시: `VITE_API_URL=http://localhost:8000`  
> 프록시 없음 — Axios가 절대 URL로 직접 호출합니다.

---

## 프로젝트 구조

```
src/
├── api/
│   ├── client.js              # Axios 공통 인스턴스 (baseURL, 토큰·에러 인터셉터)
│   ├── auth.js                # 로그인 / 회원가입 / 내 정보 / 알림 설정 / 탈퇴
│   ├── complaints.js          # 민원 CRUD / 상태변경 / 메모 / 답변 / 첨부파일 / 원본대화
│   ├── notifications.js       # 알림 조회 / 개별 읽음 / 전체 읽음
│   ├── admin.js               # 담당자 승인 / 사용자 관리 / 부서·카테고리 CRUD
│   ├── stats.js               # 관리자 통계 (요약 / 카테고리·부서·상태·긴급도·일별·월별)
│   ├── chat.js                # 챗봇 (텍스트·음성·이미지·파일) / 세션 관리 / 민원 초안
│   ├── forms.js               # 서식 목록·상세 / AI 자동 작성 / PDF 다운로드
│   └── statusMap.js           # 백엔드 status 영문 ↔ 한국어 변환
├── assets/
│   ├── logo.png
│   ├── hero-bg.png            # 랜딩/시민 홈 히어로 배경 (한강뷰 스카이라인)
│   ├── landing-bg.png         # 랜딩 배경 대체 일러스트
│   └── city-bg.png            # 시민/담당자/관리자 레이아웃 배경
├── components/
│   ├── EmptyState.jsx          # 빈 상태 공통 컴포넌트
│   ├── ErrorBoundary.jsx       # React 에러 경계
│   ├── FilePreviewModal.jsx    # 첨부파일 미리보기 모달
│   ├── FormPdfOverlay.jsx      # PDF 위 입력 오버레이 (줌·패닝·서명)
│   ├── NotificationDropdown.jsx
│   ├── SignaturePad.jsx        # 서명 입력 패드
│   └── ZoomableImage.jsx       # 핀치/휠 줌 이미지 뷰어
├── layouts/
│   ├── CitizenLayout.jsx
│   ├── StaffLayout.jsx
│   └── AdminLayout.jsx
├── pages/
│   ├── ErrorPage.jsx           # 401 / 403 / 500 에러 페이지
│   ├── NotFound.jsx            # 404 페이지
│   ├── citizen/
│   │   ├── Landing.jsx         # 랜딩 페이지
│   │   ├── Login.jsx           # 로그인 (JWT 인증)
│   │   ├── Register.jsx        # 회원가입 (시민 / 담당자)
│   │   ├── Home.jsx            # 시민 대시보드
│   │   ├── Chatbot.jsx         # AI 민원 상담 챗봇 (STT / TTS / 이미지 / 파일)
│   │   ├── DocumentOCR.jsx     # AI 서류 작성 도우미 (서식 선택 → AI 자동 작성 → PDF)
│   │   ├── MyComplaints.jsx    # 내 민원 현황
│   │   ├── Notifications.jsx   # 알림 센터
│   │   ├── Faq.jsx             # 자주 묻는 질문
│   │   └── Settings.jsx        # 계정 설정 (프로필 / 비밀번호 / 탈퇴)
│   ├── staff/
│   │   ├── StaffComplaints.jsx  # 담당자 민원 처리 (첨부파일 업로드·다운로드, 원본대화 조회)
│   │   ├── StaffUrgent.jsx      # 긴급 민원 관리
│   │   └── StaffStats.jsx       # 부서별 통계
│   └── admin/
│       ├── AdminDashboard.jsx   # 관리자 대시보드
│       ├── AdminUsers.jsx       # 사용자 관리 / 승인
│       ├── AdminSettings.jsx    # 시스템 설정 (카테고리 / 부서 / 사용자)
│       ├── AdminMonitoring.jsx  # 실시간 민원 모니터링
│       └── AdminStats.jsx       # 전체 통계 분석
├── store/
│   └── AppContext.jsx           # 전역 상태 관리 (Context API)
└── utils/
    ├── formMappings.js          # 서식 필드 매핑 유틸 (위치·크기·타입)
    ├── formPdf.js               # PDF → 이미지 변환 (서류 미리보기용)
    └── statusStyle.js           # 상태별 색상·뱃지 스타일 (단일 소스)
```

---

## 사용자 역할 및 라우팅

| 역할 | 진입 경로 | 주요 기능 |
|------|-----------|-----------|
| 시민 | `/home` | AI 챗봇 상담, 서류 작성, 민원 접수, 현황 조회, 알림 확인 |
| 담당자 | `/staff` | 부서별 민원 처리, 상태 변경, 공식 답변 등록, 첨부파일 관리 |
| 관리자 | `/admin` | 사용자 승인/거절, 부서·카테고리 관리, 전체 통계 |

---

## 주요 기능

### 시민
- **AI 챗봇 민원 상담** — 텍스트/이미지/파일 입력 → AI 분석 → 자동 카테고리·부서 분류
- **음성 입력 (STT)** — 브라우저 SpeechRecognition API (Chrome 권장)
- **음성 답변 (TTS)** — AI 답변 말풍선 하단 "음성으로 듣기" 버튼
- **AI 서류 작성 도우미** — 서식 선택 → AI 채팅으로 필드 자동 입력 → PDF 다운로드 또는 민원 접수로 전송
- **내 민원 현황** — 접수/처리 중/완료 상태 추적, 담당자 공식 답변 확인
- **홈 최근 알림** — 대시보드에서 최신 알림 미리보기 + 상태 전환(예: 처리 중 → 완료) 뱃지 표시
- **알림 센터** — 민원 상태 변경 시 알림 수신, 개별·전체 읽음 처리
- **계정 설정** — 프로필 수정 / 비밀번호 변경 / 회원 탈퇴

### 담당자
- **민원 목록** — 소관 부서 민원 자동 필터링 (deptGroup 기반)
- **긴급 민원 별도 관리** — 긴급도 기반 분리 뷰 (`/staff/urgent`)
- **상태 변경** — 접수 / 배정 / 처리 중 / 보완 요청 / 반려 / 완료
- **메모 저장** — 내부 처리 메모 (시민 미노출)
- **공식 답변 등록 및 수정** — 시민에게 공개되는 답변 등록
- **첨부파일 관리** — 민원인 첨부 조회 / 담당자 파일 업로드 / 미리보기
- **원본 챗봇 대화 조회** — 챗봇으로 접수된 민원의 원본 대화 내역 확인

### 관리자
- **대시보드** — 요일별/월별 부서 접수현황(드롭다운 선택), 카테고리별 도넛 차트, 긴급 민원 목록
- **통계 분석** — 상태별·카테고리별·부서별 분포, 긴급도 분포, 응답 지표
- **사용자 관리** — 전체 회원 조회, 담당자 가입 승인/거절, 부서 배정
- **시스템 설정** — 민원 카테고리 / 조직 및 부서 CRUD
- **모니터링** — 전체 민원 실시간 현황 조회 및 부서 변경

---

## 인증 방식

- 로그인 성공 시 JWT 토큰을 `localStorage`에 저장
- Axios 인터셉터가 모든 요청에 `Authorization: Bearer {token}` 헤더 자동 추가
- 앱 시작 시 토큰이 있으면 `/users/me` 호출로 세션 자동 복원
- 401 응답 시 자동 로그아웃 → `/error/401` 리다이렉트

---

## 상태 관리 (AppContext)

`src/store/AppContext.jsx`에서 전역 상태를 Context API로 관리합니다.

| 상태 | 설명 |
|------|------|
| `complaints` | 전체 민원 목록 (API에서 로드) |
| `notifications` | 알림 목록 (API에서 로드) |
| `users` | 사용자 목록 (관리자 전용) |
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
| 완료 | `closed` |
| 반려 | `rejected` |

---

## UI 정책 / 반응형

`xl`(1280px)을 기준으로 데스크탑과 모바일 레이아웃을 분기합니다.

- **데스크탑 (1280px 이상)** — 기존 고정 레이아웃 유지. 상단 가로 네비게이션 바.
- **모바일 / 태블릿 (1280px 미만)** — 앱 형태로 재배치:
  - 상단 헤더 축소 + 알림·로그아웃만 우측 정렬
  - 좌측 드로어 대신 **하단 아이콘 탭바**로 화면 이동
  - 카드·그리드는 세로 스택, 표는 가로 스크롤로 전환
  - 랜딩 / 로그인 / 회원가입은 스크롤 없이 **한 화면**에 맞춤
- Tailwind `xl:` 접두사로 분기합니다 — `xl:`가 붙은 클래스는 데스크탑 전용, 붙지 않은 클래스가 모바일 기본값입니다. (모바일만 조정할 때는 `xl:` 없는 값만 수정)
- 상태 색상은 `src/utils/statusStyle.js`를 단일 소스로 사용합니다 (차트·뱃지 동일 색상).
