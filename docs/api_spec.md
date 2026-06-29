# chatbot_service API 명세

백엔드가 `import chatbot_service as svc`로 사용.
- **권장 진입점**: `answer_chatbot(text, history=None)` 한 줄 (게이트 + 도구 + LLM 답변 통합)
- 개별 도구는 sync. async 환경에서는 `asyncio.to_thread()`로 감싸서 호출.

```python
import chatbot_service as svc
import asyncio

# 권장 — 메인 진입점
result = await svc.answer_chatbot("도로 포트홀 신고합니다", history=None)

# 개별 도구 (sync)
r = svc.classify_complaint("도로 포트홀 신고합니다")
r = await asyncio.to_thread(svc.classify_complaint, "도로 포트홀 신고합니다")
```

---

## 0. `answer_chatbot(text, history=None) → dict`  ⭐ 메인 진입점

게이트(잡담/민원 판정) → 도구 7개 병렬 호출 → 답변 LLM. 멀티턴 지원.

**Args**
- `text` (str): 사용자의 이번 turn 발언
- `history` (list[dict] | None): 이전 대화 누적. OpenAI messages 포맷 그대로.
  - `[{"role": "user"|"assistant", "content": "..."}, ...]`
  - 최근 10개(=5턴)까지만 LLM에 전달. 저장/관리는 백엔드 책임 (AI 모듈 stateless).
  - None 또는 빈 리스트면 단일턴.

**Returns**
```json
{
  "answer": "교통 관련 민원이군요. 안전신문고 또는 ... 교통행정과(061-286-7450)...",
  "metadata": {
    "tool_used": true,
    "classification": {
      "category": "교통", "category_id": 1, "confidence": 0.97,
      "top_k": [
        {"category": "교통", "category_id": 1, "confidence": 0.97,
         "departments": [{"department_id": 1, "name": "교통행정과", "phone": "061-286-7450", "priority": 1}, ...]},
        {"category": "건축", "category_id": 2, "confidence": 0.02,
         "departments": [...]},
        ...
      ]
    },
    "urgency": {...},
    "cluster": {...},
    "keywords": [...],
    "laws": [...],
    "cases": [...],
    "departments": [...],         // 백워드 호환: top-1 카테고리 부서
    "similar_depts": [...]
  }
}
```

**잡담 케이스** (`tool_used=False`):
```json
{
  "answer": "안녕하세요! 무엇을 도와드릴까요?",
  "metadata": {
    "tool_used": false,
    "classification": null, "urgency": null, "cluster": null,
    "keywords": [], "laws": [], "cases": [], "departments": [], "similar_depts": []
  }
}
```

**환경변수 필수**: `OPENAI_API_KEY`, `OPENAI_MODEL` (기본 gpt-4o)

**내부 흐름**
1. 게이트 LLM (gpt-4o) — 잡담이면 즉답, 민원이면 [TOOL]
2. tool_query 생성 (history 직전 user 발언 2개 + 현재 text)
3. 1단계 5개 도구 병렬: extract_keywords / classify_complaint / check_urgency / search_laws / search_cases
4. match_or_create_cluster (keywords 사용)
5. 2단계: top-3 각 카테고리 부서 병렬 조회 + search_dept(top-1 cat_id)
6. 답변 LLM (gpt-4o) — system + history + (context+질문)

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

## 5. `search_dept(query, category_id=None, limit=5) → list[dict]`

부서 의미 검색 (39개 부서 description 기반).

**Args**
- `query` (str): 자연어 질의
- `category_id` (int|None): 주면 그 카테고리 매핑 부서 안에서만 검색
- `limit` (int): 1~20, 기본 5

**Returns**
```json
[{"document_id": ..., "title": "교통행정과",
  "content": "교통행정과\n담당업무: ...\n전화번호: 061-286-7450",
  "category_id": 1, "similarity": 0.41}]
```

**Notes**
- `category_id=None`이면 39개 전체 (소방본부/특수기관 포함)
- 분류 결과와 조합 시 정확도 ↑

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

## 멀티모달 입력 함수 (async)

### M1. `transcribe_audio(audio_data, lang="Kor") → str`

음성 → 텍스트 (NAVER CLOVA CSR, 60초 이내 단문 인식).

**Args**
- `audio_data` (bytes): 음성 파일 raw bytes (mp3/aac/ac3/ogg/flac/wav)
- `lang` (str): "Kor"(기본), "Eng", "Jpn", "Chn"

**Returns**: 변환된 텍스트 (str). 빈 입력/실패 시 빈 문자열.

**환경변수**: `NAVER_CLOVA_CLIENT_ID`, `NAVER_CLOVA_CLIENT_SECRET`

