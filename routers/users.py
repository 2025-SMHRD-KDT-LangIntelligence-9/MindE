"""
회원 관련 엔드포인트.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from database import get_db
from auth import create_access_token, get_current_user
import models
import schemas

router = APIRouter(prefix="/users", tags=["users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def build_user_out(db: AsyncSession, user: models.User) -> dict:
    """UserOut 응답 dict — department_name / created_at 채워서 반환.

    admin/users.py 라우터에서도 재사용.
    """
    dept_name = None
    if user.department_id:
        dept = await db.get(models.Department, user.department_id)
        dept_name = dept.name if dept else None
    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "user_type": user.user_type,
        "phone": user.phone,
        "department_id": user.department_id,
        "department_name": dept_name,
        "created_at": user.created_at,
    }


@router.post("", response_model=schemas.UserOut, status_code=201)
async def signup(payload: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(
        select(models.User).where(models.User.email == payload.email)
    )
    if exists:
        raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
    user_type = "pending_staff" if payload.apply_as_staff else "citizen"
    user = models.User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=pwd_context.hash(payload.password),
        user_type=user_type,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await build_user_out(db, user)


@router.post("/login", response_model=schemas.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(
        select(models.User).where(models.User.email == form_data.username)
    )
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.user_type == "pending_staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="담당자 승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다.",
        )
    token = create_access_token(user.user_id)
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
async def read_me(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return await build_user_out(db, current_user)


@router.patch("/me", response_model=schemas.UserOut)
async def update_me(
    payload: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """프로필 수정. 현재 비밀번호 검증 필수."""
    if not pwd_context.verify(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 올바르지 않습니다.")

    if payload.email and payload.email != current_user.email:
        dup = await db.scalar(
            select(models.User).where(models.User.email == payload.email)
        )
        if dup:
            raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")
        current_user.email = payload.email
    if payload.name is not None:
        current_user.name = payload.name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.password:
        current_user.password_hash = pwd_context.hash(payload.password)

    await db.commit()
    await db.refresh(current_user)
    return await build_user_out(db, current_user)


@router.delete("/me", status_code=204)
async def delete_me(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """회원 탈퇴."""
    await db.delete(current_user)
    await db.commit()
    return


@router.patch("/me/notifications", response_model=schemas.UserOut)
async def update_my_notifications(
    payload: schemas.NotificationEnabledUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """알림 수신 설정 저장."""
    current_user.notification_enabled = payload.notification_enabled
    await db.commit()
    await db.refresh(current_user)
    return await build_user_out(db, current_user)
