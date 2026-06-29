# 마음이 민원 챗봇 — AI 시스템 아키텍처

## 전체 흐름

```
[사용자]
   │  "도로 포트홀 신고하고 싶어요"
   ▼
[프론트엔드]
   │  POST /complaints  (또는 /chat/ask)
   ▼
[백엔드 FastAPI]
   │
   │  ─── [1단계] 카테고리 의존 없는 도구 병렬 실행 ───
   │      ├─ classify_complaint(text)        → category_id  ★ (다음 단계 필수)
   │      ├─ check_urgency(text)             → is_urgent
   │      ├─ match_or_create_cluster(text)   → cluster_id + urgency_bonus
   │      ├─ search_laws(text)               → 관련 법령 (cat 필터 옵션)
   │      └─ search_cases(text)              → 유사 사례
   │
   │  ─── [2단계] classify 결과 도착 후 ───
   │      ├─ lookup_dept_by_category(category_id) → 매핑된 부서들 priority 순
   │      └─ search_dept(text, category_id)       → 부서 의미 검색 (카테고리 좁힘)
   │
   │  ─── [3단계] 모든 결과 합쳐서 ───
   ▼
[OpenAI gpt-4o-mini]
   │  system: "민원 챗봇. 위 정보로 친절하게 답변"
   │  context: 분류 + 긴급 + 클러스터 + 법령 + 사례 + 부서
   │  ↓
   │  자연어 답변 생성
   ▼
[백엔드]
   │  (정식 민원 접수면) DB 저장:
   │    ├─ complaints (category_id, dept_id, cluster_id,
   │    │              urgency_score = base + cluster.urgency_bonus)
   │    ├─ complaint_responses (LLM 답변 + referenced_docs)
   │    ├─ complaint_status_history ('received')
   │    └─ notifications (사용자 알림)
   ▼
[사용자에게 응답]
   "교통 카테고리 민원입니다. 도로교통법 제35조에 따라
    교통행정과(061-286-7450)에 신고 가능합니다.
    같은 민원 327건 접수돼 우선 처리 중입니다."
```

## 핵심 의존 관계

- **`category_id` 결정 필수** → `lookup_dept_by_category`, `search_dept`는 직렬 의존
- 그 외 도구(긴급/클러스터/법령/사례)는 카테고리 무관, 1단계 병렬 가능
- 챗봇 질의(/chat/ask) — 답변만, DB 저장 X
- 정식 민원(/complaints) — DB 저장 + 알림 발동

## 모델/데이터 스택

| 컴포넌트 | 모델/기술 | 위치 |
|---|---|---|
| 분류기 | KLUE BERT base 파인튜닝 (11클래스, F1 0.873) | `models/bert-v9/final/` |
| 긴급 분류 | KLUE BERT base 파인튜닝 (이진, F1 0.93) | `models/urgency-bert/final/` |
| 문장 임베딩 | `BM-K/KoSimCSE-roberta` (768d, 사전학습 그대로) | HuggingFace 자동 다운로드 |
| 벡터 검색 | PostgreSQL + **pgvector** 0.7.0 | DB `rag_documents.embedding` |
| 분류 라벨 | DB `categories` (id 1~11) | PostgreSQL |
| 긴급 키워드 | DB `urgency_keywords` (29개, weight 포함) | PostgreSQL |

## RAG 콘텐츠

| source_type | 건수 | 출처 |
|---|---:|---|
| `law` | 5,441 조항 | 26개 핵심 법령 (도로교통법, 건축법, 세무법, 민원처리법 등) |
| `case` | ~25,000 (적재 예정) | 국민신문고(epeople) 유사 사례 + 공식 답변 |
| `dept` | 39 | 전남도청 부서 description |

모두 `rag_documents` 한 테이블에 통합. KoSimCSE 768차원 임베딩으로 cosine 유사도 검색.

## 분류기 카테고리

| ID | 카테고리 | F1 | 주요 부서 |
|---:|---|---:|---|
| 1 | 교통 | 0.882 | 교통행정과, 도로정책과 |
| 2 | 건축 | 0.755 | 건축개발과, 토지관리과 |
| 3 | 행정 | 0.812 | 자치행정과, 총무과 |
| 4 | 보건위생 | 0.911 | 식품의약과, 감염병관리과 |
| 5 | 환경 | 0.874 | 환경정책과, 기후대기과 |
| 6 | 문화_여가 | 0.825 | 관광과, 스포츠산업과 |
| 7 | 농축산 | 0.909 | 농업정책과, 축산정책과 |
| 8 | 복지 | 0.866 | 사회복지과, 노인복지과, 장애인복지과 |
| 9 | 세무 | 0.974 | 세정과 |
| 10 | 상하수도 | 0.921 | 수자원관리과, 환경정책과 |
| 11 | 경제 | 0.874 | 기반산업과 |

교육(학교/저작권/입시) 카테고리는 별도 미운영. 필요 시 향후 추가.

## 책임 경계

```
┌─────────────────────────────────────────────────────────┐
│                    AI 영역 (이 패키지)                   │
├─────────────────────────────────────────────────────────┤
│ • chatbot_service.py  ← 백엔드가 import                  │
│ • mcp_server.py       ← Claude Desktop용                │
│ • classifier.py       ← 분류기 wrapper                  │
│ • models/             ← BERT 모델 weight                │
│ • scripts/            ← 학습/적재 재현용                 │
│ • db/schema.sql       ← DB DDL + 시드                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  백엔드 영역 (별도 팀)                   │
├─────────────────────────────────────────────────────────┤
│ • FastAPI 라우터                                        │
│ • 병렬 에이전트 오케스트레이션 (asyncio.gather)          │
│ • OpenAI 호출                                           │
│ • DB CRUD (complaints, responses, notifications)        │
│ • 인증 (users, JWT)                                     │
│ • 파일 업로드/다운로드                                   │
│ • 알림 발송                                              │
└─────────────────────────────────────────────────────────┘
```

## MCP vs 백엔드 import

- **실 운영 트래픽**: 백엔드 → `chatbot_service` 직접 import
- **개발/디버깅**: Claude Desktop → MCP 서버 → 같은 `chatbot_service` 함수 호출

같은 비즈니스 로직을 두 가지 진입점으로 노출. 일관성 보장.

## 분류기 학습 데이터

- **AI Hub 143번 민원 데이터** 86만 건 → 18 카테고리를 11로 매핑 (build_labels.py)
- group_id 단위 8:1:1 분할 + 카테고리당 train 20k cap (split_and_sample.py)
- KLUE BERT base, max_len 128, batch 32, epoch 3, lr 2e-5, fp16 (train_classifier.py)
- 학습 시간 약 40~60분 (RTX 4060 Ti)

상세 재현 절차는 `scripts/` 참조.
