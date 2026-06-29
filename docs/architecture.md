# 마음이 민원 챗봇 — AI 시스템 아키텍처

## 전체 흐름

```
[사용자]
   │  "도로 포트홀 신고하고 싶어요" (+ 백엔드가 누적해온 history)
   ▼
[프론트엔드]
   │  POST /complaints  (또는 /chat/ask)
   ▼
[백엔드 FastAPI]
   │  session_id별 history 보관 → answer_chatbot(text, history) 한 줄 호출
   │
   ▼
[chatbot_service.answer_chatbot]
   │
   │  ─── [0단계] 게이트 LLM (gpt-4o) ───
   │      입력: GATE_PROMPT + history + 현재 text
   │      잡담이면 → 즉답 반환 (tool_used=False, 도구 호출 0회)
   │      민원이면 → "[TOOL]" 신호, 아래 단계 진행
   │
   │  ─── [tool_query 생성] history 직전 user 발언 2개 + 현재 text 합침 ───
   │      → 후속 질문에서 컨텍스트 유지 (A안)
   │
   │  ─── [1단계] 5개 도구 병렬 (asyncio.gather) ───
   │      ├─ classify_complaint(tool_query, top_k=3) → top-3 카테고리
   │      ├─ check_urgency(tool_query)               → is_urgent
   │      ├─ search_laws(tool_query)                 → 관련 법령
   │      ├─ search_cases(tool_query)                → 유사 사례
   │      └─ extract_keywords(tool_query)            → 키워드 (LLM)
   │      그 후: match_or_create_cluster(tool_query, keywords)
   │
   │  ─── [2단계] top-3 카테고리 부서 병렬 조회 ───
   │      ├─ lookup_dept_by_category × 3 (top-3 각각)
   │      │   → classification.top_k 각 후보에 departments 동봉
   │      └─ search_dept(tool_query, top-1 cat_id)
   │
   │  ─── [3단계] 답변 LLM (gpt-4o) ───
   ▼
[OpenAI gpt-4o]
   │  system: SYSTEM_PROMPT (top-3 중 의미 보고 카테고리 선택 + 공공 채널 안내 허용)
   │  messages: system + history(최근 5턴) + (context+질문)
   │  ↓
   │  자연어 답변 (LLM이 분류기 헛바람 보정 — top-2/3 채택 가능)
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

- **0단계 게이트** 통과해야 1단계 이후 실행. 잡담은 0단계에서 즉시 종료.
- **`category_id` 결정 필수** → `lookup_dept_by_category`, `search_dept`는 직렬 의존
- 그 외 도구(긴급/클러스터/법령/사례)는 카테고리 무관, 1단계 병렬 가능
- 챗봇 질의(/chat/ask) — 답변만, DB 저장 X
- 정식 민원(/complaints) — DB 저장 + 알림 발동
- **멀티턴**: history는 백엔드가 session_id별 보관. AI 모듈은 stateless.

## 멀티모달 입력 통합

```
[사용자]
   ├─ 텍스트 입력
   │     ↓
   ├─ 음성 입력 → transcribe_audio() ── (CLOVA CSR) ──┐
   │                                                    │
   └─ 이미지 입력 → analyze_image() ── (gpt-4o Vision) ──┤
                                                          ↓
                                              [텍스트로 통일]
                                                          ↓
                                              answer_chatbot(text, history)
                                                          ↓
                                              [답변 텍스트]
                                                          ↓
                              (선택) synthesize_speech() → (CLOVA Voice) → 음성 mp3
                                                          ↓
                                              사용자에게 응답
```

- 음성/이미지를 텍스트로 변환한 후 기존 `answer_chatbot` 흐름에 그대로 태움 → 분류/검색/답변 흐름 변경 0
- 각 변환 함수는 stateless. 백엔드가 호출 순서 결정.

## LLM 호출 위치 (총 최대 3회 + 멀티모달 0~2회)

| 단계 | 호출 | history 받음? | 비고 |
|---|---|---|---|
| 0 (게이트) | gpt-4o | ✅ | 잡담/민원 1차 판정 |
| 1 (extract_keywords) | gpt-4o | ❌ | tool_query 받음, 키워드 추출 |
| 3 (답변 LLM) | gpt-4o | ✅ | 최종 답변 생성 |

잡담이면 0단계만 호출 → 1회.
민원이면 0+1+3 → 3회.

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
