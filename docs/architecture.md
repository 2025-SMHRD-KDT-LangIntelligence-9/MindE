# 마음이 민원 챗봇 — AI 시스템 아키텍처

## 전체 흐름

```
사용자 (웹/앱)
  │
  ▼
백엔드 (FastAPI 등)
  │
  ├── 1) chatbot_service 병렬 호출
  │     ├── classify_complaint  (BERT v9, 11카테고리)
  │     ├── check_urgency       (BERT 이진, F1 0.93)
  │     ├── search_laws         (벡터 검색, 5,441 조항)
  │     ├── search_cases        (벡터 검색, 사례 + 답변)
  │     ├── search_faq          (벡터 검색, 교육 FAQ)
  │     └── lookup_dept_by_category (DB)
  │
  ├── 2) 결과 컨텍스트화 → OpenAI 호출
  │     "민원 내용 + 분류 결과 + 긴급 여부 + 법령/사례 + 부서"
  │
  ├── 3) DB 저장
  │     ├── complaints (민원 본체)
  │     ├── complaint_responses (LLM 답변)
  │     └── complaint_status_history (접수)
  │
  └── 4) 사용자에게 응답 + 알림 (notifications)
```

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
| `case` | ~21,000 (적재 예정) | 국민신문고(epeople) 유사 사례 + 공식 답변 |
| `faq` | 416 (적재 예정) | 교육부 FAQ |

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

교육(학교/저작권/입시)은 분류기 외부. 분류기 confidence 낮고 `search_faq` 결과가 강하면 라우팅.

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
