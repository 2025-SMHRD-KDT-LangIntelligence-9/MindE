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

### 7. 사용 (한 줄 통합)
```python
import chatbot_service as svc

# 메인 진입점 — 분류/긴급/법령/부서/클러스터/LLM 답변까지 한 번에
result = await svc.answer_chatbot("도로 포트홀 신고하고 싶어요")
# {
#   "answer": "교통 관련 민원이군요. 도로교통법 제33조 ... 교통행정과(061-286-7450)...",
#   "metadata": {
#     "classification": {...}, "urgency": {...}, "cluster": {...},
#     "keywords": [...], "laws": [...], "cases": [...],
#     "departments": [...], "similar_depts": [...]
#   }
# }
```

개별 도구 직접 호출도 가능:
```python
r = svc.classify_complaint("도로 포트홀 신고합니다")
# {'category': '교통', 'category_id': 1, 'confidence': 0.97, 'top_k': [...]}

laws = svc.search_laws("주차금지 어디까지", category_id=1, limit=5)
```

### 8. FastAPI startup에 preload (필수)
```python
@app.on_event("startup")
async def startup():
    svc.preload_models()   # 첫 호출 race condition + 응답 지연 제거
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

### 메인 (async)
| 함수 | 용도 |
|---|---|
| **`answer_chatbot(text)`** ⭐ | 모든 도구 + LLM 호출 → 자연어 답변 + metadata |
| `extract_keywords(text)` | LLM으로 키워드 추출 (클러스터링 input용) |

### 도구 함수 (sync — `asyncio.to_thread`로 감쌀 것)
| 함수 | 용도 |
|---|---|
| `classify_complaint(text, top_k)` | 11 카테고리 분류 + top_k confidence |
| `check_urgency(text)` | 긴급 여부 + 매칭 키워드 |
| `match_or_create_cluster(text, keywords?)` | 유사 민원 클러스터 매칭/생성 + urgency_bonus |
| `search_laws(query, category_id?, limit)` | 법령 조항 벡터 검색 (5,441 조항) |
| `search_cases(query, category_id?, limit)` | 유사 사례 검색 (적재 대기) |
| `search_dept(query, category_id?, limit)` | 부서 의미 검색 (39개) |
| `lookup_dept_by_category(category_id)` | 카테고리 → 부서 (priority 순) |
| `get_categories()` | 11 카테고리 메타 정보 |

### 유틸
| 함수 | 용도 |
|---|---|
| `preload_models()` | 서버 startup에서 호출 (race condition 방지) |

상세는 `docs/api_spec.md`.

## 백엔드 통합 패턴 (권장)

### 패턴 1: 한 줄 호출 (대부분의 경우)
```python
import chatbot_service as svc

@router.post("/chat/ask")
async def chat(req):
    result = await svc.answer_chatbot(req.text)
    return result  # {answer, metadata}
```

정식 민원 접수 시 metadata에서 DB 저장값 추출:
```python
@router.post("/complaints")
async def submit(req):
    result = await svc.answer_chatbot(req.content)
    m = result['metadata']

    complaint_id = db.insert("complaints", {
        "user_id": req.user_id,
        "title": req.title,
        "content": req.content,
        "category_id": m['classification']['category_id'],
        "assigned_department_id": m['departments'][0]['department_id'] if m['departments'] else None,
        "cluster_id": m['cluster']['cluster_id'],
        "urgency_score": m['urgency']['probability_urgent'] + m['cluster']['urgency_bonus'],
        "status": "received",
    })
    db.insert("complaint_responses", {"complaint_id": complaint_id,
                                       "content": result['answer']})
```

### 패턴 2: 도구만 개별 호출 (커스텀)
필요시 도구만 골라서 직접 호출. 이 경우 LLM(OpenAI)은 백엔드가 직접 처리.

```python
async def handle(text):
    cls = await asyncio.to_thread(svc.classify_complaint, text)
    cat_id = cls['category_id']
    depts = await asyncio.to_thread(svc.lookup_dept_by_category, cat_id)
    # 백엔드가 OpenAI 직접 호출 ...
```

`docs/api_spec.md`에 상세 예시.

## 모델 정보

- **분류기**: KLUE BERT base 파인튜닝, 11 클래스, **test F1 0.873**
- **긴급 분류**: KLUE BERT base 파인튜닝, 이진, **test F1 (긴급) 0.93**
- **임베딩**: `BM-K/KoSimCSE-roberta` (사전학습 그대로 사용, 768d)

## DB 스키마

12 테이블, PostgreSQL + pgvector. 핵심:
- `categories` (11) / `departments` (**39** — description 컬럼 포함) / `category_department_mapping` (32)
- `complaints` / `complaint_responses` / `complaint_status_history`
- `urgency_keywords` (29, 동적 로드)
- `rag_documents` ← 법령/부서/사례 통합 RAG (vector(768))
- `complaint_clusters` (centroid vector(768) 포함)
- `users` / `notifications` / `complaint_attachments`

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
- 2026-06: 부서 확장 — 39 부서 (전화/description), 매핑 32개, search_dept 추가
- 2026-06: 클러스터링 통합 — match_or_create_cluster + centroid 컬럼
- 2026-06: answer_chatbot (메인 진입점) + extract_keywords LLM 통합
- 2026-06: 시스템 프롬프트 강화 (할루시네이션 방지), preload_models 추가
- 2026-06: search_faq 제거 (교육 카테고리 데이터 부족)
