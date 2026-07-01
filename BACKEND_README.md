# MindE — Backend + AI 통합 패키지

마음결 민원 챗봇.
AI 비즈니스 로직(분류/긴급/RAG/클러스터/멀티모달/답변 LLM)과 백엔드 API(인증/CRUD/알림)를 한 폴더에 통합.

## 폴더 구조

```
backend-ai/
├── main.py                # FastAPI 엔트리
├── chatbot_service.py     # AI 통합 모듈 ⭐
├── classifier.py          # 분류기 wrapper (chatbot_service가 import)
│
├── auth.py                # JWT 인증
├── database.py            # SQLAlchemy async 엔진
├── models.py              # ORM
├── schemas.py             # Pydantic
│
├── routers/               # API 엔드포인트
│   ├── users.py           # 회원가입/로그인
│   ├── complaints.py      # 민원 CRUD (자동 분류/부서/자동응답)
│   ├── chat.py            # 챗봇 (텍스트/음성/이미지 + history)
│   ├── attachments.py     # 첨부 파일
│   ├── admin.py
│   └── notifications.py
│
├── scripts/
│   └── make_admin.py      # 첫 관리자 계정 생성 일회용
│
├── models/                # KoBERT 모델 가중치 (self-contained)
│   ├── bert-v9/final/         # 분류기 (atti433/minde-classifier)
│   └── urgency-bert/final/    # 긴급 분류기 (atti433/minde-urgency)
│
├── requirements.txt
├── .env                   # 시크릿 (gitignore)
└── .gitignore
```

**Self-contained**: 모델 가중치도 폴더 내부에 포함. 별도 다운로드 불필요. 폴더 통째로 옮기면 어디서든 동작.

## 빠른 시작

```bash
# 의존성 설치 (이미 있으면 skip)
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -m pip install -r requirements.txt

# 실행
cd "C:/Users/smhrd/Desktop/backend-ai"
"C:/Users/smhrd/AppData/Local/Programs/Python/Python311/python.exe" -m uvicorn main:app --reload

# 브라우저
# http://localhost:8000/docs
```

## 주요 엔드포인트

| Method | Path | 동작 |
|---|---|---|
| POST | `/users` | 회원가입 |
| POST | `/users/login` | 로그인 (JWT 발급) |
| POST | `/complaints` | 민원 접수 — 자동 분류/부서/긴급도/클러스터/자동응답 |
| POST | `/chat/ask` | 텍스트 챗봇 (멀티턴, history 자동) |
| POST | `/chat/voice` | 음성 → CLOVA CSR → 챗봇 |
| POST | `/chat/image` | 이미지 → gpt-4o Vision → 챗봇 |
| POST | `/chat/voice-reply` | 답변 → CLOVA Voice mp3 (NCP Voice Premium 활성화 필요) |
| DELETE | `/chat/reset` | 사용자 history 초기화 |
| PATCH | `/complaints/{id}/status` | 상태 변경 + 알림 |

## 환경변수 (.env)

| 키 | 설명 |
|---|---|
| `DB_*` | 백엔드 자체 SQLAlchemy 연결 |
| `PG_*` | chatbot_service의 psycopg2 연결 (같은 DB, 변수명만 다름) |
| `JWT_SECRET_KEY` | JWT 서명 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | 답변·이미지 분석 LLM |
| `NAVER_CLOVA_CLIENT_ID/SECRET` | STT(CSR) / TTS(Voice Premium) |
| `CLASSIFIER_DIR`, `URGENCY_DIR` | (선택) 모델 경로 오버라이드. 기본값이 `./models/bert-v9/final` 이라 지정 안 해도 동작 |
| `NCP_*` | (선택) Object Storage — 첨부 파일용 |

## AI 모듈 동기화

`chatbot_service.py` / `classifier.py`는 ai 브랜치 원본을 복사한 것.
ai 브랜치에서 갱신되면 두 파일을 다시 복사해 동기화한다.

```bash
cp "../실전 프로젝트/chatbot_service.py" .
cp "../실전 프로젝트/classifier.py" .
```
