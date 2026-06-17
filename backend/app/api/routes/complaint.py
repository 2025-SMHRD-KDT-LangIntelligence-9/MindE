# complaint.py
# 민원 등록/조회/처리 관련 API 라우트입니다.
# TODO: 민원 생성(POST), 목록 조회(GET), 상세 조회, 상태 변경 엔드포인트 구현

from fastapi import APIRouter

router = APIRouter(prefix="/complaint", tags=["complaint"])


@router.get("/ping")
def ping():
    """민원 라우터 동작 확인용"""
    return {"message": "complaint router ready"}
