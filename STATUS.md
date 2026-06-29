# 진행 상황 (Resume용)

마지막 업데이트: 2026-06-29 (오후 — 게이트/멀티턴/Top-3 LLM 선택 추가)

## ✅ 완료된 작업

### 모델 (Hugging Face Private)
- `atti433/minde-classifier` (KLUE BERT 11-class, F1 0.873)
- `atti433/minde-urgency` (KLUE BERT 이진, F1 0.93)
- 둘 다 모델 카드 포함

### DB 구축 (PostgreSQL + pgvector)
- 12 테이블, 모두 시드 적용
- `departments` 39개 (전화/description 채움) — 본청 17 + 동부 12 + 소방 7 + 특수 3
- `category_department_mapping` 32개 (priority 순)
- `urgency_keywords` 29개
- `complaint_clusters.centroid vector(768)` 컬럼 추가

### RAG 적재 (`rag_documents`)
| source_type | 건수 | 임베딩 |
|---|---:|---:|
| law (법령 조항) | 5,441 | ✅ |
| dept (부서 description) | 39 | ✅ |
| case (epeople 사례) | **0** | ⏳ 미적재 |

### chatbot_service (백엔드 import용)
| 함수 | 용도 |
|---|---|
| **`answer_chatbot(text, history=None)`** ⭐ | 메인 진입점 — 게이트 + 도구 7개 + LLM 답변 |
| `extract_keywords(text)` | LLM 키워드 추출 (클러스터링 input) |
| `classify_complaint(text, top_k)` | 11 카테고리 분류 |
| `check_urgency(text)` | 긴급 + DB 키워드 매칭 |
| `search_laws(query, category_id?, limit)` | 법령 RAG |
| `search_cases(query, category_id?, limit)` | 사례 RAG (데이터 없음) |
| `search_dept(query, category_id?, limit)` | 부서 의미 검색 |
| `lookup_dept_by_category(category_id)` | 카테고리 → 부서 priority 순 |
| `match_or_create_cluster(text, keywords?, threshold=0.75)` | 클러스터링 + urgency_bonus |
| `get_categories()` | 11 카테고리 메타 |
| `preload_models()` | 서버 startup용 |

### answer_chatbot 흐름 (현재 버전)

```
사용자 입력 + history (백엔드 전달)
   ↓
[0단계] 게이트 LLM (gpt-4o)
   - GATE_PROMPT + history 같이 전달
   - 잡담이면 → 즉답 반환, tool_used=False, 도구 호출 0회
   - 민원이면 → [TOOL] 신호 → 아래 단계
   ↓
[1단계] 5개 도구 병렬 (asyncio.gather)
   - extract_keywords (LLM, tool_query 기반)
   - classify_complaint(tool_query, top_k=3)
   - check_urgency(tool_query)
   - search_laws(tool_query)
   - search_cases(tool_query)
   - match_or_create_cluster(tool_query, keywords)
   ※ tool_query = history 직전 user 발언 2개 + 현재 text (A안)
   ↓
[2단계] top-3 카테고리 각각의 부서 병렬 조회
   - lookup_dept_by_category × 3 (top-3 각각)
   - search_dept (top-1 cat_id 기준)
   - classification.top_k 각 item에 departments 동봉
   ↓
[3단계] 답변 LLM (gpt-4o)
   - SYSTEM_PROMPT + history + (context+질문)
   - top-3 중 의미적으로 맞는 카테고리를 LLM이 직접 선택
```

### 스모크 테스트 결과 (2026-06-29)
| 시나리오 | tool_used | 결과 |
|---|---|---|
| "안녕하세요" | False | 도구 0회, 인사 답변 |
| "도로 포트홀 신고합니다" | True | 분류기는 건축(0.96) 헛바람, LLM이 top-2 교통 선택 → 교통행정과(061-286-7450) |
| "그럼 어떻게 신고해요?" (history) | True | A안 동작, 교통행정과 일관 유지, 절차 안내 추가 |
| "고마워요" | False | 도구 0회, 감사 응답 |

### MCP 서버 (Claude Desktop용)
- 도구 9개 (chatbot_service 함수들 그대로 노출)
- ⚠️ MCP는 answer_chatbot history 미지원 (단발성). 백엔드는 직접 import 권장.

### 백엔드 (`backend` 브랜치, 별도 팀)
- FastAPI + 인증 + 민원 CRUD + 알림 + 첨부파일
- RAG `/rag/ask` 엔드포인트
- 모델 직접 연동 (HF에서 다운로드)

## ⏳ 보류 / 미완

### 데이터 적재 (기능 자체는 됨, 데이터만 비어있음)
- **epeople 사례** — 크롤링 ~26k unique, DB 적재 대기

### 백엔드 통보 필요 (오늘자 변경)
- ⭐ `answer_chatbot` 시그니처: `(text)` → `(text, history=None)`
- ⭐ 게이트 분기: `metadata['tool_used']` 보고 화면 처리 분기 가능 (잡담 시 분류/부서 등 None)
- ⭐ classification.top_k 각 후보에 `departments` 동봉
- ⭐ OPENAI_MODEL = gpt-4o (비용↑, 정확도↑)
- (이전) `departments.description` / `complaint_clusters.centroid` / `search_dept` / `match_or_create_cluster`

### 미적용 후보
- 추가 시나리오 테스트 (긴급 케이스, 11 카테고리 골고루)
- 클러스터 답변 재활용 (`get_cluster_context`) — 운영 데이터 쌓이면 검토
- 부족 카테고리 6개 법령 (보건/환경/농축산/복지/상하수도/문화_여가)
- search_dept 정밀도 (짧은 키워드에 약함) — 임계값/하이브리드 검색
- 분류기 v9의 포트홀 → 건축 오분류 (현재 LLM이 보정 중)

## 📌 다음 세션 빠른 체크

```bash
# 1. Python
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" --version

# 2. 크롤링 상태
wc -l "C:/Users/smhrd/Desktop/데이터/crawl_epeople/epeople_cases.jsonl"

# 3. DB 상태
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import psycopg2
conn = psycopg2.connect(host='project-db-campus.smhrd.com', port=3310,
  user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3')
cur = conn.cursor()
cur.execute('SELECT source_type, COUNT(*) FROM rag_documents GROUP BY source_type')
print(cur.fetchall())
"

# 4. 게이트 + 멀티턴 스모크
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import asyncio, sys; sys.path.insert(0, 'C:/Users/smhrd/Desktop/실전 프로젝트')
import chatbot_service as svc
r = asyncio.run(svc.answer_chatbot('안녕하세요'))
print(r['metadata']['tool_used'], r['answer'][:50])
"
```

## 🎯 다음 우선순위

1. **백엔드 통보** — 시그니처 변경(history), tool_used 플래그, OPENAI_MODEL=gpt-4o
2. **발표 데모 시나리오 추가 테스트** — 11 카테고리 골고루 + 긴급 케이스
3. **epeople 사례 적재 + 임베딩** — search_cases 활성화
4. (선택) 분류기 v10 재시도 (현재 LLM 보정 중)
5. (선택) search_cases가 채워지면 cases 활용도 검증

## 🔗 환경/접속

- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- 작업: `C:\Users\smhrd\Desktop\데이터\`
- 인계: `C:\Users\smhrd\Desktop\실전 프로젝트\` ↔ GitHub `ai` 브랜치
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3`
- HF: `atti433` (토큰 회전 권장 — 대화 노출)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE

## ⚠️ 보안
- HF 토큰 대화 노출 → 회전 권장
