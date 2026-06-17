# 마음결 (maeumgyeol)

AI 에이전트 기반 지능형 민원 상담 플랫폼

> 이 README는 프로젝트 초기 스켈레톤 단계입니다. 각 기능은 이후 단계별로 구현됩니다.

## 폴더 구조

- `frontend/` - React 기반 사용자 화면
- `backend/` - FastAPI 기반 API 서버
- `ai/` - KoBERT 분류기, RAG, 멀티 에이전트, 멀티모달(OCR/STT/TTS) 모듈
- `database/` - DB 스키마 및 마이그레이션
- `data/` - 민원/문서/임베딩/OCR/음성 데이터 저장소
- `dashboards/` - 통계 및 분석 대시보드 스크립트
- `docs/` - 아키텍처, API 명세, ERD, 프롬프트 가이드 문서
- `tests/` - 백엔드/AI 테스트 코드
- `docker/` - 서비스별 Dockerfile

## 시작하기 (TODO)

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker로 전체 실행
```bash
docker-compose up --build
```

## TODO
- [ ] 백엔드 라우터별 실제 로직 구현
- [ ] AI 분류/RAG/에이전트 파이프라인 구현
- [ ] 프론트엔드 페이지/컴포넌트 구현
- [ ] DB 마이그레이션 및 시드 데이터 작성
