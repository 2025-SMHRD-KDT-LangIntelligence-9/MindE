# MindE (마음결) — AI 에이전트 기반 지능형 민원 상담 플랫폼

> **민원, 마음을 읽다.**
> 복잡한 행정을 대화 한 번으로. 디지털이 익숙지 않은 시민도 쉽게 민원을 넣고,
> 공공기관의 반복 민원 부담은 자동으로 더는 AI 민원 상담 플랫폼입니다.

---

## 📌 프로젝트 배경

전자민원(정부24·국민신문고) 이용은 8년 만에 약 3배로 늘었지만, **사용성은 그만큼 따라오지 못하고 있습니다.**
- 신청 여부 확인이 어렵다 **47%**, 과도한 정보 요구 **44%**, 서류 안내 부족 **36%** *(2025 전자정부서비스 이용실태조사)*
- 한편 공공기관은 악성민원 중 **상습·반복 민원이 48%**로 담당자 부담이 큼 *(국민권익위 실태조사)*

**시민의 불편**과 **공공기관의 부담**을 동시에 해결하는 것이 이 프로젝트의 출발점입니다.

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| **AI 자동 분류** | 한국어 특화 BERT로 민원을 11종 카테고리로 자동 분류 (test F1 **0.896**) |
| **RAG 근거 답변** | 법령·사례·절차 문서를 벡터 검색해 근거 있는 맞춤 답변 생성 |
| **멀티모달 입력** | 텍스트 외 음성(STT)·이미지(Vision) 입력 지원 — 디지털 취약계층 접근성 |
| **대화 기반 서식 자동 작성** | 대화 내용을 실제 민원 서식(PDF)에 자동으로 채워 제출까지 지원 |
| **긴급 민원 우선 대응** | 긴급 전용 BERT(F1 0.93) + 키워드로 위험 민원 자동 감지·우선 처리 |
| **AI 에이전트 병렬 처리** | 분류·검색·긴급도·부서 연계를 순차가 아닌 **동시**에 수행 (핵심 구조) |

### 차별점
- **AI 에이전트 병렬 처리** — 여러 전문 AI가 민원을 동시에 분석해 대기 시간 단축
- **대화 기반 문서 자동 작성** — "대화가 곧 서류가 되는" 원스톱 서식 지원 (기존 전자민원엔 거의 없음)

## 🛠 기술 스택

**Backend / AI**
- Python 3.11, **FastAPI**, JWT 인증
- **PostgreSQL + pgvector** (벡터 검색), SQLAlchemy(async·asyncpg) + psycopg2
- **OpenAI gpt-4o** — 게이트·질의 분해·키워드·답변 LLM, 이미지 분석(Vision)
- **KLUE-BERT 파인튜닝** — 민원 분류(11종)·긴급 분류(이진)
- **KoSimCSE-roberta** (768d) — 문장 임베딩, RAG
- **PyMuPDF / pdfplumber** — 서식 PDF 렌더·파싱
- **NAVER CLOVA**(STT) · **ElevenLabs**(TTS)

**Frontend**
- **React + Vite**, 사용자·담당자·관리자 3역할 화면

## 🧭 아키텍처 (answer_chatbot 파이프라인)

```
[사용자] 텍스트·음성·이미지
   ↓
[게이트 LLM]  잡담 → 즉답 / 민원 → 계속
   ↓
[질의 분해]  복합 민원을 서브 민원으로 분리
   ↓
[서브 민원별 병렬 처리 (asyncio.gather)]
   ├─ 분류(top-3)  ├─ 긴급도  ├─ 법령·사례·절차 검색
   ├─ 서식 매칭    └─ 담당 부서 연계
   ↓
[답변 LLM]  근거·부서·서식 안내를 종합한 자연어 답변
```

- **RAG**: `rag_documents` 단일 테이블에 법령·사례·부서·절차·접수민원 약 **8만 9천 건** 벡터화 (pgvector 768d, cosine)
- **분류 카테고리(11종)**: 교통·건축·행정·보건위생·환경·문화_여가·농축산·복지·세무·상하수도·경제

## 📂 저장소 구조 (모노레포)

```
.
├── backend/    FastAPI + AI (분류·긴급·RAG·클러스터·멀티모달·답변 LLM·서식 자동작성)
│   ├── main.py              앱 엔트리 (라우터 등록, 모델 프리로드)
│   ├── chatbot_service.py   AI 통합 모듈
│   ├── routers/             users·complaints·chat·forms·admin·attachments·notifications·public
│   ├── docs/                아키텍처·API 명세
│   └── scripts/             학습·라벨링·RAG 적재·마이그레이션
└── frontend/   React + Vite (사용자·담당자·관리자 화면)
    └── src/                 pages·components·api·store
```

## 🚀 실행 방법

### Backend (Python 3.11)
```bash
cd backend
python -m pip install -r requirements.txt
# .env 설정 (.env.example 참고: DB, OPENAI_API_KEY, HF_TOKEN 등)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# API 문서: http://localhost:8000/docs
```

### Frontend (Node)
```bash
cd frontend
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
```

## 👥 팀 마음결

| 이름 | 역할 |
|---|---|
| **이현도** | 총괄 기획 · AI 개발 |
| **김민찬** | 프론트엔드 |
| **김재원** | UI/UX · 기능 연동 |
| **윤지은** | 백엔드 |
| **이유라** | 기술 문서 · 테스트 |

---

<sub>더 자세한 백엔드 문서는 <a href="backend/README.md">backend/README.md</a> · <a href="backend/BACKEND_README.md">backend/BACKEND_README.md</a> · <a href="backend/docs/architecture.md">backend/docs/architecture.md</a> 참고.</sub>
