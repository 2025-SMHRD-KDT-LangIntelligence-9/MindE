"""
앱 진입점. 실행:  uvicorn main:app --reload
문서 확인:  http://localhost:8000/docs

AI 비즈니스 로직은 ai 브랜치의 chatbot_service 모듈에 통합되어 있다.
백엔드는 한 줄 import로 모든 AI 기능(분류/긴급/RAG/클러스터/멀티모달/답변 LLM)을 사용.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager

from database import get_db
from routers import users, complaints, attachments, admin, notifications, chat
import chatbot_service as svc


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
