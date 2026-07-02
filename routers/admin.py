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
from routers.users import build_user_out

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
    users = result.scalars().all()
    return [await build_user_out(db, u) for u in users]


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
    return await build_user_out(db, user)


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
    users = result.scalars().all()
    return [await build_user_out(db, u) for u in users]


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
    return await build_user_out(db, user)


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


# ---------- 부서 관리 ----------
@router.get("/departments", response_model=list[schemas.DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """부서 목록 (staff/admin이면 드롭다운용으로 조회)."""
    result = await db.execute(
        select(models.Department).order_by(models.Department.department_id.asc())
    )
    return result.scalars().all()


@router.post("/departments", response_model=schemas.DepartmentOut, status_code=201)
async def create_department(
    payload: schemas.DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    dept = models.Department(name=payload.name)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.patch("/departments/{department_id}", response_model=schemas.DepartmentOut)
async def update_department(
    department_id: int,
    payload: schemas.DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    dept = await db.get(models.Department, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    dept.name = payload.name
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/departments/{department_id}", status_code=204)
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    dept = await db.get(models.Department, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    await db.delete(dept)
    await db.commit()
    return


# ---------- 카테고리 관리 ----------
@router.get("/categories", response_model=list[schemas.CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    result = await db.execute(
        select(models.Category).order_by(models.Category.category_id.asc())
    )
    return result.scalars().all()


@router.post("/categories", response_model=schemas.CategoryOut, status_code=201)
async def create_category(
    payload: schemas.CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    cat = models.Category(name=payload.name)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/categories/{category_id}", response_model=schemas.CategoryOut)
async def update_category(
    category_id: int,
    payload: schemas.CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    cat = await db.get(models.Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    cat.name = payload.name
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    cat = await db.get(models.Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    await db.delete(cat)
    await db.commit()
    return


# ---------- 관리자 회원 강제 탈퇴 ----------
@router.delete("/users/{user_id}", status_code=204)
async def force_delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    user = await db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.user_id == current_admin.user_id:
        raise HTTPException(status_code=400, detail="본인 계정은 삭제할 수 없습니다.")
    await db.delete(user)
    await db.commit()
    return
