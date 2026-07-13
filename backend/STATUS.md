# 진행 상황 (Resume용)

마지막 업데이트: 2026-07-06 밤 (PyMuPDF 하이브리드 좌표 추출·자동 표 확장·다운로드 픽셀 렌더링·대화 스타일 자연화)

## ✅ 완료 상태

### AI 분류기 (HuggingFace 자동 다운로드)
- `atti433/minde-classifier` — KLUE BERT 11-class, **test F1 0.896** (v10-relabel)
  - main (기본 = v10-relabel) / tag `v10-relabel` / tag `v9-final` (롤백용)
- `atti433/minde-urgency` — KLUE BERT 이진, F1 0.93
- `chatbot_service`가 첫 호출 시 자동 다운로드. `HF_TOKEN` env 필수.

### v10-relabel 파이프라인
- 원본 AI Hub 143 train.jsonl 198k → gpt-4o-mini 재라벨링 (`train_v10.jsonl`)
- 카테고리 stratified 7:1.5:1.5 재분할 (train 139k / val 30k / test 30k)
- KLUE BERT 재학습 → macro F1 0.873 → **0.896** (+2.3%)
- HF 업로드 완료 (tag 부여)

### DB (PostgreSQL + pgvector) — 캠퍼스 공용
- **13 테이블**, 카테고리 11 / 부서 39 / 매핑 32 / urgency_keywords 29
- `rag_documents`: law 5,441 + dept 39 + case 37,909 + **procedure 46,157** = **89,546건**
- `complaint_clusters`: 정리 완료 (43건 → 1건, 실제 참조되는 것만 남김)
- `complaints`: 정리 완료 (6건 → 2건, 오염 데이터 삭제)
- **마이그레이션 v2/v3/v4/v5/v6 모두 적용 완료** (`scripts/migrate_v2.sql` ~ `migrate_v6.sql`)
  - v2: `users.department_id`, `complaints.memo/updated_at`, `notifications.is_read`
  - v3: `chat_sessions` 테이블 (session_id / user_id / title / status / messages JSONB / created_at)
  - v4: `chat_sessions.updated_at` + 인덱스 `(user_id, updated_at DESC)`
  - v5: `complaint_attachments.file_size`, `uploaded_by`
  - v6: `complaints.chat_session_id` (FK → chat_sessions, ON DELETE SET NULL) + 부분 인덱스
  - v7: `categories.department_id` (FK → departments, ON DELETE SET NULL) + 부분 인덱스
  - v8: `form_templates` 테이블 (서식 PDF + 좌표 매핑 JSONB) + is_active 부분 인덱스
  - v9: `form_templates.summary` (사전 요약 저장용 컬럼, 현재 미사용 — 시도했으나 회귀로 롤백)
  - v10: **회원/부서 삭제 cascade** — 회원 관련 FK CASCADE/SET NULL 정리, 부서 관련 SET NULL/CASCADE 정리 (아래 상세)

### chatbot_service 함수
| 함수 | 용도 |
|---|---|
| `answer_chatbot(text, history=None, create_cluster=False)` ⭐ | 게이트 + 분해 + 도구 병렬 + 답변 LLM. **클러스터 생성은 접수 시(complaints POST)만 True로 호출** |
| `decompose_query(text, history)` | 복합 민원 자동 분해 |
| `transcribe_audio(audio_bytes)` | 음성→텍스트 (CLOVA CSR) |
| `synthesize_speech(text, speaker, provider)` | 텍스트→음성 mp3 (ElevenLabs 마음결 voice 기본, 실패 시 edge-tts fallback) |
| `analyze_image(image_bytes, mime_type)` | 이미지→민원 분석 (gpt-4o Vision) |
| `classify_complaint / check_urgency / search_laws / search_cases / search_dept / lookup_dept_by_category / match_or_create_cluster / get_categories / extract_keywords` | 도구 |
| `preload_models()` | 서버 startup |

### answer_chatbot 흐름

```
0단계 게이트 LLM (gpt-4o)
  잡담이면 즉답 → 종료
  민원이면 [TOOL]
     ↓
Query Decomposition LLM (gpt-4o)
  텍스트 → sub_queries 리스트 (하나 or 여러 개)
     ↓
서브 질문별 병렬 (asyncio.gather)
  ├─ classify_complaint (top_k=3, 각 후보에 departments 동봉)
  ├─ check_urgency
  ├─ search_laws / search_cases / extract_keywords (병렬)
  ├─ match_or_create_cluster
  └─ lookup_dept_by_category / search_dept
     ↓
답변 LLM (gpt-4o)
  system + history + metadata (sub_queries 포함)
  → 각 서브별 부서·안내 통합 답변
```

### metadata 스키마

```json
{
  "tool_used": true,
  "sub_queries": [{"query": "...", "classification": {...}, "urgency": {...},
                   "departments": [...], "laws": [...], "cases": [...], ...}, ...],
  "classification": {...},   // 첫 서브 결과 (하위 호환)
  "urgency": {...},
  "cluster": {...},
  "keywords": [...],
  "laws": [...],
  "cases": [...],
  "departments": [...],
  "similar_depts": [...]
}
```

### 시스템 프롬프트 정책 (SYSTEM_PROMPT)
- **카테고리 선택**: LLM이 top_k 3개 중 의미 보고 결정. confidence는 참고만.
- **법령 인용 엄격**: context.laws에 있는 title만 인용. 창작 금지 예시 명시 ("전자정부법 제14조", "지방세법 제OO조" 등).
- **사례 활용 (신규)**: sim ≥ 0.5인 사례 있으면 답변 끝에 top-1 인용 (title 그대로). 활용률 검증 88%.
- **공공 채널**: 안전신문고/국민신문고/정부24/다산콜 자유 안내.
- **복수 민원 (sub_queries ≥ 2)**: 각 서브 개별 안내.
- **긴급 (is_urgent=true)**: 첫 줄 119/112.
- **클러스터 (count ≥ 10)**: "N건 접수" 안내.

## 검증 결과 (이번 세션)

| 테스트 | 결과 |
|---|---|
| 게이트 (잡담 4개, 민원 4개) | 8/8 정확 |
| v10 실측 (11 카테고리 대표) | 7/9 정확 (도로 시설물 케이스 개선) |
| Query Decomposition (복합 5개) | 5/5 두 부서 다 정확 안내 |
| 사례(cases) 활용률 | 0% → **88%** (프롬프트 강화 후) |
| 법령 할루시네이션 방지 | 5개 시나리오 창작 법령 0건 |

