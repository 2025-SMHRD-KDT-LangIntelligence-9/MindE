# chatbot_service API 명세

백엔드가 `import chatbot_service as svc`로 사용. 모든 함수는 sync. async 환경(FastAPI 등)에서는 `asyncio.to_thread()`로 감싸서 호출.

```python
import chatbot_service as svc
import asyncio

# sync 호출
r = svc.classify_complaint("도로 포트홀 신고합니다")

# async 환경
r = await asyncio.to_thread(svc.classify_complaint, "도로 포트홀 신고합니다")

# 병렬 호출 (Agent 패턴)
results = await asyncio.gather(
    asyncio.to_thread(svc.classify_complaint, text),
    asyncio.to_thread(svc.check_urgency, text),
    asyncio.to_thread(svc.search_laws, text, None, 5),
)
```

---

## 1. `classify_complaint(text, top_k=3) → dict`

민원 텍스트를 11개 카테고리로 분류.

**Args**
- `text` (str): 민원 본문 (한글)
- `top_k` (int): 반환할 후보 수 (1~11, 기본 3)

**Returns**
```json
{
  "category": "교통",
  "category_id": 1,
  "confidence": 0.9657,
  "top_k": [
    {"category": "교통", "category_id": 1, "confidence": 0.9657},
    {"category": "건축", "category_id": 2, "confidence": 0.0182},
    {"category": "보건위생", "category_id": 4, "confidence": 0.005}
  ]
}
```

**Notes**
- `confidence < 0.7`이면 top-2/3까지 RAG 검색 권장
- 빈 텍스트 입력 시 모든 값 0/None

---

## 2. `check_urgency(text) → dict`

긴급 여부 판정. 분류 모델 + DB 키워드 + 예외룰 조합.

**Args**
- `text` (str): 민원 본문

**Returns**
```json
{
  "is_urgent": true,
  "probability_urgent": 0.9991,
  "probability_normal": 0.0009,
  "matched_keyword": "가스누출",
  "all_matched_keywords": ["가스누출", "연기"],
  "rule_excluded": false
}
```

**Notes**
- `is_urgent=true` → 즉시 **119/112/안전신문고** 우선 안내
- `rule_excluded=true`면 키워드는 매칭됐지만 "예방·안내·문의" 등 비긴급 단어 동반 → 일반으로 분류
- 키워드는 DB `urgency_keywords` 테이블에서 동적 로드 (29개, weight 0.85~0.95)

---

## 3. `search_laws(query, category_id=None, limit=5) → list[dict]`

법령 조항 벡터 검색 (총 5,441 조항, 26개 법령).

**Args**
- `query` (str): 검색 질의
- `category_id` (int|None): 카테고리 필터 (1~11)
- `limit` (int): 1~20, 기본 5

**Returns**
```json
[
  {
    "document_id": 3617,
    "title": "도로교통법 제17조(자동차등과 노면전차의 속도)",
    "content": "① 자동차등...",
    "category_id": 1,
    "similarity": 0.587
  },
  ...
]
```

**Notes**
- 유사도(cosine) 0~1. 통상 **0.5+ = 관련 있음**, 0.6+ = 강한 관련
- 답변 작성 시 근거 법령으로 인용 ("도로교통법 제17조에 따르면...")
- 커버 법령: 행정/세무/교통/건축/일반(민형법)/교육

---

## 4. `search_cases(query, category_id=None, limit=5) → list[dict]`

국민신문고 유사 사례 검색 (질문 + 공식 답변 포함).

**Args, Returns**: `search_laws`와 동일 구조

**Notes**
- content에 "민원: ... 답변: ..." 형태
- "이런 비슷한 민원은 이렇게 처리했습니다" 참조 답변용
- 카테고리 매핑은 추정값 (epeople은 명시적 카테고리 없음)

---

## 5. `search_faq(query, limit=5) → list[dict]`

교육부 FAQ 검색 (416건, 교육 카테고리 전용).

**Args**
- `query` (str)
- `limit` (int)

**Returns**: `search_laws`와 동일 구조 (단 `category_id` 인자 없음 — FAQ는 전부 교육)

**Notes**
- 분류기가 "교육"으로 잡지 않으면 사용 안 함 (교육은 분류기 11카테고리 외부, 별도 라우팅)
- 학교/저작권/입시/학사 관련

