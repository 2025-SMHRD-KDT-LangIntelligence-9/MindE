"""
관리자(admin) 전용 엔드포인트.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_admin, get_current_staff
import models
import schemas
from routers.complaints import build_complaint_out

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/pending-staff", response_model=list[schemas.UserOut])
async def list_pending_staff(
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    result = await db.execute(
        select(models.User)
        .where(models.User.user_type == "pending_staff")
        .order_by(models.User.created_at.asc())
    )
    return result.scalars().all()


@router.post("/approve-staff/{user_id}", response_model=schemas.UserOut)
async def approve_staff(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    user = await db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.user_type != "pending_staff":
        raise HTTPException(
            status_code=400,
            detail=f"승인 대기 중인 사용자가 아닙니다. (현재 상태: {user.user_type})",
        )
    user.user_type = "staff"
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/reject-staff/{user_id}", status_code=204)
async def reject_staff(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """담당자 가입 거절 (계정 삭제)."""
    user = await db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.user_type != "pending_staff":
        raise HTTPException(
            status_code=400,
            detail=f"승인 대기 중인 사용자가 아닙니다. (현재 상태: {user.user_type})",
        )
    await db.delete(user)
    await db.commit()
    return


@router.get("/users", response_model=list[schemas.UserOut])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """전체 사용자 목록."""
    result = await db.execute(
        select(models.User).order_by(models.User.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/users/{user_id}/department", response_model=schemas.UserOut)
async def update_user_department(
    user_id: int,
    payload: schemas.UserDepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """담당자 부서 변경."""
    user = await db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if payload.department_id is not None:
        dept = await db.get(models.Department, payload.department_id)
        if not dept:
            raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    user.department_id = payload.department_id
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/complaints", response_model=list[schemas.ComplaintOut])
async def list_all_complaints(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """전체 민원 조회 (staff/admin)."""
    result = await db.execute(
        select(models.Complaint).order_by(models.Complaint.created_at.desc())
    )
    rows = result.scalars().all()
    return [await build_complaint_out(db, c) for c in rows]