## 이번 세션 GitHub 커밋 (ai 브랜치)

```
0242f8e — 사례(cases) 활용 프롬프트 강화
d68c9b3 — v10-relabel + HF 자동 다운로드 + Query Decomposition + 법령 강화
2e54588 — 멀티모달 입력 통합 (STT/TTS/Vision)
2c653bc — answer_chatbot: 게이트 + 멀티턴 history + Top-3 LLM 선택 + gpt-4o
```

## 백엔드 v2/v3 통합 (2026-07-01)

백엔드 담당자로부터 `MindE-backend (1).zip` 수령 → AI 파일 2개(`chatbot_service.py`, `classifier.py`)만 제외하고 병합.

**병합된 변경 (백엔드 담당자 작업)**
- models.py: `department_id`(user), `memo`/`updated_at`(complaint), `is_read`(notification), **`ChatSession` 신규**
- schemas.py: UserUpdate, ChatSessionCreate/Out/DetailOut, ComplaintMemo/Response/DepartmentUpdate 등
- routers 대폭 확장 — 신규 엔드포인트 20개 (아래 참조)

**AI 측 세션 기반 챗봇 완성 (이번 세션)**
- `routers/chat.py` 전면 재작성 — in-memory `_SESSIONS` 제거, DB `chat_sessions` 일원화
- `POST /chat/ask` — `session_id` 옵션 (없으면 자동 생성). 매 턴 DB 자동 커밋
- `POST /chat/voice`, `/chat/image` — 동일 세션 기반
- `PATCH /chat/sessions/{id}` (title/status), `DELETE /chat/sessions/{id}` 신규
- **최근 활동순 정렬** (`updated_at` 컬럼 + migrate_v4)
- `schemas.ChatSessionUpdate` 추가
- **`/chat/reset` 제거** — 프론트 마이그레이션 필요 (아래 알려진 이슈 참조)

**신규 엔드포인트 20개 요약**
- `/users`: PATCH `/me`, DELETE `/me`, PATCH `/me/notifications`
- `/complaints`: PATCH `/{id}/memo`, POST `/{id}/response`, PATCH `/{id}/department`
- `/chat`: POST/GET `/sessions`, GET `/sessions/{id}`, PATCH `/sessions/{id}`, DELETE `/sessions/{id}`
- `/admin`: DELETE `/reject-staff/{id}`, GET `/users`, PATCH `/users/{id}/department`, DELETE `/users/{id}`, GET `/complaints`, GET/POST/PATCH/DELETE `/departments`, `/categories`

## 이번 세션 (2026-07-02) 추가 작업

### 정부24 행정민원 절차 RAG 추가 ⭐
- 크롤링해뒀던 `results (2).csv` (10,202행) 활용 — dedupe & 라벨 조립 → **9,438 유니크 민원 카탈로그**
- **필드 청킹** — 각 민원을 5~6개 청크로 분해 ([용도]/[신청방법]/[구비서류]/[처리기간]/[수수료]/[절차]/[부가정보]/[소관기관]) → **46,157 청크**
- KoSimCSE 임베딩 후 `rag_documents` 테이블에 `source_type='procedure'`로 INSERT
- **총 rag_documents: 43,389 → 89,546건**
- `chatbot_service.search_procedures(query, limit)` 신규 — 벡터 top-20 → **IDF 가중 title 부스트** → 리랭킹
- `_process_sub_query` 병렬 gather에 procedures 추가, metadata에 `procedures` 필드
- SYSTEM_PROMPT에 "행정 절차 안내 활용" 섹션 신규 (필요 서류/처리 기간/수수료/절차 답변 개선)
- 실측: 자동차 이전등록 등 완벽 매칭. 여권/등기부등본은 KoSimCSE 한계로 벡터 top-20 진입 실패 케이스 존재. 답변 자체는 담당부서+정부24 안내로 안전.
- **DB 스키마 변경 없음** — 마이그레이션 필요 없음

### TTS 무료화
- `synthesize_speech()`: CLOVA Voice Premium (월 9만원) → **Microsoft Edge Neural TTS (edge-tts, 무료)**
- 시그니처 유지 → `/chat/voice-reply` 엔드포인트 & 프론트 코드 무영향
- CLOVA speaker 이름 매핑 유지 (`nara`→SunHi 여성, `jinho`→InJoon 남성)
- 품질: CLOVA Premium 급, 인증 불필요, 인터넷 연결만 필요
- STT는 그대로 CLOVA CSR

### 부서 억지 매칭 방지 (SYSTEM_PROMPT 강화)
- **문제**: departments 테이블이 전남도청 산하 39개 부서만 있어서, 학교/중앙정부/경찰 소관 민원도 억지로 도청 부서에 매칭됨
  - 예: "학교 운동장 체육대회 소음" → 관광과 안내 (오답)
- **해결**: `chatbot_service.py`의 SYSTEM_PROMPT 두 섹션 강화
  - "담당 부서 판단" 섹션 신규 — 도청 소관 vs 아닌 것 이분 판단 규칙 + 성격별 실제 담당 매핑 표 (학교→교육청, 여권→정부24, 학교폭력→117, 노동→1350, 국세→126 등)
  - "자유롭게 안내해도 되는 것" 섹션에 상급 기관 채널 명시 (전라남도교육청 061-260-0114, 교육부 1577-1577, 국민건강보험 1577-1000, 금감원 1332 등)
- **결과**: LLM이 매핑된 부서가 부적절할 때 무시하고 실제 담당 기관/국민신문고/정부24로 유도. 도청 소관인 케이스(포트홀, 가로등, 이웃 소음 등)는 원래대로 부서 안내 유지
- **수정 파일**: `chatbot_service.py` 1개 (SYSTEM_PROMPT만)

### 변경/추가된 파일
- **수정**: `chatbot_service.py` (search_procedures + IDF 부스트 + synthesize_speech → edge-tts + SYSTEM_PROMPT 부서 판단 강화), `requirements.txt` (edge-tts 추가), `STATUS.md`
- **신규 파일**: 없음
- **DB**: rag_documents +46,157건, 스키마 변경 X

## 이번 세션 (2026-07-02 오후) 추가 작업

