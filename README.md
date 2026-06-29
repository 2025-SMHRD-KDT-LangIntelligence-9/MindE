# 마음이 민원 챗봇 — AI 모듈

공공 민원 자동 분류 + 긴급 판정 + RAG 검색을 제공하는 AI 서비스.
백엔드(FastAPI 등)는 `chatbot_service.py`를 import해서 사용.

## 빠른 시작

### 1. 환경
- Python **3.11** (3.12+ 미테스트, 3.14는 호환성 이슈 있음)
- (권장) CUDA GPU
- PostgreSQL + **pgvector** 확장

### 2. 설치
```bash
pip install -r requirements.txt
```

### 3. 환경변수
`.env.example`을 `.env`로 복사 후 값 채움:
```
PG_HOST=...
PG_USER=...
PG_PASSWORD=...
PG_DB=...
OPENAI_API_KEY=sk-...
```

### 4. 모델 다운로드
`models/README.md` 참조. `bert-v9/final/`, `urgency-bert/final/` 두 폴더 필요.

### 5. DB 초기화
```bash
psql -h <host> -U <user> -d <db> -f db/schema.sql
```

### 6. RAG 데이터 적재 (선택, 이미 적재됐으면 skip)
```bash
python scripts/load_laws.py              # 법령 26개 → 5,441 조항
python scripts/embed_rag_documents.py    # KoSimCSE 임베딩 생성
```

### 7. 사용
```python
import chatbot_service as svc

r = svc.classify_complaint("도로 포트홀 신고합니다")
# {'category': '교통', 'category_id': 1, 'confidence': 0.97, 'top_k': [...]}

r = svc.check_urgency("아파트에서 가스누출!")
# {'is_urgent': True, 'probability_urgent': 0.99, 'matched_keyword': '가스누출', ...}

laws = svc.search_laws("주차금지 어디까지", category_id=1, limit=5)
# [{'title': '도로교통법 제33조(...)', 'content': '...', 'similarity': 0.587}, ...]
```

## 디렉토리 구조

```
ai/
├── README.md                  # ← 여기
├── requirements.txt
├── .env.example
├── chatbot_service.py         # 백엔드용 진입점 ⭐
├── classifier.py
├── mcp_server.py              # Claude Desktop용 (선택)
├── docs/
│   ├── api_spec.md            # 함수 시그니처/입출력 예시
│   └── architecture.md        # 시스템 흐름
├── db/
│   └── schema.sql             # 12 테이블 DDL + 시드
├── scripts/                   # 학습/적재 재현 (백엔드는 안 봐도 됨)
│   ├── build_labels.py        # 18→11 카테고리 매핑
│   ├── split_and_sample.py    # train/val/test 분할
│   ├── train_classifier.py    # 분류기 학습
│   ├── train_urgency.py       # 긴급 분류기 학습
│   ├── audit_labels.py        # 라벨 노이즈 감사
│   ├── label_urgency.py       # 긴급 룰베이스 라벨링
│   ├── load_laws.py           # 법령 → DB 적재
│   └── embed_rag_documents.py # KoSimCSE 임베딩 생성
└── models/
    └── README.md              # 모델 weight 다운로드 안내
```

## 핵심 API (요약)

| 함수 | 용도 |
|---|---|
| `classify_complaint(text, top_k)` | 11 카테고리 분류 + top_k confidence |
| `check_urgency(text)` | 긴급 여부 + 매칭 키워드 |
| `search_laws(query, category_id?, limit)` | 법령 조항 벡터 검색 |
| `search_cases(query, category_id?, limit)` | 유사 사례 벡터 검색 |
| `lookup_dept_by_category(category_id)` | 카테고리 → 부서 (priority 순) |
| `get_categories()` | 11 카테고리 메타 정보 |

상세는 `docs/api_spec.md`.

## 백엔드 통합 패턴 (권장)

`category_id`가 결정돼야 부서 조회 가능 → 2단계로 나눠서 단계 내 병렬.

```python
import asyncio
import chatbot_service as svc

async def handle_complaint(text: str):
    # 1단계: 카테고리 의존 없는 도구 병렬
    cls, urg, cluster, laws, cases = await asyncio.gather(
        asyncio.to_thread(svc.classify_complaint, text),
        asyncio.to_thread(svc.check_urgency, text),
        asyncio.to_thread(svc.match_or_create_cluster, text),
        asyncio.to_thread(svc.search_laws, text, None, 5),
        asyncio.to_thread(svc.search_cases, text, None, 5),
    )
    cat_id = cls['category_id']

    # 2단계: 카테고리 결정 후 부서 조회 병렬
    depts, dept_search = await asyncio.gather(
        asyncio.to_thread(svc.lookup_dept_by_category, cat_id),
        asyncio.to_thread(svc.search_dept, text, cat_id, 5),
    )

    # 3단계: 결과 합쳐서 OpenAI 호출
    # 4단계: (정식 민원이면) DB 저장 — cluster_id + (urgency + cluster.urgency_bonus)
```

`docs/api_spec.md`에 상세 예시.

## 모델 정보

- **분류기**: KLUE BERT base 파인튜닝, 11 클래스, **test F1 0.873**
- **긴급 분류**: KLUE BERT base 파인튜닝, 이진, **test F1 (긴급) 0.93**
- **임베딩**: `BM-K/KoSimCSE-roberta` (사전학습 그대로 사용, 768d)

## DB 스키마

12 테이블, PostgreSQL + pgvector. 핵심:
- `categories` (11) / `departments` (20) / `category_department_mapping`
- `complaints` / `complaint_responses` / `complaint_status_history`
- `urgency_keywords` (29, 동적 로드)
- `rag_documents` ← 법령/사례/부서 통합 RAG 저장소
- `users` / `notifications` / `complaint_attachments` / `complaint_clusters`

`db/schema.sql`에 전체 DDL + 시드.

## 라이선스/저작권

- AI Hub 143번 데이터: 학습 사용 약관 준수
- 국가법령정보센터: 공공누리 4유형 (출처표시 + 상업이용금지 + 변경금지)
- 국민신문고: 공개 사례

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `CUDA 사용 가능: False` | Python 3.11 + `pip install torch --index-url https://download.pytorch.org/whl/cu121` |
| `ImportError: accelerate>=0.26.0` | `pip install 'accelerate>=0.26.0'` |
| `psycopg2` 설치 실패 | `pip install psycopg2-binary` (소스 빌드 아님) |
| pgvector 없음 | DB에 `CREATE EXTENSION vector;` 권한 필요 |
| 임베딩 차원 불일치 | DB 컬럼 vector(768) 확인, 모델 KoSimCSE인지 확인 |

## 변경 이력

- 2026-06: 초기 릴리스 — 분류기 v9, urgency, 법령 RAG 5,441 조항
