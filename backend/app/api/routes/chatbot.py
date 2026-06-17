# chatbot.py
# 챗봇 관련 API 라우트입니다.
# TODO: RAG 기반 챗봇 응답 엔드포인트 구현

from fastapi import APIRouter

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.get("/ping")
def ping():
    """챗봇 라우터 동작 확인용"""
    return {"message": "chatbot router ready"}
