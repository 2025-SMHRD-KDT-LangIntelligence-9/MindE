# 진행 상황 (Resume용)

마지막 업데이트: 2026-06-29

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
| faq (moe FAQ) | **0** | ⏳ 미적재 |

### chatbot_service (백엔드 import용)
| 함수 | 용도 |
|---|---|
| `classify_complaint(text, top_k)` | 11 카테고리 분류 |
| `check_urgency(text)` | 긴급 + DB 키워드 매칭 |
| `search_laws(query, category_id?, limit)` | 법령 RAG |
| `search_cases(query, category_id?, limit)` | 사례 RAG (데이터 없음) |
| `search_faq(query, limit)` | FAQ RAG (데이터 없음) |
| `search_dept(query, category_id?, limit)` | 부서 의미 검색 |
| `lookup_dept_by_category(category_id)` | 카테고리 → 부서 priority 순 |
| `match_or_create_cluster(text, threshold=0.75)` | 클러스터링 + urgency_bonus |
| `get_categories()` | 11 카테고리 메타 |

### MCP 서버 (Claude Desktop용)
- 도구 10개 (chatbot_service의 함수들 + lookup_dept_intro/phone CSV)

### AI 인계 패키지 (GitHub `ai` 브랜치)
- 최신 커밋: `f9f6821` (match_or_create_cluster + search_dept category filter)

### 백엔드 (`backend` 브랜치, 별도 팀)
- FastAPI + 인증 + 민원 CRUD + 알림 + 첨부파일
- RAG `/rag/ask` 엔드포인트 (gpt-4o-mini)
- 모델 직접 연동 (HF에서 다운로드)

## ⏳ 보류 / 미완

### 데이터 적재 (기능 자체는 됨, 데이터만 비어있음)
- **epeople 사례** — 크롤링 `25,919건 unique` 완료, DB 적재 대기
- **moe FAQ 416건** — `edu_dataset.jsonl`에서 적재 대기

### 백엔드 통보 필요
- 오늘 추가/변경된 것 백엔드한테 안 알림:
  - `departments.description` 컬럼 추가
  - `complaint_clusters.centroid` 컬럼 추가
  - `search_dept` 함수 + category_id 파라미터
  - `match_or_create_cluster` 함수 → 민원 INSERT 흐름에 호출 추가 권장
- 통합 가이드: 민원 INSERT 시
  ```python
  cluster = svc.match_or_create_cluster(text)
  complaints.insert(..., cluster_id=cluster['cluster_id'],
                    urgency_score=base + cluster['urgency_bonus'])
  ```

### 미적용 후보
- 클러스터 답변 재활용 (`get_cluster_context`) — 운영 데이터 쌓이면 검토
- 부족 카테고리 6개 법령 (보건/환경/농축산/복지/상하수도/문화_여가)
- search_dept 정밀도 (짧은 키워드에 약함) — 임계값/하이브리드 검색

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
```

## 🎯 다음 우선순위

1. **백엔드 통보** — 오늘 변경사항 슬랙/대면 전달
2. **epeople 사례 적재 + 임베딩** (30분) — search_cases 활성화
3. **moe FAQ 적재** (5분) — search_faq 활성화
4. (선택) search_dept 정밀도 개선
5. (선택) 클러스터 답변 재활용 기능

## 🔗 환경/접속

- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- 작업: `C:\Users\smhrd\Desktop\데이터\`
- 인계: `C:\Users\smhrd\Desktop\실전 프로젝트\` ↔ GitHub `ai` 브랜치
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3`
- HF: `atti433` (토큰 회전 권장 — 대화 노출)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE

## ⚠️ 보안
- HF 토큰 대화 노출 → 회전 권장
