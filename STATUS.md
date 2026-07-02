# 진행 상황 (Resume용)

마지막 업데이트: 2026-07-02 (정부24 절차 RAG + TTS 무료화 + 부서 판단 강화)

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
- **13 테이블** (chat_sessions 추가), 카테고리 11 / 부서 39 / 매핑 32 / urgency_keywords 29
- `rag_documents`: law 5,441 + dept 39 + case **37,909** (임베딩 완료, 벡터 검색 활성)
- `complaint_clusters` 초기화 완료 (28건 → 0건). 시퀀스도 1부터 리셋.
- **마이그레이션 v2/v3/v4 모두 적용 완료** (`scripts/migrate_v2.sql`, `migrate_v3.sql`, `migrate_v4.sql`)
  - v2: `users.department_id`, `complaints.memo/updated_at`, `notifications.is_read`
  - v3: `chat_sessions` 테이블 (session_id / user_id / title / status / messages JSONB / created_at)
  - v4: `chat_sessions.updated_at` + 인덱스 `(user_id, updated_at DESC)`

### chatbot_service 함수
| 함수 | 용도 |
|---|---|
| `answer_chatbot(text, history=None)` ⭐ | 게이트 + 분해 + 도구 병렬 + 답변 LLM |
| `decompose_query(text, history)` | 복합 민원 자동 분해 |
| `transcribe_audio(audio_bytes)` | 음성→텍스트 (CLOVA CSR) |
| `synthesize_speech(text, speaker)` | 텍스트→음성 mp3 (CLOVA Voice Premium, 미활성) |
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

## 백엔드 통합 (backend-ai 폴더)

- `C:\Users\smhrd\Desktop\backend-ai\` — self-contained (HF 자동 다운로드 반영)
- `.env`에 `HF_TOKEN`, `OPENAI_API_KEY`, `NAVER_CLOVA_*`, `DB_*`, `PG_*`, `JWT_SECRET_KEY` 포함
- `backend-ai.zip` (`C:\Users\smhrd\Downloads\backend-ai.zip`, 784MB) — 윤지은 씨 전달용
  - HF 자동 다운로드 세팅 후 크기 감소 여지 있음 (models/ 폴더 삭제 시 ~20MB)

## 발표 일정 및 남은 항목

- 발표: **2026-07-09** (7/1 기준 D-8)

### 발표 전 남은 작업
| 우선순위 | 항목 | 시간 | 담당 |
|---|---|---|---|
| 🔴 | 프론트 담당자 API 인계 — `/chat/reset` 제거, `/chat/ask`에 `session_id` 추가, 신규 세션 CRUD 5개, 백엔드 20개 신규 엔드포인트 | 30분 | 사용자 |
| 🔴 | 백엔드/프론트 인계 (HF_TOKEN, sub_queries 스키마, models/ 폴더 제거) | 30분 | 사용자 |
| 🔴 | 발표 데모 시나리오 확정 + 리허설 | 1시간 | 사용자 |
| 🟡 | 11 카테고리 골고루 실측 (예상 못한 케이스 대비) | 30분 | AI |
| ~~🟡~~ | ~~CLOVA Voice Premium 활성화 (TTS 데모)~~ → **해결됨** (Microsoft Edge Neural TTS로 교체, 무료) | - | - |
| 🟡 | HF 토큰 회전 (이전 노출) | 5분 | 사용자 |
| 🟢 | 자주 쓰는 문서 양식 자동 작성 (기획서 ⑥ 완성도) | 1~2시간 | 선택 |
| 🟢 | 카톡/SMS 알림 통합 | 반나절 | 백엔드 |
| 🟢 | 관리자 대시보드 시각화 (백엔드 CRUD는 완료) | 반나절 | 백엔드+프론트 |

## 환경/접속

- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- AI 인계 폴더: `C:\Users\smhrd\Desktop\실전 프로젝트\` (ai 브랜치 push 대상)
- 백엔드 통합 폴더: `C:\Users\smhrd\Desktop\backend-ai\` (윤지은 씨 인계 대상)
- 재라벨링 워크스페이스: `C:\Users\smhrd\Desktop\데이터\relabel-workspace\`
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3`
- HF 저장소: `atti433/minde-classifier`, `atti433/minde-urgency` (HF_TOKEN 필요)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE (ai 브랜치)

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
  user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3')
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
  user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3')
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name='chat_sessions' ORDER BY ordinal_position\")
print([r[0] for r in cur.fetchall()])
# → ['session_id','user_id','title','status','messages','created_at','updated_at']
"
```

## 알려진 이슈

- **가스누출/화재 케이스** 분류가 학습 데이터에 명확한 카테고리 없어서 헷갈림 (top-3 결과 부정확). 답변 LLM은 urgency=true로 119 안내 정확. 실제 데모엔 문제 없음.
- ~~**CLOVA Voice Premium 미활성화** — 코드는 준비. NCP 콘솔에서 서비스 신청 필요.~~ → **해결됨** (2026-07-02). CLOVA Voice Premium(월 9만원)이 부담이라 **Microsoft Edge Neural TTS (edge-tts, 무료)** 로 교체. `synthesize_speech()` 시그니처 그대로 유지되어 백엔드/프론트 코드 무영향. 품질은 CLOVA Premium 급 (SunHi 여성 / InJoon 남성).
- **사례 활용** — 답변에 인용은 잘 되지만 sub_queries의 각 서브 cases 개별 활용은 완벽하지 않을 수 있음 (아직 세밀 검증 안 됨).
- ~~**history in-memory** — 서버 재시작 시 사라짐~~ → **해결됨** (2026-07-01). `chat_sessions` 테이블 기반으로 이전, `/chat/ask`가 매 턴 DB 커밋.
- **프론트 마이그레이션 필요** — `/chat/reset` 엔드포인트 제거됨. 프론트가 사용 중이면 `DELETE /chat/sessions/{id}`로 이관. 또한 `/chat/ask` 요청에 `session_id` 필드가 추가됨 (없으면 서버가 자동 생성해 응답에 포함).

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
  user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3')
```
