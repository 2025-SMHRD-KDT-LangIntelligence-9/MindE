# MindE (마음결) — AI 에이전트 기반 지능형 민원 상담 플랫폼

공공 민원을 대화 한 번으로. AI 에이전트 병렬 처리로 민원을 자동 분류하고,
담당 부서·법령·유사 사례를 찾아 안내하며, 음성·이미지 입력과 대화 기반
서식 자동 작성까지 지원하는 플랫폼입니다.

## 저장소 구조 (모노레포)

```
.
└── backend/    FastAPI + AI (분류·긴급·RAG·클러스터·멀티모달·답변 LLM, 서식 자동작성)
```

- **backend/** — Python 3.11, FastAPI, PostgreSQL + pgvector. 실행/구조는 `backend/README.md`·`backend/BACKEND_README.md` 참고.
- **frontend/** — React + Vite. 현재는 `frontend` 브랜치에 있으며 추후 이 저장소로 통합 예정.

## 핵심 기능
AI 자동 분류(11종) · RAG 근거 답변 · 멀티모달(음성·이미지) · 대화 기반 서식 자동 작성 ·
긴급 민원 우선 대응 · AI 에이전트 병렬 처리