### ElevenLabs TTS 통합 + 마음결 확정 voice
- `synthesize_speech(text, speaker, provider)` — provider 파라미터 신규 (`"edge"` | `"eleven"`)
- 기본 provider = `"eleven"` — 프론트가 안 넘겨도 마음결 voice로 자동 응답
- ElevenLabs 실패 시 edge-tts 자동 fallback (데모 무음 방지)
- **마음결 voice ID**: `ksaI0TCD9BstzEzlxj4q` (Starter tier 이상 필요)
- 튜닝: stability 1.0, similarity 0.5, style 0.0, speed 1.1, `apply_text_normalization: on`
- env 오버라이드: `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE`, `ELEVENLABS_SPEED/STABILITY/SIMILARITY/STYLE`

### 관리자 통계 API 11개
- `GET /admin/stats/summary` — 요약 카드 (오늘/이번주/이번달, 상태별, 긴급)
- `GET /admin/stats/by-status` — 상태별 도넛/파이
- `GET /admin/stats/by-category` — 카테고리별 막대
- `GET /admin/stats/by-department` — 부서별 + 상태 breakdown
- `GET /admin/stats/timeline?days=7` — 일별 접수/답변 추이
- `GET /admin/stats/urgency` — 긴급도 4단계 분포
- `GET /admin/stats/urgent-top` — 긴급 민원 top-N (알림 배너용)
- `GET /admin/stats/hot-clusters` — 접수 폭증 클러스터
- `GET /admin/stats/response-metrics` — 답변률/평균 답변 시간
- `GET /admin/stats/user-metrics` — 사용자 지표
- `GET /admin/stats/attachment-rate` — 첨부율
- 모두 `Depends(get_current_staff)` — 담당자/관리자만

### 세션 메시지 확장 (2026-07-02 오후)
- 각 message에 `timestamp` 필드 자동 추가
- `attachments` 필드 (첨부 있을 때만)
- `/chat/image` — 이미지 원본 저장 (`uploads/chat/`), 응답에 attachment 반환
- **`POST /chat/file` 신규** — 문서/파일 첨부 (AI 분석 X)
- **`GET /chat/files/{filename}` 신규** — 첨부 다운로드 (세션 소유권 확인)
- 최대 파일 크기: 20MB
- 음성 파일은 저장 X (STT 텍스트만 유지)

### 클러스터 정책 개편
- `answer_chatbot(create_cluster=False)` 기본 — **챗봇 대화는 클러스터 안 만듦**
- `/complaints` POST에서만 명시적으로 `match_or_create_cluster(title, keywords)` 호출
- **title 기준으로만** 클러스터링 (본문 세부정보로 흩어지지 X)
- 이전에 챗봇 대화로 오염된 클러스터 43건 → 1건으로 정리

### 헬스체크 강화 + 외부 모니터
- `GET /health` — DB, 모델 로드, API 키 여부 종합 확인 → status: ok/degraded/down
- `scripts/health_monitor.py` — 30초 폴링, 3연속 실패 시 Windows 토스트 + 경고음 + Discord 웹훅

### CORS 수정
- `main.py`: `allow_credentials=False` (allow_origins=["*"] 와 호환)
- JWT는 Authorization 헤더로 문제 없음

### 인프라 (2026-07-02)
- **도메인 확보**: `minde.ai.kr` → 공인 IP `123.142.39.125`
- **공유기 포트 포워딩**:
  - 외부 80 → 팀원 노트북(프론트) `192.168.0.78:3000`
  - 외부 3000 → 팀원 노트북 `192.168.0.78:3000`
  - 외부 8000 → 본인 노트북(백엔드) `192.168.0.77:8000`
- 서버 실행: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- 외부 접속 가능: `http://minde.ai.kr:8000` (백엔드 Swagger), `http://minde.ai.kr` (프론트 UI)
- ISP 포트 80 허용 확인됨 — Cloudflare Tunnel 없이 순수 포트 포워딩으로 도메인 접속 가능
- HTTPS 아직 미적용 (`http://`만) — 필요 시 Cloudflare 프록시 30분 작업

### 변경/추가된 파일 (오늘 오후 세션)
- **수정**: `chatbot_service.py` (create_cluster 파라미터, ElevenLabs voice/파라미터), `routers/chat.py` (timestamp, attachment, /chat/file, /chat/files), `routers/complaints.py` (title 클러스터), `routers/admin.py` (통계 API 11개), `main.py` (`/health` 강화, CORS credentials=False), `STATUS.md`
- **신규 파일**: `scripts/health_monitor.py`
- **DB**: rag_documents 그대로, complaint_clusters 43→1, complaints 6→2, 스키마 변경 X

## 이번 세션 (2026-07-03) 추가 작업

### 프론트 요청사항 반영 (7건)
- **draft-complaint에 category/department/urgency_score** — 분류기 top-1 오분류 방지, LLM 재판정 결과 반환
- **UserOut에 department_name, created_at** — 담당자 부서 필터·관리자 가입일
- **AttachmentOut에 file_size** (bytes) + **uploaded_by** (업로더 user_id) — 시민/담당자 첨부 구분
- **GET /departments** (인증 X) — 회원가입 부서 드롭다운용
- **UserCreate에 department_id** — 담당자 신청 시 부서 함께 저장
- **GET /stats/public** (인증 X) — 랜딩용 총 접수/완료 수

### 마이그레이션 v5
`scripts/migrate_v5.sql` — `complaint_attachments`에 file_size + uploaded_by 컬럼 추가, 옛 데이터 backfill.

### 접수 민원 자동 RAG 인덱싱 ⭐
- `POST /complaints` 접수 시 `chatbot_service.index_complaint_for_rag(...)` 자동 호출
- 새 민원이 rag_documents에 `source_type='complaint'`로 임베딩·저장
- `search_cases` 확장 — `case`(국민신문고) + `complaint`(우리 platform) 통합 검색
- 응답에 `source_type` 필드 추가 — 프론트가 배지 표시 가능
- 실측: 접수 후 즉시 다른 유저의 유사 사례 검색에 노출 (top-1 sim 0.72)
- 옛 민원 5건도 backfill 완료

### SYSTEM_PROMPT 후속 턴 답변 간결화
- 카테고리 재소개는 첫 턴만
- 부서/전화번호 재안내 금지 (history 있으면)
- 답변 길이 질문 정보량에 맞춤
- 결과: "그러면 신고할 수 있어요?" → "네, 신고 가능합니다..." 자연스러운 흐름

