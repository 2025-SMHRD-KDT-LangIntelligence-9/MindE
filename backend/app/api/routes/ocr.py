# ocr.py
# 이미지/문서에서 텍스트를 추출하는 OCR 관련 API 라우트입니다.
# TODO: 이미지 업로드 -> OCR 처리 -> 텍스트 반환 엔드포인트 구현

from fastapi import APIRouter

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.get("/ping")
def ping():
    """OCR 라우터 동작 확인용"""
    return {"message": "ocr router ready"}
