# dashboard.py
# 통계/대시보드 데이터를 제공하는 API 라우트입니다.
# TODO: 민원 통계, 반복 민원, 위험도 분석 데이터 제공 엔드포인트 구현

from fastapi import APIRouter

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/ping")
def ping():
    """대시보드 라우터 동작 확인용"""
    return {"message": "dashboard router ready"}
