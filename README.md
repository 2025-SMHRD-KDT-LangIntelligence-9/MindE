# MindE (마음이) — Frontend

> AI 기반 공공 민원 서비스 **마음이**의 프론트엔드입니다.
> 현재 백엔드 연동 전 단계로, 임시 데이터(Context API)로 동작합니다.

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

---

## 프로젝트 구조

```
src/
├── api/
│   └── axiosInstance.js          # Axios 공통 인스턴스 (백엔드 연동 시 baseURL 설정)
├── assets/
│   └── logo.png                  # 마음이 로고
├── components/
│   ├── EmptyState.jsx            # 목록이 비어있을 때 공통 표시 컴포넌트
│   └── NotificationDropdown.jsx  # 헤더 알림 드롭다운
├── layouts/
│   ├── CitizenLayout.jsx         # 시민용 사이드바 + 헤더 레이아웃
│   ├── StaffLayout.jsx           # 담당자용 레이아웃
│   └── AdminLayout.jsx           # 관리자용 레이아웃
├── pages/
│   ├── citizen/
│   │   ├── Landing.jsx           # 랜딩 페이지 (h-screen 한 화면, 챗봇 UI 목업)
│   │   ├── Login.jsx             # 로그인 (이메일 자동완성 드롭다운 포함)
│   │   ├── Register.jsx          # 회원가입 (시민 / 담당자 탭 구분)
│   │   ├── Home.jsx              # 시민 홈 (최근 민원 + 빠른 접수)
│   │   ├── Chatbot.jsx           # AI 민원 상담 챗봇 (음성입력/TTS/파일첨부/상담내역)
│   │   ├── DocumentOCR.jsx       # 문서 이미지 업로드 → OCR 텍스트 추출 → 민원 접수
│   │   ├── MyComplaints.jsx      # 내 민원 현황 목록 + 상세 보기
│   │   ├── Notifications.jsx     # 알림 센터 (읽음/안읽음 탭, 날짜 그룹핑)
│   │   ├── Faq.jsx               # 자주 묻는 질문 (카테고리 필터 + 검색 + 아코디언)
│   │   └── Settings.jsx          # 계정 설정
│   ├── staff/
│   │   ├── StaffComplaints.jsx   # 담당자 민원 목록 (부서 필터, 상태 변경, 답변 등록)
│   │   ├── StaffUrgent.jsx       # 긴급 민원 별도 관리
│   │   └── StaffStats.jsx        # 부서별 민원 통계
│   └── admin/
│       ├── AdminDashboard.jsx    # 관리자 대시보드 (전체 현황 요약)
│       ├── AdminUsers.jsx        # 사용자 목록 (시민/담당자 전환)
│       ├── AdminSettings.jsx     # 시스템 설정 (카테고리 / 부서 / 사용자 승인)
│       ├── AdminMonitoring.jsx   # 실시간 모니터링
│       └── AdminStats.jsx        # 전체 통계 대시보드
├── store/
│   └── AppContext.jsx            # 전역 상태 관리 (민원, 알림, 사용자, 통계)
└── App.jsx                       # 라우팅 정의
```

---

## 사용자 역할 및 라우팅

| 역할 | 진입 경로 | 주요 기능 |
|------|-----------|-----------|
| 시민 | `/home` | AI 챗봇 상담, 민원 접수, 현황 조회, 알림 확인 |
| 담당자 | `/staff` | 부서별 민원 처리, 상태 변경, 공식 답변 등록 |
| 관리자 | `/admin` | 사용자 승인/거절, 부서 관리, 전체 통계 |

---

## 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 시민 | user@test.com | 1234 |
| 관리자 | admin@test.com | admin |
| 담당자 (도로교통과) | road@test.com | staff1 |
| 담당자 (환경위생과) | env@test.com | staff2 |
| 담당자 (도시시설과) | infra@test.com | staff3 |

> 로그인 화면 이메일 입력란의 드롭다운에서 계정을 빠르게 선택할 수 있습니다.

---

## 주요 기능 상세

### 시민
- **AI 챗봇 민원 상담** — 자연어 입력 시 키워드 기반 자동 분류 및 담당 부서 안내. 음성 입력(Web Speech API), TTS 읽기, 이미지/파일 첨부, 드래그 앤 드롭 지원
- **상담 내역** — 이전 상담 목록 조회, 제목/내용 검색, 상태 필터
- **OCR 민원 접수** — 문서 이미지 업로드 시 텍스트 자동 추출 후 민원 접수
- **내 민원 현황** — 접수 → 처리 중 → 완료 상태 추적, 담당자 공식 답변 확인
- **알림 센터** — 민원 상태 변경 시 자동 알림 생성, 읽음 처리, 날짜별 그룹핑
- **FAQ** — 카테고리 필터, 키워드 검색, 아코디언 형태

### 담당자
- **민원 목록** — deptGroup 기반 소관 부서 민원 자동 필터링
- **상태 변경** — 접수 / 처리 중 / 보완 요청 / 반려 / 완료
- **메모 저장** — 내부 처리 메모 (시민에게 미노출)
- **공식 답변 등록** — 등록 시 민원 상태 자동 완료 처리 + 시민 알림 생성

### 관리자
- **사용자 관리** — 시민/담당자 목록 조회, 담당자 가입 승인/거절, 부서 변경
- **민원 카테고리 설정** — 카테고리 목록 관리
- **조직/부서 관리** — 부서별 담당자 수, 처리 현황 조회

---

## 상태 관리 (AppContext)

`src/store/AppContext.jsx`에서 전역 상태를 Context API로 관리합니다.

| 상태 | 설명 |
|------|------|
| `complaints` | 전체 민원 목록 |
| `notifications` | 알림 목록 |
| `users` | 사용자 목록 (시민 + 담당자) |
| `currentUser` | 현재 로그인 사용자 (role, name, dept, deptGroup) |
| `stats` | 파생 통계 (접수/처리중/완료/긴급 건수 등) |
| `myDeptComplaints` | 담당자 본인 부서 민원 (deptGroup 기반 필터) |

---

## 백엔드 연동 예정

- 현재 로그인은 이메일만으로 역할을 판단하는 임시 구조입니다. 백엔드 연동 시 JWT 인증으로 교체됩니다.
- `src/api/axiosInstance.js`에 `baseURL` 및 인터셉터 설정 후 각 페이지에서 API 호출로 대체할 예정입니다.
