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