### 새 라우터
- `routers/public.py` (신규) — 인증 없는 공개 엔드포인트 담기
  - `GET /departments`
  - `GET /stats/public`

### 새 엔드포인트
- `POST /chat/sessions/{id}/draft-complaint` — 세션 대화 → 민원 접수 초안 자동 생성 (title/content/category/department/attachments)

### 속도 측정 (PPT용)
- 잡담: 0.75s (게이트 종료)
- 단일 민원: 6~12s
- 다중 3건 병렬: 10.4s (순차 대비 42% 절약)

### DB 정리
- rag_documents 총 **89,551건** (case 37,909 + procedure 46,157 + law 5,441 + dept 39 + complaint 5)
- complaint_clusters: 1건만 유지 (오염 정리 완료)
- complaints: 5건 (테스트 접수 포함)

### 민원 ↔ 원본 챗봇 세션 연결 (v6) ⭐
- **문제**: 시민이 챗봇과 여러 턴 대화 후 접수해도, 담당자 화면에서 원본 대화 못 봄 → 컨텍스트 손실
- **해결**: `complaints.chat_session_id` 컬럼 추가로 접수 시점 세션 링크 저장
- **마이그레이션 v6** (`scripts/migrate_v6.sql`)
  - `ALTER TABLE complaints ADD COLUMN chat_session_id BIGINT REFERENCES chat_sessions(session_id) ON DELETE SET NULL`
  - 부분 인덱스 `idx_complaints_chat_session_id` (NULL 제외)
- **모델/스키마**
  - `models.Complaint.chat_session_id` 추가
  - `schemas.ComplaintCreate.chat_session_id: int | None = None` — 프론트가 접수 시 옵션 전달
  - `schemas.ComplaintOut.chat_session_id` — 응답 노출 (담당자 "원본 대화 보기" 버튼 판단용)
- **라우터**
  - `POST /complaints` — payload에 `chat_session_id` 있으면 **본인 소유 세션인지 검증** 후 저장 (남의 세션 붙이기 방지)
  - `GET /complaints/{id}/chat-transcript` 신규 — 민원 본인 or 담당자/관리자만 원본 세션 전체 (`ChatSessionDetailOut`) 조회. `chat_session_id`가 NULL이면 404
- **스모크 테스트**
  - FK 위반 정상 (존재하지 않는 세션 참조 거부)
  - ON DELETE SET NULL 정상 (세션 삭제 시 민원의 링크만 NULL)
  - 잔여 테스트 데이터 없음
- **프론트 인계 필요**
  - `POST /complaints` body에 `chat_session_id` (draft-complaint 응답 값) 실어주기
  - 담당자 민원 상세에 **"원본 대화 보기"** 버튼 추가 → `GET /complaints/{id}/chat-transcript`
  - `ComplaintOut.chat_session_id`가 null이면 버튼 비활성화 처리

### 관리자 화면 스키마 보강 (v7) ⭐
- **프론트 요청 A**: 부서 대표 전화번호 저장/노출 (기존 `departments.contact_phone` 있었으나 스키마 미노출)
- **프론트 요청 B**: 카테고리별 담당 부서 지정 (localStorage 임시 저장 → DB 영속화)

**변경**
- **DB**: `categories.department_id` 컬럼 신규 (v7 마이그레이션). departments는 컬럼 그대로.
- **models.Category**: `department_id` FK 추가.
- **schemas**
  - `DepartmentOut`: `phone` 필드 노출 (Pydantic alias `contact_phone` → `phone`, `populate_by_name=True`)
  - `DepartmentCreate/Update`: `phone: str | None = None`
  - `CategoryOut`: `department_id`, `department_name` 추가 (JOIN)
  - `CategoryCreate/Update`: `department_id: int | None = None`
- **routers/admin.py**
  - `POST/PATCH /admin/departments` — `phone` → `contact_phone` 저장
  - `POST/PATCH /admin/categories` — `department_id` 저장, 존재하지 않는 부서 400
  - `GET /admin/categories` — `_build_category_out()`로 department_name JOIN
- **routers/public.py**: `GET /departments` 응답에 phone 자동 포함 (DepartmentOut 그대로 씀)

**스모크**
- 부서 3건 alias 정상 노출 (`061-286-7450` 등)
- 카테고리 3건 새 컬럼 NULL 확인 (기존 데이터 무영향)

**프론트 인계**
- 부서 관리 화면: 대표번호 입력/표시 활성화
- 카테고리 관리 화면: localStorage 대신 `PATCH /admin/categories/{id}` 로 `department_id` 저장 → `GET /admin/categories` 응답의 `department_name`으로 표시

### 민원 서식 자동 작성 (v8) ⭐
- **접근**: LLM은 필드 **값만** 뱉고, 좌표는 팀원이 뽑은 매핑을 프론트가 렌더링에 사용 (관심사 분리)
- **템플릿**: DB `form_templates` (PDF 파일은 `uploads/forms/`), 좌표는 `field_mappings` JSONB
- **좌표는 LLM에 힌트로만** 전달 — 픽셀 정확도는 인간 튜닝, LLM은 필드 성격(짧은/긴 필드 등) 파악 용도
- **자동 필드 (성명·연락처)**: `field_mappings[].auto_fill_from = "user.name"|"user.phone"` 지정 → LLM이 뭘 뱉든 서버가 `current_user`로 강제 덮어씀 (창작 방지)

**엔드포인트**
- `GET /forms/templates` — 좌측 목록용 (name/description만, 필드 매핑 제외)
- `GET /forms/templates/{id}` — 단건 상세 (field_mappings 포함, 프론트 렌더용)
- `GET /forms/templates/{id}/pdf` — 원본 PDF 다운로드
- `POST /forms/fill` — AI 값 채우기. request body:
  ```json
  {
    "template_id": 1,
    "user_message": "...",             // 이번에 입력한 텍스트 (없어도 됨)
    "chat_session_id": 42,             // 챗봇 상담에서 넘어온 경우 (없어도 됨)
    "current_fields": { ... }          // 이전 값 or 사용자가 직접 수정한 값 (반복 갱신)
  }
  ```
  response:
  ```json
  { "template_id": 1, "fields": { "성명": "...", "민원 내용": "...", ... } }
  ```

