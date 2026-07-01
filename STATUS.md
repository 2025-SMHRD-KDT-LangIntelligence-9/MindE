# 진행 상황 (Resume용)

마지막 업데이트: 2026-07-01 (v10-relabel + HF 자동 다운로드 + Query Decomposition)

## ✅ 완료된 작업

### 모델 (HuggingFace private)
- `atti433/minde-classifier` — KLUE BERT 11-class, **test F1 0.896** (v10-relabel), main / tag `v10-relabel` (기본) / tag `v9-final` (롤백용)
- `atti433/minde-urgency` — KLUE BERT 이진, F1 0.93

로컬 파일 필요 없음. `chatbot_service`가 첫 호출 시 자동 다운로드. `HF_TOKEN` 환경변수 필수.

### v10-relabel 재라벨링 파이프라인
- 원본 AI Hub 143 학습 데이터 198k건 gpt-4o-mini로 재라벨링 (`train_v10.jsonl`)
- 카테고리별 stratified 7:1.5:1.5 재분할 (train 139k / val 30k / test 30k)
- KLUE BERT 재학습 → macro F1 0.873 → **0.896** (+2.3%)
- HF 저장소에 태그와 함께 업로드 (v9-final, v10-relabel)

### DB 구축 (PostgreSQL + pgvector) — 이전 그대로
- 12 테이블, 카테고리 11 / 부서 39 / 매핑 32 / urgency_keywords 29
- `rag_documents`: law 5,441 + dept 39 + case 37,909 (임베딩 완료)

### chatbot_service 함수
| 함수 | 용도 |
|---|---|
| `answer_chatbot(text, history=None)` ⭐ | 게이트 + 분해 + 도구 병렬 + 답변 LLM |
| `decompose_query(text, history)` | 복합 민원 자동 분해 (신규) |
| `transcribe_audio(audio_bytes)` | 음성→텍스트 (CLOVA CSR) |
| `synthesize_speech(text, speaker)` | 텍스트→음성 mp3 (CLOVA Voice Premium) |
| `analyze_image(image_bytes, mime_type)` | 이미지→민원 분석 텍스트 (gpt-4o Vision) |
| `classify_complaint(text, top_k)` | 11 카테고리 분류 |
| `check_urgency(text)` | 긴급 판정 + DB 키워드 |
| `search_laws / search_cases / search_dept` | pgvector 검색 |
| `lookup_dept_by_category(cat_id)` | 카테고리→부서 priority 순 |
| `match_or_create_cluster(text, keywords?)` | 클러스터 매칭 (threshold 0.70, max_kw 3) |
| `preload_models()` | 서버 startup |

### answer_chatbot 흐름 (현재)

```
0단계 게이트 LLM (gpt-4o)
  잡담이면 즉답 → 종료
  민원이면 [TOOL]
     ↓
Query Decomposition LLM (gpt-4o)
  텍스트 → sub_queries 리스트
     ↓
서브 질문별 병렬 (각 서브마다)
  ├─ classify_complaint (top_k=3, 각 후보에 departments 동봉)
  ├─ check_urgency
  ├─ search_laws / search_cases / extract_keywords
  ├─ match_or_create_cluster
  └─ lookup_dept_by_category / search_dept
     ↓
답변 LLM (gpt-4o)
  system + history + metadata (sub_queries 포함)
  → 각 서브별 부서·안내 통합 답변
```

**LLM 호출 횟수**:
- 잡담: 1회
- 단일 민원: 3회 (게이트 + 분해 + 답변) + 키워드 1회
- 복합 민원: 3~4회 + 서브당 키워드 (병렬)

### metadata 스키마

```json
{
  "tool_used": true,
  "sub_queries": [{"query": "...", "classification": {...}, "urgency": {...}, "departments": [...], ...}, ...],
  "classification": {...},   // 첫 서브 결과 (하위 호환)
  "urgency": {...},
  "cluster": {...},
  "keywords": [...],
  "laws": [...],
  "cases": [...],
  "departments": [...],
  "similar_depts": [...]
}
```

## 시스템 프롬프트 정책

- 게이트: 카테고리·후속 여부 판단
- 분해: 병렬 접속("A랑 B", "A하고 B도")이 다른 도메인이면 분리, 부수 설명은 유지
- 답변:
  - top_k 중 의미 보고 카테고리 선택 (confidence 절대 기준 X)
  - **법령 인용은 context.laws에 있는 title만** (창작 금지: "전자정부법 제14조" 같은 예시 명시)
  - 공공 채널(안전신문고/국민신문고/정부24 등)은 자유 안내
  - is_urgent=true → 첫 줄 119/112
  - cluster.complaint_count ≥ 10 → "N건 접수" 안내
  - sub_queries 2개+면 각 서브 개별 안내

## 백엔드 통합 (이전 세션에 반영됨)

- 백엔드는 `answer_chatbot(text, history)` 한 줄만 호출
- 회원가입/로그인, 민원 CRUD, 챗봇 라우터(`/chat/*`), 알림, 첨부 다 통합됨
- `bcrypt==4.0.1` (passlib 호환 필수 — 상위 버전은 깨짐)

## 발표 일정
- 2026-07-09 발표 (D-8 기준 7/1)

## 다음 세션 우선순위
1. 백엔드/프론트 담당자 인계 (HF_TOKEN, sub_queries 스키마, models 폴더 제거)
2. 발표 데모 시나리오 확정 + 정식 리허설
3. (선택) CLOVA Voice Premium 활성화 → TTS 데모
4. (선택) 카톡/SMS 알림 통합 (백엔드 영역)
5. (선택) 관리자 대시보드 통계 시각화 (백엔드+프론트 영역)

## 환경/접속
- Python 3.11: `C:\Users\smhrd\AppData\Local\Programs\Python\Python311\python.exe`
- AI 인계 폴더: `C:\Users\smhrd\Desktop\실전 프로젝트\`
- backend-ai 통합: `C:\Users\smhrd\Desktop\backend-ai\`
- DB: `project-db-campus.smhrd.com:3310/mp_24k_li9_p3_3`
- HF: `atti433/minde-classifier`, `atti433/minde-urgency` (HF_TOKEN 필요)
- GitHub: https://github.com/2025-SMHRD-KDT-LangIntelligence-9/MindE (ai 브랜치)
