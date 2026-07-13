"""
공개 엔드포인트 (인증 없이 접근 가능).

랜딩 페이지, 회원가입 등에서 사용.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
import models
import schemas

router = APIRouter(tags=["public"])


@router.get("/departments", response_model=list[schemas.DepartmentOut])
async def list_departments_public(db: AsyncSession = Depends(get_db)):
    """부서 목록 (인증 X) — 회원가입 시 담당자 부서 선택 드롭다운용."""
    result = await db.execute(
        select(models.Department).order_by(models.Department.department_id.asc())
    )
    return result.scalars().all()


@router.get("/stats/public")
async def stats_public(db: AsyncSession = Depends(get_db)):
    """랜딩/로그인/회원가입 페이지에 표시할 요약 통계 (인증 X).

    반환:
        total     — 전체 접수 민원 수
        resolved  — 처리 완료(status='answered' 또는 'closed') 민원 수
    """
    C = models.Complaint
    total_r = await db.execute(select(func.count()).select_from(C))
    resolved_r = await db.execute(
        select(func.count()).select_from(C).where(C.status.in_(["answered", "closed"]))
    )
    return {
        "total": int(total_r.scalar() or 0),
        "resolved": int(resolved_r.scalar() or 0),
    }