**LLM 정책**
- gpt-4o-mini (필드 추출은 가벼움 → 속도·비용 최적)
- `response_format=json_object` 강제
- 규칙: 모르는 값 빈 문자열, current_fields 존중, 필드 성격에 맞춰 값 길이·톤 조정
- 세션 진입 시 최근 6턴 컨텍스트로 전달

**스모크 검증**
- 초기 채우기: 자동 필드 강제 덮어쓰기 + LLM이 대화에서 주소·제목·내용 정확히 추출
- 반복 갱신 ("제목을 정중하게"): 다른 필드 유지, 제목만 톤 조정 확인
- current_fields 존중 규칙 동작

**팀원 인계 (서식 PDF/좌표 데이터 준비)**
- PDF는 `uploads/forms/{파일명}.pdf` 로 배치
- `field_mappings`는 **팀 표준 메타데이터 형식** 그대로 지원:
  ```json
  [   /* 페이지별 배열 */
    [ { "name": "취득자 성명", "type": "text", "position": [52.33, 262.53], "font": "DEFAULT_LIGHT", "size": 9.0 }, ... ],
    [], [], []
  ]
  ```
  - 중복 name은 서버가 자동 dedupe (`_2`, `_3` 접미)
  - `type: "image"` (서명란 등) 필드는 LLM 출력에서 자동 제외
  - 예전 flat 형식 `{key, x, y, ...}` 도 하위 호환 지원
- INSERT 예시:
  ```sql
  INSERT INTO form_templates (name, description, pdf_url, field_mappings, is_active)
  VALUES ('취득세 신고서', '설명',
          'acquisition_tax_report.pdf',
          '{...팀 메타데이터 JSON 그대로...}'::jsonb, true);
  ```
- **테스트 서식 이미 INSERT 완료** (form_template_id=2): 취득세 신고서 (지방세법 시행규칙) — 페이지 4장, 필드 38개 (text 36 + image 2)

**프론트 인계**
- 좌측 목록: `GET /forms/templates`
- 서식 선택 시: `GET /forms/templates/{id}` + `GET /forms/templates/{id}/pdf`
- 대화창 전송 시: `POST /forms/fill` → 응답의 `fields`로 미리보기 갱신
- 사용자 직접 편집 시: 편집 값 그대로 다음 요청의 `current_fields`로 전달
- 다운로드: 원본 PDF + 좌표(`field_mappings`) + 값(`fields`) → jsPDF/pdf-lib으로 오버레이 후 저장
- 제출: 필드값 조합해 기존 `POST /complaints` 호출 (chat_session_id 있으면 v6 연결까지)

### 서식 자동 채움 정확도 개선 (v8 후속) ⭐
- **pdfplumber로 PDF 파싱** 후 필드 컨텍스트를 LLM에 자동 제공
- **표 격자 자동 감지** (`page.find_tables()`) — 세대주/세대원, 1세대 소유주택 등 표 안 필드가 어느 행/열인지 자동 파악. 세대주 셀에 세대원 값 흘러 들어가는 문제 해결.
- **근접 텍스트 스캔** — 필드 좌표 반경 25pt 내 단어 top-5를 힌트로 삽입. 라벨 없는 `□` 필드도 근처 텍스트로 의미 파악 (예: `□` at (89, 45) → 근처 `[개, 3.5%, 취득세율]` → 취득세율 옵션임을 이해)
- **배타 그룹 자동 감지** — y좌표 ±3pt 클러스터링 + `X □ 여`/`X □ 부` 접두어 패턴 감지. 프롬프트에 `[배타 그룹 - 각 그룹에서 하나만 V]` 리스트 명시.
- **배타 위반 후처리 강제** — LLM이 여러 개 V로 답하면 서버가 첫 V만 남기고 나머지 blank (safety net).
- **페이지 헤더 요약** — 각 페이지 상단 5줄만 짧게 프롬프트에 삽입 (전문은 오버로드라 제외).
- **가족 관계 판단 규칙 프롬프트** — 배우자/직계존비속/친족관계 정의 + 취득자↔전소유자 관계 명시.
- **여/부·해당/해당없음 짝 규칙** — 사용자가 "아니다"라 하면 '부'=V, "맞다"라 하면 '여'=V.
- **세대주 vs 세대원 판단 규칙** — 세대주 셀에 세대원 값 섞이는 것 방지, 배우자→자녀 순 세대원 슬롯 채움.

**개선 로드맵 (취득세 서식 4개 시나리오 실측)**:
| 단계 | 핵심 지표 정확도 |
|---|---|
| 초기 (필드명만) | ~40% |
| +근접 텍스트 | ~50% |
| +표 격자 컨텍스트 | ~65% |
| +배타 그룹 감지·후처리 + 여/부 규칙 | **~95%** (4/4 시나리오 관계·특관·조정·고급·거래·기한 다 정확) |

**응답 시간**: 필드 100개 서식 기준 평균 ~23초 (PDF 파싱은 1회 캐시).

**최종 실측 (4개 시나리오 종합)**:
- 아버지→저 무상: 직계존비속·아님·부·부·무상·내 (전부 정확)
- 사촌형→저 유상: 친족관계·아님·매매·내 (전부 정확)
- 대표이사→임원 무상: 관계 없음·경제(임원)·무상·후 (전부 정확)
- 배우자→저 무상 (조정대상·고급주택): 배우자·아님·여·여·무상·내 (전부 정확)

### 서식 fill 대화 흐름 개선 (2026-07-04 오후) ⭐

**문제** (프론트 스크린샷 진단)
- 사용자가 "같이 여권 신청서 작성 좀 해보자" 같은 잡담·의도만 표현했는데 봇이 "서식을 작성했습니다"로 응답하고 필드 임의 채움
- 프론트가 폼 placeholder로 넣은 "태스터"/"테스트" 문자열이 `current_fields`로 전달돼 LLM이 그 값을 다른 셀에 옮겨쓰는 오염
- 응답이 canned 문구 하나뿐이라 뭘 채웠는지, 뭐가 더 필요한지 안내가 없어 대화가 어색

