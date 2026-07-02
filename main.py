"""
앱 진입점. 실행:  uvicorn main:app --reload
문서 확인:  http://localhost:8000/docs

AI 비즈니스 로직은 ai 브랜치의 chatbot_service 모듈에 통합되어 있다.
백엔드는 한 줄 import로 모든 AI 기능(분류/긴급/RAG/클러스터/멀티모달/답변 LLM)을 사용.
"""
import os
import time

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager

from database import get_db
from routers import users, complaints, attachments, admin, notifications, chat
import chatbot_service as svc


SERVER_START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시: 분류기/긴급/임베딩 모델을 한꺼번에 미리 로드
    # (chatbot_service 내부 싱글톤 캐시 — 첫 요청 race condition + 지연 제거)
    svc.preload_models()
    yield


app = FastAPI(title="MindE API", version="0.2.0", lifespan=lifespan)

# React(프론트엔드)에서 호출할 수 있도록 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # "*" + True 조합은 브라우저가 거부. JWT는 Authorization 헤더로 문제 없음
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(users.router)
app.include_router(complaints.router)
app.include_router(attachments.router)
app.include_router(attachments.attachment_router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"service": "MindE API", "status": "ok"}


@app.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"db": "connected"}


@app.get("/health")
async def health_full(db: AsyncSession = Depends(get_db)):
    """전체 의존성 상태 확인 (외부 모니터/알람에서 폴링).

    반환: 각 항목 true/false + 전체 status.
    status="ok"     — 다 정상
    status="degraded" — 일부 기능 불가 (예: TTS 안 되지만 챗봇은 됨)
    status="down"   — 챗봇 기능 자체 불가 (DB or 모델 문제)
    """
    checks = {}
    errors = []

    # 1. DB
    try:
        await db.execute(text("SELECT 1"))
        checks["db"] = True
    except Exception as e:
        checks["db"] = False
        errors.append(f"db: {type(e).__name__}")

    # 2. 모델 preload 여부 (싱글톤 캐시 확인)
    checks["classifier_loaded"] = svc._classifier is not None
    checks["urgency_loaded"] = svc._urgency is not None
    checks["embed_loaded"] = svc._embed_model is not None

    # 3. 필수 환경변수 (호출 안 하고 존재 여부만)
    checks["openai_key"] = bool(os.environ.get("OPENAI_API_KEY"))
    checks["hf_token"] = bool(os.environ.get("HF_TOKEN"))
    checks["elevenlabs_key"] = bool(os.environ.get("ELEVENLABS_API_KEY"))
    checks["clova_stt_key"] = bool(
        os.environ.get("NAVER_CLOVA_CLIENT_ID")
        and os.environ.get("NAVER_CLOVA_CLIENT_SECRET")
    )

    # 4. 종합 status 판단
    core_ok = checks["db"] and checks["classifier_loaded"] and checks["openai_key"]
    optional_all = (
        checks["elevenlabs_key"]
        and checks["clova_stt_key"]
        and checks["urgency_loaded"]
        and checks["embed_loaded"]
    )
    if core_ok and optional_all:
        status = "ok"
    elif core_ok:
        status = "degraded"   # 챗봇은 되지만 일부 기능 불가
    else:
        status = "down"       # 챗봇 자체 불가

    return {
        "status": status,
        "uptime_seconds": int(time.time() - SERVER_START_TIME),
        "checks": checks,
        "errors": errors,
    }