**사용**
```python
audio_bytes = await audio_file.read()
text = await svc.transcribe_audio(audio_bytes)
result = await svc.answer_chatbot(text, history=...)
```

---

### M2. `synthesize_speech(text, speaker="nara", ...) → bytes`

텍스트 → 음성 mp3 (NAVER CLOVA Voice Premium).

**Args**
- `text` (str): 변환할 텍스트 (~200자 권장)
- `speaker` (str): "nara"(기본 여성), "mijin", "jinho", 또는 캐릭터/감정 보이스
- `speed`, `volume`, `pitch` (int): -5 ~ 5, 기본 0
- `audio_format` (str): "mp3" 또는 "pcm"

**Returns**: 오디오 raw bytes. 빈 입력이면 b''.

**환경변수**: `NAVER_CLOVA_CLIENT_ID`, `NAVER_CLOVA_CLIENT_SECRET`
**선결조건**: NCP 콘솔에서 **CLOVA Voice Premium 서비스 활성화** (CSR과 별도 신청)
**선택**: `CLOVA_TTS_URL` 환경변수로 endpoint 오버라이드 가능

---

### M3. `analyze_image(image_data, mime_type="image/jpeg") → str`

이미지 → 민원 분석 텍스트 (gpt-4o Vision). OCR + 객체/장면 이해 + 민원 의도 추정을 한 번에.

**Args**
- `image_data` (bytes): 이미지 raw bytes (jpg/png/gif/webp)
- `mime_type` (str): "image/jpeg", "image/png" 등

**Returns**: 분석 텍스트 (보이는 것 + 민원 성격 + 카테고리 후보). 빈 입력이면 빈 문자열.

**환경변수**: `OPENAI_API_KEY`, `OPENAI_MODEL` (gpt-4o 권장)

**사용 패턴 (이미지 + 사용자 텍스트 합치기)**
```python
img_desc = await svc.analyze_image(image_bytes, "image/jpeg")
combined = f"[첨부 이미지]\n{img_desc}\n\n[사용자 메시지]\n{user_text}"
result = await svc.answer_chatbot(combined, history=history)
```

**검증된 동작 예시**
- 입력: 도로 싱크홀 사진
- analyze_image 출력: "도로에 큰 싱크홀이 발생한 모습이 보입니다. 주변에는 오렌지색 원뿔형 안전표시... 카테고리 후보: 교통."
- answer_chatbot: 분류기는 건축(0.76)으로 헛바람 → LLM이 top-2 교통(0.20) 채택 → 도로정책과(061-286-7410) 안내

---

## 추천 호출 흐름

### 방법 A: `answer_chatbot` 한 줄 (권장)

```python
async def handle(req):
    history = SESSIONS.get(req.session_id, [])
    result = await svc.answer_chatbot(req.text, history=history)
    SESSIONS[req.session_id] = history + [
        {"role": "user", "content": req.text},
        {"role": "assistant", "content": result["answer"]},
    ]

    m = result['metadata']
    if m['tool_used'] and is_official_complaint(req):
        # 정식 민원 접수 시 DB 저장
        complaints.insert(
            ...,
            category_id = m['classification']['category_id'],
            assigned_department_id = m['departments'][0]['department_id'] if m['departments'] else None,
            cluster_id = m['cluster']['cluster_id'],
            urgency_score = m['urgency']['probability_urgent'] + m['cluster']['urgency_bonus'],
        )
        complaint_responses.insert(content=result['answer'], ...)
    return result
```

### 방법 B: 개별 도구 직접 호출 (커스텀)

게이트/LLM 직접 제어가 필요하면 도구만 골라서 호출. 이 경우 OpenAI 호출도 백엔드 책임.

```python
async def handle_complaint(text: str):
    # ─── 1단계: 카테고리 의존 없는 도구 병렬 ───
    cls, urg, cluster, laws, cases = await asyncio.gather(
        asyncio.to_thread(svc.classify_complaint, text),
        asyncio.to_thread(svc.check_urgency, text),
        asyncio.to_thread(svc.match_or_create_cluster, text),
        asyncio.to_thread(svc.search_laws, text, None, 5),
        asyncio.to_thread(svc.search_cases, text, None, 5),
    )
    cat_id = cls['category_id']

    # ─── 2단계: category_id 결정 후 부서 조회 병렬 ───
    depts, dept_search = await asyncio.gather(
        asyncio.to_thread(svc.lookup_dept_by_category, cat_id),
        asyncio.to_thread(svc.search_dept, text, cat_id, 5),
    )
    # 백엔드가 OpenAI 직접 호출 (context 조립 + 프롬프트 직접 관리)
    ...
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