**해결 (chatbot_service.fill_form_fields + POST /forms/fill 응답 스키마 변경)**
- **자연어 응답 반환**: 함수 시그니처 `-> tuple[dict, str]`로 변경. LLM이 필드값 + `message` 자연어를 함께 반환하는 JSON 스키마로 프롬프트 강화 (`{"fields": {...}, "message": "..."}`)
- **잡담 게이트**: 사용자 메시지가 잡담/의도/불만이면 fields는 current_fields 그대로 두고 message에 "어떤 정보 알려주실래요?" 되묻기. 정보 있으면 채우고 다음에 필요한 정보 안내.
- **플레이스홀더 필터** (`_sanitize_current_fields`): current_fields의 값이 `태스터/테스트/test/샘플/placeholder` 등이면 서버가 자동 제거 → LLM이 오염 값을 다른 셀에 복사하는 것 방지
- **API 응답 스키마 확장**: `FormFillResponse.message: str` 추가. 이전 응답 `{template_id, fields}` → `{template_id, fields, message}`.
- **하위 호환**: LLM이 이전 스키마(flat dict)로 답해도 그대로 파싱해 동작 (fallback).

**스모크 (여권 서식, 4개 시나리오)**
- 잡담 "같이 여권 발급 신청서 작성 좀 해보자" → message: "여권 발급 신청서를 작성해보겠습니다. 어떤 정보를 알려주실 수 있으세요?" (필드 유지)
- 정보 "홍길동이고 목포시 상동로 45, 010-1234-5678" → message: "성함과 연락처를 반영했어요. 주소지와 주민번호를 알려주실래요?" (5개 필드 채움)
- 항의 "왜 마음대로 작성해?" (current: 태스터/테스트) → 플레이스홀더 자동 제거 후 message: "어떤 정보 알려주실래요?"
- 플레이스홀더 필터 "홍길동입니다" (current: 태스터/테스트) → message: "성함을 반영했어요. 주소지와 주민등록번호를 알려주실래요?" (태스터 대신 홍길동)

**프론트 인계**
- canned 문구 "서식을 작성했습니다..." 폐기 → 응답의 `message` 필드를 대화창에 그대로 표시
- 미리보기 placeholder로 "태스터/테스트" 넣던 로직 있으면 제거 권장 (없어도 서버가 필터하니 안전)
- 서버 재시작 필요

### PyMuPDF 통합·다운로드 픽셀 렌더링·자동 좌표 확장 (2026-07-06) ⭐⭐⭐

**핵심 성과**
- 다운로드 서식 PDF **픽셀 정확 렌더링** (Malgun Gothic 실제 폰트 폭 측정 → 우측 정렬·자동 줄바꿈 완벽)
- **팀 좌표 앵커 + PyMuPDF 하이브리드 자동 좌표 확장** — 팀이 앵커 몇 개 클릭하면 표 전체 셀 자동 추출
- 취득세 세액 계산 표: 팀 앵커 5개 → 자동 셀 50개 확장
- 22개 서식 중 11개에서 자동 확장 성공 (표 있는 서식)

**PyMuPDF 도입 (`routers/forms.py`)**
- `requirements.txt` 추가: `PyMuPDF>=1.24`
- `_render_filled_pdf(pdf_path, field_mappings, values) -> bytes` — 서식에 값 픽셀 정확 렌더
  - Malgun Gothic (`C:\Windows\Fonts\malgun.ttf`) 임베드
  - `fitz.Font.text_length()`로 실제 폰트 폭 측정 → 우측/중앙 정렬 정확
  - 체크박스 자동 오프셋(+1mm, +0.5mm), 크기 통일 (11pt)
  - 긴 텍스트/자동 생성 셀은 셀 폭 감지 후 `insert_textbox()` 자동 wrap
- `POST /forms/templates/{id}/render` 신규 — filled PDF 스트림 응답
- `GET /forms/templates/{id}/debug-preview` 신규 — 팀 좌표(파란색) + 자동 생성(빨간색) 시각화 PDF

**하이브리드 자동 좌표 (`chatbot_service.py`)**
- `_expand_table_rows_from_anchors(field_mappings, pdf_path)` — 팀 앵커 위치를 PyMuPDF `find_tables()`로 스캔
  - 앵커 포함 표 → 그 행의 모든 셀 자동 확장
  - 이름 규칙: `{team_label}_{col_header}` (예: `취득세_과세표준액`)
  - 자간 공백 정규화 (한글 단문자 조각 붙임)
- `_generate_table_cell_fields()` 앞단에 결합 → pdfplumber 폴백과 상호 보완
- 결과: 취득세(+101), 재산세(+16), 위임장(+3) 등 자동 확장

**대화 흐름 자연화**
- LLM 프롬프트 재작성 (5가지 발화 유형별 응답 스타일):
  - 질문형 → 필드 목록 카테고리별 설명
  - 정보 제공형 → 반영 확인 + 다음 필요
  - 잡담·의도만 → 서식 목적 간단 안내
  - 불만·항의 → 사과 + 상황 재설명
  - 애매·확인 → 현재 진척 + 남은 안내
- 동일 문구 반복 금지 규칙
- `user_context` 사용 제약: 신청인 필드에만, 반려동물·전 소유자·세대원·대리인엔 사용 금지 명시

**체크박스 인식 확장**
- `_is_checkbox_field()`, `_is_checkbox_name()` — 정규식 `\[\s*\]`로 대괄호 안 공백 수 무관하게 인식
- 이전엔 `[]`, `[ ]`만 잡음 → 이제 `[  ]`, `[   ]` 등도 정상 감지
- 인감증명서(id=6) `[  ]휴대전화 문자전송(SMS)` 필드 오염 해결

**계정 이름 placeholder 방어**
- 로그인 사용자 계정명이 `태스터`/`테스트`/`test` 등 플레이스홀더면 auto-fill 스킵
- 발표·데모 시 테스트 계정으로도 신청인 필드에 "태스터" 안 채워짐

**표 라벨 필드 자동 정정 강화**
- 자동 생성 필드가 `{X}_{Y}` 패턴이면 X는 라벨
- 원본 팀 필드 `X`와 이름 겹치면(정확·접두어·포함 관계) LLM 프롬프트에서 제외 + 결과값 강제 빈값
- 취득세 세액 표: "취득세", "지방교육세" 등 라벨 필드에 금액이 잘못 들어가는 문제 완전 해결

**응답 스키마 확장**
- `POST /forms/fill` 응답에 `rendered_fields` 추가
  - 체크박스 오프셋 + align 자동 조정된 좌표 + 값 포함
  - 프론트는 좌측 정렬로만 렌더하면 픽셀 정확
