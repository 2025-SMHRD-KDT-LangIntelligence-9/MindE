# 프론트 인계서 — 민원 서식 자동 작성 (v8)

**작성일**: 2026-07-03
**대상**: 프론트엔드 담당자
**백엔드 브랜치**: backend-ai
**관련 마이그레이션**: `scripts/migrate_v8.sql`

---

## 0. 개요

챗봇 상담 화면 또는 직접 진입한 서식 화면에서, 사용자 대화만으로 민원 서식(PDF)을
AI가 자동 채워주는 기능입니다.

- **좌표는 팀원(좌표 담당)이 미리 뽑아둔 매핑을 프론트가 렌더링에 사용**
- **LLM은 필드 값만 생성** — 좌표는 절대 건드리지 않음 (재현성/응답 시간 확보)
- **성명·연락처 등 자동 필드는 서버가 강제로 로그인 사용자 값으로 덮어씀** (LLM 창작 방지)
- **미리보기는 편집 가능** — 사용자가 손봐도 다음 갱신 요청에 반영됨

---

## 1. UI 흐름 (프론트에서 이미 만든 화면 기준)

```
┌ 좌측 ────────┬ 중앙 ─────────────────┬ 우측 ──────────────┐
│ 민원 서식     │ 마음이 · 서식 작성 도우미 │ 미리보기 (실시간)   │
│ 목록          │                       │                    │
│               │ (사용자 상황 설명)      │ (필드 값 실시간     │
│ - 일반 민원   │ AI가 채워드립니다      │  갱신, 직접 편집 O) │
│ - 도로·시설    │                       │                    │
│ - 소음        │ [ 대화창 입력 ]        │ [ 제출하기 ]        │
│ - 환경 위생   │                       │                    │
└──────────────┴───────────────────────┴────────────────────┘
```

**두 가지 진입 경로 지원**:
- **A. 챗봇 상담에서 전환**: `chat_session_id` 유지 → 이전 대화 컨텍스트를 서버가 활용
- **B. 직접 진입**: `chat_session_id` 없이 이 화면에서 처음부터 대화

---

## 2. 엔드포인트 (총 4개, 모두 JWT 인증 필요)

| # | Method | Path | 용도 |
|---|---|---|---|
| 1 | GET | `/forms/templates` | 좌측 서식 목록 |
| 2 | GET | `/forms/templates/{id}` | 서식 상세 (좌표 매핑 포함) |
| 3 | GET | `/forms/templates/{id}/pdf` | 원본 PDF 파일 |
| 4 | POST | `/forms/fill` | AI 필드 값 채우기 |

---

### 2-1. `GET /forms/templates`

**용도**: 좌측 목록 렌더링 (필드 매핑 제외 — 가벼운 응답)

**응답 예시**:
```json
[
  { "form_template_id": 1, "name": "일반 민원 신청서", "description": "일반적인 민원 신청·건의" },
  { "form_template_id": 2, "name": "도로·시설 보수 요청서", "description": "도로·시설물 파손 보수 요청" },
  { "form_template_id": 3, "name": "소음 민원 신고서", "description": "생활·공사 소음 신고" },
  { "form_template_id": 4, "name": "환경 위생 신고서", "description": "쓰레기 무단투기·악취 등 신고" }
]
```

---

### 2-2. `GET /forms/templates/{id}`

**용도**: 사용자가 좌측에서 서식 선택 시 상세 정보 로드 (좌표 매핑 포함)

**응답 예시**:
```json
{
  "form_template_id": 1,
  "name": "일반 민원 신청서",
  "description": "일반적인 민원 신청·건의",
  "pdf_url": "general_complaint.pdf",
  "field_mappings": [
    { "key": "성명",       "label": "성명",   "x": 150, "y": 720, "auto_fill_from": "user.name" },
    { "key": "연락처",     "label": "연락처", "x": 150, "y": 700, "auto_fill_from": "user.phone" },
    { "key": "주소",       "label": "주소",   "x": 150, "y": 680 },
    { "key": "민원 제목",  "label": "제목",   "x": 150, "y": 640 },
    { "key": "민원 내용",  "label": "내용",   "x": 150, "y": 500,
      "width": 400, "height": 200, "multiline": true }
  ],
  "is_active": true
}
```

