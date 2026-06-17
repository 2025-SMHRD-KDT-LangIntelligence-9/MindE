# voice.py
# 음성 입력(STT)/음성 출력(TTS) 관련 API 라우트입니다.
# TODO: 음성 파일 업로드 -> STT 변환, 텍스트 -> TTS 음성 생성 엔드포인트 구현

from fastapi import APIRouter

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/ping")
def ping():
    """음성 라우터 동작 확인용"""
    return {"message": "voice router ready"}