- `_apply_render_adjustments()` — 폰트 폭 추정으로 우측/중앙 정렬 필드 좌표 자동 변환

**스코프 조정 — 취득세 서식 숨김**
- 표 구조 복잡성으로 부분 채움 안정도 낮음 (세대현황, 취득물건내역 표)
- `form_templates.is_active=false`로 목록에서 숨김 (id=2)
- 활성 서식 21 → 20개
- 필요시 `UPDATE form_templates SET is_active=true WHERE form_template_id=2` 한 줄로 복구

**LLM `max_tokens` 상향**
- 2000 → 4500. 필드 200개+ 서식에서 응답 잘림 방지 (`finish_reason=length` 이슈)
- 3턴 이상 대화에서 오류 안 남

**PPT/발표 준비 지원**
- 대본 다듬기 (트러블 슈팅 담백 톤·시스템 구성도·서비스 흐름도·화면 설계서)
- 아키텍처 다이어그램 오류 정정 안내 (KoBERT→KLUE BERT, LangChain 제거, Whisper→CLOVA/ElevenLabs, OCR→좌표 매핑)
- 팀명 확인: **"마음결"** (이전 "마음이"에서 변경)
- OCR 문구: 미래 계획으로 명확화

### 프론트 요청 5건 대응 (v10) — 2026-07-04 ⭐
- **A. 회원 탈퇴 500 에러**: FK 참조가 남아있어 `DELETE /admin/users/{id}` 실패
- **A-2. 부서 삭제 실패**: 담당자·민원·매핑 참조로 삭제 못 함
- **B. 알림 개별 읽음**: `PATCH /notifications/{id}/read` 없어서 프론트가 로컬 상태로만 처리 중
- **C. 카테고리 스키마**: v7에서 이미 구현했지만 프론트가 확인 못 함 (서버 재시작 이슈)
- **D. 원본 대화 조회**: v6에서 이미 구현했지만 프론트가 404 신고 (서버 재시작 이슈)
- (minor) 부서 phone alias 확인 요청 — 이미 정상 동작 (응답에서 `phone`으로 나옴)

**해결**
- `scripts/migrate_v10.sql` — FK 규칙 대대적 정리:
  - 회원 관련: `chat_sessions`/`complaints`/`notifications`의 user_id → **CASCADE** (개인 데이터 연쇄 삭제)
  - 회원 감사 성격: `complaint_attachments.uploaded_by`, `complaint_status_history.changed_by` → **SET NULL** (익명화)
  - 민원 연쇄: `complaint_attachments`, `complaint_responses`, `complaint_status_history`의 complaint_id → **CASCADE**
  - 민원↔알림: `notifications.complaint_id` → **SET NULL** (알림은 남기고 링크만 해제)
  - 부서 관련: `users.department_id`, `complaints.assigned_department_id` → **SET NULL**
  - 카테고리 매핑: `category_department_mapping.department_id` → **CASCADE** (매핑 row 자체 삭제)
- `routers/notifications.py` — `PATCH /notifications/{id}/read` 추가 (남의 알림 → 404)

**스모크 (v10 cascade 검증)**
- 테스트 유저 생성 → chat_session/complaint/notification/response 심음 → `DELETE FROM users` 한 방
- 결과: 관련 데이터 4개 모두 CASCADE 정상 삭제 (에러 없음)

**프론트 담당자에게 알려줄 것**
- 서버 재시작 후 확인 부탁 (특히 C, D는 어제 이미 구현되었지만 서버 재시작 안 돼서 프론트가 404 받은 상태)
- A/A-2는 DB 레벨 FK CASCADE라 라우터 코드 그대로 두고 그냥 삭제 API 호출하면 자동 처리
- B는 `PATCH /notifications/{id}/read` 신규 열림

### 커밋 히스토리 (backend-ai 오늘)
```
7565814  접수 민원 자동 RAG 인덱싱 (유사 사례 확장)
6c1b44a  GET /stats/public (프론트 요청 6번)
12b824f  담당자 회원가입 부서 지원 (프론트 요청 5번)
68af9be  AttachmentOut에 uploaded_by 추가 (프론트 요청 4번)
be55222  AttachmentOut에 file_size 추가 (프론트 요청 3번)
5c22840  draft-complaint에 category/department/urgency
3a76bcd  UserOut에 department_name, created_at
0c77c02  POST /chat/sessions/{id}/draft-complaint
e0df8b3  SYSTEM_PROMPT — 후속 턴 답변 간결화
```

## 백엔드 통합 (backend-ai 폴더)

