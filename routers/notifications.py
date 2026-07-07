"""
알림 관련 엔드포인트.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
async def list_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == current_user.user_id)
        .order_by(models.Notification.sent_at.desc())
    )
    return result.scalars().all()


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """내 알림 전체 읽음 처리."""
    result = await db.execute(
        update(models.Notification)
        .where(
            models.Notification.user_id == current_user.user_id,
            models.Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"updated": result.rowcount}


@router.patch("/{notification_id}/read", response_model=schemas.NotificationOut)
async def mark_one_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """단건 알림 읽음 처리. 남의 알림은 404 (존재 자체 노출 안 함)."""
    notif = await db.get(models.Notification, notification_id)
    if not notif or notif.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    if not notif.is_read:
        notif.is_read = True
        await db.commit()
        await db.refresh(notif)
    return notif