**필드 매핑 스펙**:
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `key` | string | ✅ | 필드 고유 키. `POST /forms/fill` 응답의 `fields` dict 키와 일치 |
| `label` | string | | 화면 라벨. 미리보기에서 필드명 표시할 때 사용 |
| `x`, `y` | number | ✅ | PDF 좌표 (팀원 매핑값) |
| `width`, `height` | number | | 필드 박스 크기 |
| `font_size` | number | | 글자 크기 힌트 |
| `multiline` | boolean | | 여러 줄 입력 필드 여부 (긴 서술) |
| `auto_fill_from` | string | | `"user.name"` / `"user.phone"` 등. 서버가 자동 채우는 필드 표시 |

---

### 2-3. `GET /forms/templates/{id}/pdf`

**용도**: 원본 PDF 파일 다운로드 (프론트가 오버레이 렌더 시 로드)

**응답**: `application/pdf` 바이너리

**사용법**: pdf-lib / jsPDF에 fetch → arrayBuffer → PDF 파싱 → 좌표에 텍스트 얹기

---

### 2-4. `POST /forms/fill` ⭐ 핵심

**용도**: 대화창에서 사용자가 입력을 보낼 때마다 호출. AI가 필드 값 반환.

**Request body**:
```json
{
  "template_id": 1,                          // 필수 - 어느 서식인지
  "user_message": "골목 가로등이 안 켜져요...",  // 선택 - 이번에 새로 입력한 텍스트
  "chat_session_id": 42,                     // 선택 - 챗봇 상담에서 넘어온 경우
  "current_fields": {                        // 선택 - 이전에 채워졌거나 사용자가 편집한 값
    "성명": "홍길동",
    "연락처": "010-1234-5678",
    "주소": "",
    "민원 제목": "",
    "민원 내용": ""
  }
}
```

**Response**:
```json
{
  "template_id": 1,
  "fields": {
    "성명": "홍길동",
    "연락처": "010-1234-5678",
    "주소": "목포시 상동로 45",
    "민원 제목": "골목 가로등 미점등 신고",
    "민원 내용": "저희 동네 골목 가로등이 3일째 안 켜져 있습니다..."
  }
}
```

**규칙**:
- 응답의 `fields`는 항상 **전체 필드 dict**를 반환 (이전 값 포함 여부 무관하게 그대로 덮어쓰기하면 됨)
- 서버가 `auto_fill_from` 필드는 **로그인 사용자 정보로 강제 덮어씀** (프론트는 신경 안 써도 됨)
- LLM은 모르는 값은 `""`로 반환
- 잘못된 `chat_session_id` (남의 세션) → `400`

---

## 3. 대화 흐름 (프론트 관점 의사코드)

```typescript
// 상태
const [templateId, setTemplateId] = useState<number|null>(null);
const [template, setTemplate] = useState<FormTemplate|null>(null);   // GET /forms/templates/{id} 결과
const [pdfBlob, setPdfBlob] = useState<Blob|null>(null);
const [fields, setFields] = useState<Record<string,string>>({});
const [chatSessionId, setChatSessionId] = useState<number|null>(null); // 진입 시나리오 A일 때만 세팅

// 1. 좌측 목록 로드
const templates = await api.get('/forms/templates');

// 2. 서식 선택 시
async function selectTemplate(id: number) {
  setTemplateId(id);
  const tpl = await api.get(`/forms/templates/${id}`);
  setTemplate(tpl);
  const pdf = await api.get(`/forms/templates/${id}/pdf`, { responseType: 'blob' });
  setPdfBlob(pdf);
  // 최초 필드는 auto_fill_from 만 채운 상태
  const init: Record<string,string> = {};
  tpl.field_mappings.forEach((f: any) => { init[f.key] = ''; });
  setFields(init);
}

// 3. 사용자 대화 전송
async function onSendMessage(text: string) {
  const res = await api.post('/forms/fill', {
    template_id: templateId,
    user_message: text,
    chat_session_id: chatSessionId,   // 없으면 null
    current_fields: fields,           // 사용자 편집분도 여기에 포함됨
  });
  setFields(res.fields);              // 전체 필드 덮어쓰기
}

// 4. 사용자가 미리보기에서 직접 편집 시
function onEditField(key: string, value: string) {
  setFields(prev => ({ ...prev, [key]: value }));
  // 다음 fill 요청 시 자동으로 current_fields에 반영됨
}

// 5. PDF 다운로드
async function downloadPdf() {
  // pdf-lib 예시
  const doc = await PDFDocument.load(await pdfBlob!.arrayBuffer());
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);  // 한글 폰트는 별도 embed 필요
  for (const f of template!.field_mappings) {
    const val = fields[f.key] || '';
    if (!val) continue;
    page.drawText(val, {
      x: f.x, y: f.y,
      size: f.font_size ?? 12,
      font,
      // multiline이면 자동 wrap 처리 필요
    });
  }
  const bytes = await doc.save();
  saveAs(new Blob([bytes], { type: 'application/pdf' }), `${template!.name}.pdf`);
}

// 6. 제출 (기존 민원 접수 흐름 재사용)
async function submitAsComplaint() {
  await api.post('/complaints', {
    title: fields['민원 제목'] || fields['제목'] || '민원',
    content: fields['민원 내용'] || fields['내용'] || '',
    chat_session_id: chatSessionId,   // v6 세션 연결 (담당자 원본 대화 열람용)
  });
}
```