- `C:\Users\smhrd\Desktop\backend-ai\` — self-contained (HF 자동 다운로드 반영)
- `.env`에 `HF_TOKEN`, `OPENAI_API_KEY`, `NAVER_CLOVA_*`, `DB_*`, `PG_*`, `JWT_SECRET_KEY` 포함
- `backend-ai.zip` (`C:\Users\smhrd\Downloads\backend-ai.zip`, 784MB) — 윤지은 씨 전달용
  - HF 자동 다운로드 세팅 후 크기 감소 여지 있음 (models/ 폴더 삭제 시 ~20MB)

## 발표 일정 및 남은 항목

- 발표: **2026-07-09** (7/2 기준 D-7)

### 발표 전 남은 작업
| 우선순위 | 항목 | 시간 | 담당 |
|---|---|---|---|
| 🔴 | 프론트 담당자에게 오늘(7/3) 7건 변경사항 통합 인계 | 15분 | 사용자 |
| 🔴 | 프론트 SPA 새로고침 404 이슈 전달 — 프록시를 `/api/*` 만 잡도록 (진단 완료) | 5분 | 사용자 |
| 🔴 | 발표 데모 시나리오 확정 + 리허설 | 1시간 | 사용자 |
| 🔴 | 답변 LLM 모델 비교 (gpt-4o-mini vs gpt-4o 등) — PPT | 1시간 | AI |
| 🔴 | 멀티모달(Vision) 학습 모델 필요 여부 검토 문구 정리 — PPT | 30분 | AI |
| 🟡 | 컨피던스 개선 지표 (v9 F1 0.873 → v10 0.896) 그래프/표 정리 — PPT | 20분 | AI |
| 🟡 | 발표용 샘플 민원 5~10건 접수 (관리자 대시보드 채우기) | 20분 | 사용자 |
| 🟡 | 11 카테고리 골고루 실측 (예상 못한 케이스 대비) | 30분 | AI |
| 🟡 | HTTPS 붙이기 (Cloudflare Tunnel) — 발표 완성도 | 30분 | 사용자 |
| 🟡 | HF 토큰 회전 (이전 노출) | 5분 | 사용자 |
| ✅ | ~~채팅 → 민원 접수 연결 (`chat_session_id` 컬럼) — 담당자가 원본 대화 열람~~ **완료 (v6)** | — | AI |
| 🟡 | 자주 쓰는 문서 양식 자동 작성 — 백엔드 완료 (v8), **팀원 서식 PDF/좌표 데이터 대기** | 팀원 | 팀원 |
| 🟢 | 카톡/SMS 알림 통합 | 반나절 | 백엔드 |
| 🟢 | 세션 삭제 시 첨부 파일도 함께 삭제 | 10분 | AI |

## 환경/접속

- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- AI 인계 폴더: `C:\Users\smhrd\Desktop\실전 프로젝트\` (backend-ai 브랜치 push 대상)
- 백엔드 통합 폴더: `C:\Users\smhrd\Desktop\backend-ai\` (윤지은 씨 인계 대상 — 옛 zip)
- 재라벨링 워크스페이스: `C:\Users\smhrd\Desktop\데이터\relabel-workspace\`
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3`
- HF 저장소: `atti433/minde-classifier`, `atti433/minde-urgency` (HF_TOKEN 필요)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE (**backend-ai 브랜치** 최신)
- **도메인**: http://minde.ai.kr (프론트 UI), http://minde.ai.kr:8000 (백엔드 API)
- 공인 IP: 123.142.39.125

## 다음 세션 빠른 체크

```bash
# 1. Python
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" --version

# 2. Git 상태
cd /tmp/MindE && git log --oneline origin/ai -5

# 3. DB (클러스터가 초기화된 상태인지, RAG 데이터 그대로인지)
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import psycopg2
conn = psycopg2.connect(host='project-db-campus.smhrd.com', port=3310,
  user='mp_24k_li9_p3_3', password='<PG_PASSWORD>', dbname='mp_24k_li9_p3_3')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM complaint_clusters')
print('clusters:', cur.fetchone()[0])
cur.execute('SELECT source_type, COUNT(*) FROM rag_documents GROUP BY source_type')
print('rag:', cur.fetchall())
"

# 4. 챗봇 스모크 (v10 자동 다운로드 검증)
cd "C:/Users/smhrd/Desktop/실전 프로젝트" && "C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import chatbot_service as svc
print(svc.classify_complaint('도로에 구멍이 났어요', top_k=3))
"

# 5. 백엔드 라우터 import 스모크 (병합 정합성 확인)
cd "C:/Users/smhrd/Desktop/실전 프로젝트" && "C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import models, schemas
from routers import users, complaints, chat, admin, attachments, notifications
print('all routers OK')
"

# 6. chat_sessions 스키마 확인 (updated_at 있는지)
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import psycopg2
conn = psycopg2.connect(host='project-db-campus.smhrd.com', port=3310,
  user='mp_24k_li9_p3_3', password='<PG_PASSWORD>', dbname='mp_24k_li9_p3_3')
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name='chat_sessions' ORDER BY ordinal_position\")
print([r[0] for r in cur.fetchall()])
# → ['session_id','user_id','title','status','messages','created_at','updated_at']
"
```

## 알려진 이슈

- **가스누출/화재 케이스** 분류가 학습 데이터에 명확한 카테고리 없어서 헷갈림 (top-3 결과 부정확). 답변 LLM은 urgency=true로 119 안내 정확. 실제 데모엔 문제 없음.
- ~~**CLOVA Voice Premium 미활성화**~~ → **해결됨** (2026-07-02). 처음엔 edge-tts 무료 사용, 이후 **ElevenLabs Starter($6/월) 도입 + 마음결 확정 voice (uyVNoMrnUku1dZyVEXwD)** 로 최종. edge-tts는 fallback으로 유지.
- **사례 활용** — 답변에 인용은 잘 되지만 sub_queries의 각 서브 cases 개별 활용은 완벽하지 않을 수 있음 (아직 세밀 검증 안 됨).
- ~~**history in-memory** — 서버 재시작 시 사라짐~~ → **해결됨** (2026-07-01). `chat_sessions` 테이블 기반으로 이전, `/chat/ask`가 매 턴 DB 커밋.
- **프론트 SPA 새로고침 404** — `/chatbot` 같은 클라이언트 라우트 새로고침 시 프론트의 광범위 프록시가 백엔드로 넘겨 404. **프론트 담당자가 프록시를 `/api/*` 만 잡도록 좁혀야 함.**
- **HTTPS 미적용** — `http://` 만 사용 중. 발표 완성도 원하면 Cloudflare Tunnel 등 30분 작업.
- **음성 원본 미저장** — `/chat/voice`는 STT 텍스트만 저장 (오디오 원본은 버림). 재생 필요하면 별도 저장 로직 추가 필요.
- **세션 삭제 시 첨부 파일 남음** — `DELETE /chat/sessions/{id}`에 파일 삭제 로직 미포함. `uploads/chat/` 정리 스크립트 필요할 수도.

## 사용자 스타일/선호

- **GitHub push는 명시 허락 후에만**. 자동 push 금지.
- **한 단계씩 진행**하고 확인 받기. 옵션 나열 자제.
- **결정 사항 명확히 요약 후 진행** ("OK 확정: 1번..." 식).
- **인코딩 안전**: Windows cp949 콘솔에서 한글 깨짐 → 파일 출력 후 Read 권장.

## 자주 쓰는 명령 패턴

```python
# chatbot_service import
import sys; sys.path.insert(0, r'C:\Users\smhrd\Desktop\실전 프로젝트')
import chatbot_service as svc

# answer_chatbot 실측 (async)
import asyncio
r = asyncio.run(svc.answer_chatbot('도로에 포트홀이 났어요'))
print(r['metadata']['classification']['category'])
print(r['answer'])

# DB 직접 연결
import psycopg2
conn = psycopg2.connect(host='project-db-campus.smhrd.com', port=3310,
  user='mp_24k_li9_p3_3', password='<PG_PASSWORD>', dbname='mp_24k_li9_p3_3')
```
