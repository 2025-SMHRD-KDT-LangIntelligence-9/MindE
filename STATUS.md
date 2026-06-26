# 진행 상황 (Resume용)

마지막 업데이트: 2026-06-26

## ✅ 완료된 작업

### 모델 (Hugging Face Private)
- `atti433/minde-classifier` (KLUE BERT 11-class, F1 0.873) + README.md 모델 카드
- `atti433/minde-urgency` (KLUE BERT 이진, F1 0.93) + README.md 모델 카드

### 데이터 적재
- 법령 26개 → 5,441 조항 → `rag_documents` (source_type='law')
- 부서 description 39개 → `rag_documents` (source_type='dept')
- 모두 KoSimCSE-roberta 768차원 임베딩

### DB 구축
- 12 테이블 (PostgreSQL + pgvector 0.7.0)
- `departments` 39개 (본청 17 + 동부지역본부 12 + 소방본부 7 + 특수기관 3)
  - 전화번호 + description 모두 채워짐
- `category_department_mapping` 32개 (priority 순)
- `urgency_keywords` 29개

### AI 인계 패키지 (GitHub `ai` 브랜치)
- `chatbot_service.py` — 백엔드 import용 8개 함수
- `mcp_server.py` — Claude Desktop용
- `classifier.py` — BERT wrapper
- `docs/`, `db/schema.sql`, `models/README.md`

### 백엔드 (별도 팀, `backend` 브랜치)
- FastAPI + 인증 + 민원 CRUD + 알림 + 첨부파일
- AI 모델 직접 연동 (HF에서 다운로드)
- RAG `/rag/ask` 엔드포인트 — gpt-4o-mini

## ⏳ 진행 중 / 보류

### 크롤링 결과 (적재 대기)
- `crawl_epeople/epeople_cases.jsonl` — **25,668건 unique** (dedupe 완료)
- 다음 세션: `load_cases.py` 작성 → rag_documents에 source_type='case' 적재 → 임베딩

### 미적재 RAG 데이터
- moe FAQ 416건 (`edu_dataset.jsonl`) — source_type='faq'로 적재 대기
- 부족 카테고리 6개 법령 보강 — 보건/환경/농축산/복지/상하수도/문화_여가 (보류 검토)

### search_dept 정밀도 개선 (선택)
description 풍부화는 완료했지만 짧은 키워드("주차", "가로등")엔 약함. 옵션:
- **A** (추천): `search_dept`에 `category_id` 필터 추가 → 분류기 결과로 좁힘
- B: 키워드(BM25) + 벡터 하이브리드 검색
- C: description에 자주 쓰는 짧은 키워드 수동 추가
- D: 더 강한 임베딩 모델 (BGE-M3)

## 📌 다음 세션 시작 시 빠른 체크

```bash
# 1. 환경 확인 (Python 3.11)
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" --version

# 2. 크롤링 상태
wc -l "C:/Users/smhrd/Desktop/데이터/crawl_epeople/epeople_cases.jsonl"
# → 25668 (dedupe 완료)

# 3. DB 상태 (한 줄로)
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -c "
import psycopg2
conn = psycopg2.connect(host='project-db-campus.smhrd.com', port=3310,
  user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3')
cur = conn.cursor()
cur.execute('SELECT source_type, COUNT(*) FROM rag_documents GROUP BY source_type')
for r in cur.fetchall(): print(r)
"
# → ('law', 5441), ('dept', 39)
```

## 🎯 다음에 할 일 (우선순위)

1. **search_dept에 category_id 필터 추가** (5분)
   - chatbot_service.py + mcp_server.py 둘 다 수정
   - 분류기 결과로 카테고리 좁힘 → 정밀도 ↑
2. **epeople 사례 25,668건 → rag_documents 적재 + 임베딩** (30분)
   - `load_cases.py` 작성
   - 임베딩 ~10분 (GPU)
3. **moe FAQ 416 적재 + 임베딩** (5분)
4. **백엔드 변경사항 통보**
   - departments 39개, mappings 32개, description 컬럼 추가
   - rag_documents에 source_type='dept' 39행 추가됨
   - 새 함수 `search_dept` 사용 가능

## 🔗 환경/접속 정보

- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- 작업 폴더: `C:\Users\smhrd\Desktop\데이터\` (개발용)
- 인계 패키지: `C:\Users\smhrd\Desktop\실전 프로젝트\` (GitHub `ai` 브랜치)
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3` (.env 참조)
- HF: `atti433` (현재 토큰: 노출됐으니 회전 권장)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE

## ⚠️ 보안 미해결
- HF 토큰 한 개 대화 노출됨 → **회전 필요** (HF Settings > Tokens > Revoke)
- OpenAI API 키도 노출 위험 — `.env` 한 번 확인