---

## 6. `lookup_dept_by_category(category_id) → list[dict]`

카테고리에 매핑된 처리 부서를 priority 순으로 반환.

**Args**
- `category_id` (int): 1~11

**Returns**
```json
[
  {"department_id": 1, "name": "교통행정과", "email": null, "phone": null, "priority": 1},
  {"department_id": 2, "name": "도로정책과", "email": null, "phone": null, "priority": 2}
]
```

**Notes**
- priority 낮을수록 우선 (1이 1순위)
- 카테고리당 1~3개
- email/phone은 현재 미입력 (Null) → 운영 후 채워야 함

---

## 7. `get_categories() → list[dict]`

11개 카테고리 메타. 분류기 라벨 → DB ID 매핑 확인용.

**Returns**
```json
[
  {"category_id": 1, "name": "교통"},
  {"category_id": 2, "name": "건축"},
  {"category_id": 3, "name": "행정"},
  {"category_id": 4, "name": "보건위생"},
  {"category_id": 5, "name": "환경"},
  {"category_id": 6, "name": "문화_여가"},
  {"category_id": 7, "name": "농축산"},
  {"category_id": 8, "name": "복지"},
  {"category_id": 9, "name": "세무"},
  {"category_id": 10, "name": "상하수도"},
  {"category_id": 11, "name": "경제"}
]
```

---

## 추천 호출 흐름 (2단계 병렬)

핵심 의존: `category_id`가 결정돼야 부서 조회 가능. 두 단계로 나눠서 단계 내 병렬.

```python
async def handle_complaint(text: str):
    # ─── 1단계: 카테고리 의존 없는 도구 병렬 ───
    cls, urg, cluster, laws, cases, faq = await asyncio.gather(
        asyncio.to_thread(svc.classify_complaint, text),
        asyncio.to_thread(svc.check_urgency, text),
        asyncio.to_thread(svc.match_or_create_cluster, text),
        asyncio.to_thread(svc.search_laws, text, None, 5),
        asyncio.to_thread(svc.search_cases, text, None, 5),
        asyncio.to_thread(svc.search_faq, text, 5),
    )
    cat_id = cls['category_id']

    # ─── 2단계: category_id 결정 후 부서 조회 병렬 ───
    depts, dept_search = await asyncio.gather(
        asyncio.to_thread(svc.lookup_dept_by_category, cat_id),
        asyncio.to_thread(svc.search_dept, text, cat_id, 5),
    )

    # ─── 3단계: 결과 합쳐서 OpenAI 호출 ───
    context = {
        'classification': cls,
        'urgency': urg,
        'cluster': cluster,         # cluster_id, urgency_bonus 포함
        'laws': laws,
        'cases': cases,
        'faq': faq,
        'departments_priority': depts,
        'departments_semantic': dept_search,
    }
    answer = await openai_generate(text, context)

    # ─── 4단계: (정식 민원 접수면) DB 저장 ───
    complaints.insert(
        ...,
        category_id = cat_id,
        assigned_department_id = depts[0]['department_id'] if depts else None,
        cluster_id = cluster['cluster_id'],
        urgency_score = urg['probability_urgent'] + cluster['urgency_bonus'],
    )
    complaint_responses.insert(complaint_id=..., content=answer, ...)

    # 4) DB 저장 (complaints/complaint_responses)
    ...
    return answer
```

## 에러 처리

- 모든 함수는 빈 입력에 대해 빈/기본값 반환 (예외 안 던짐)
- DB 연결 실패 시 `psycopg2.OperationalError` → 백엔드에서 catch
- 모델 로딩 실패 시 첫 호출에서 `FileNotFoundError` → 모델 다운로드 확인

## 성능 (참고)

| 함수 | CPU | GPU (RTX 4060 Ti) |
|---|---|---|
| classify_complaint | ~400ms | ~50ms |
| check_urgency | ~400ms | ~50ms |
| search_* (벡터) | ~150ms | ~80ms (임베딩 가속) |
| lookup_dept_by_category | ~30ms | ~30ms (DB only) |
| get_categories | ~30ms (캐시 후 0ms) | 동일 |

병렬 시 max(개별 함수 시간) ≈ 80~400ms.