---

## 4. 진입 경로별 초기 세팅

### A. 챗봇 상담에서 전환
```typescript
// 챗봇 화면에서 "이 민원 서식이 필요합니다" 판단 후 전환
navigate(`/forms?template=1&session=${sessionId}`);
// 서식 화면 진입 시
setChatSessionId(sessionIdFromQuery);
selectTemplate(templateIdFromQuery);
// 이후 첫 /forms/fill 요청은 user_message 없이 chat_session_id + current_fields 만으로도 됨
// (서버가 세션 대화만 보고 필드 채움)
```

### B. 직접 진입
```typescript
navigate(`/forms`);
// chatSessionId = null 유지
// 사용자가 좌측에서 서식 선택 → 대화창에 처음 입력
```

---

## 5. 에러 처리

| 상태 코드 | 상황 | 프론트 대응 |
|---|---|---|
| 401 | JWT 만료/없음 | 로그인으로 유도 |
| 404 (`/forms/templates/{id}`) | 서식 없음 or 비활성 | 좌측 목록 refresh, 사용자 안내 |
| 404 (`.../pdf`) | PDF 파일 누락 | 팀원에 문의 (파일 미배치) |
| 400 (`/forms/fill`) | `chat_session_id`가 남의 세션 or 존재 X | 세션 무효화, chatSessionId=null로 되돌리고 재시도 안내 |

---

## 6. 자주 있을 만한 Q&A

**Q. LLM이 이상한 값을 뱉으면?**
- 사용자가 미리보기에서 직접 수정하면 됨. 그 값은 다음 `current_fields`로 서버에 전달되어 LLM이 존중함.
- 특정 필드만 다시 채우고 싶으면 "제목을 좀 더 정중하게" 같은 자연어 지시 → 서버가 나머지는 유지하고 지시된 필드만 재작성.

**Q. 성명·연락처가 사용자 프로필과 다르게 나오면?**
- 서버가 반드시 로그인 사용자의 name/phone으로 강제 덮어씀. 만약 다르면 백엔드 이슈이니 알려주세요.

**Q. PDF 폰트가 한글 깨지면?**
- pdf-lib 기본 폰트는 라틴 문자만 지원. `fontkit` + 한글 TTF (예: Noto Sans KR) 별도 embed 필요.

**Q. current_fields를 매번 실어야 하나?**
- 첫 요청엔 없어도 됨. 두 번째부터는 실어야 이전 값이 지워지지 않음.

**Q. 미리보기가 실시간이라던데 스트리밍이야?**
- 아니요, 요청-응답 방식. 다만 응답이 오면 전체 fields를 한 번에 덮어쓰기. 진행 중 스피너는 프론트에서 처리.

---

## 7. 관련 문서

- 챗봇 세션 ↔ 민원 접수 연결 (v6): STATUS.md 참조
- 부서 phone / 카테고리 대표부서 (v7): STATUS.md 참조
- 백엔드 실행: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- Swagger: http://localhost:8000/docs
