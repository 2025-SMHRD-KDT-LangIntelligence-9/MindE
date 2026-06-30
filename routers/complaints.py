"""
민원 관련 엔드포인트.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, get_current_staff
import models
import schemas
import chatbot_service as svc

router = APIRouter(prefix="/complaints", tags=["complaints"])

VALID_STATUSES = {
    "received", "assigned", "in_progress", "answered",
    "closed", "rejected", "needs_more_info",
}

STATUS_LABELS = {
    "received": "접수", "assigned": "배정", "in_progress": "처리중",
    "answered": "답변완료", "closed": "종료", "rejected": "반려",
    "needs_more_info": "보완 요청",
}


async def build_complaint_out(db: AsyncSession, c: models.Complaint) -> dict:
    """ComplaintOut 응답 dict (카테고리/부서/민원인/최신답변 JOIN)."""
    category = await db.get(models.Category, c.category_id) if c.category_id else None
    dept = await db.get(models.Department, c.assigned_department_id) if c.assigned_department_id else None
    user = await db.get(models.User, c.user_id)
    reply_row = await db.execute(
        select(models.ComplaintResponse)
        .where(models.ComplaintResponse.complaint_id == c.complaint_id)
        .order_by(models.ComplaintResponse.created_at.desc())
        .limit(1)
    )
    reply = reply_row.scalar_one_or_none()
    return {
        "complaint_id": c.complaint_id,
        "user_id": c.user_id,
        "category_id": c.category_id,
        "assigned_department_id": c.assigned_department_id,
        "title": c.title,
        "content": c.content,
        "status": c.status,
        "created_at": c.created_at,
        "urgency_score": float(c.urgency_score) if c.urgency_score is not None else 0.0,
        "category": category.name if category else None,
        "department": dept.name if dept else None,
        "citizen_name": user.name if user else None,
        "updated_at": c.updated_at,
        "memo": c.memo,
        "reply": reply.content if reply else None,
        "reply_date": reply.created_at if reply else None,
    }


@router.post("", response_model=schemas.ComplaintOut, status_code=201)
async def create_complaint(
    payload: schemas.ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    text_for_ai = f"{payload.title}\n{payload.content}"
    result = await svc.answer_chatbot(text_for_ai)
    md = result["metadata"]

    if md["tool_used"]:
        category_id = md["classification"]["category_id"]
        department_id = md["departments"][0]["department_id"] if md["departments"] else None
        urgency_score = md["urgency"]["probability_urgent"] + md["cluster"]["urgency_bonus"]
        cluster_id = md["cluster"]["cluster_id"]
    else:
        category_id = department_id = cluster_id = None
        urgency_score = 0.0

    complaint = models.Complaint(
        user_id=current_user.user_id,
        title=payload.title,
        content=payload.content,
        category_id=category_id,
        assigned_department_id=department_id,
        cluster_id=cluster_id,
        urgency_score=urgency_score,
        status="received",
    )
    db.add(complaint)
    await db.flush()

    if result["answer"]:
        response = models.ComplaintResponse(
            complaint_id=complaint.complaint_id,
            content=result["answer"],
            referenced_docs={
                "laws": [
                    {"document_id": l["document_id"], "title": l["title"],
                     "similarity": l["similarity"]}
                    for l in (md.get("laws") or [])
                ],
                "cases": [
                    {"document_id": c["document_id"], "title": c["title"],
                     "similarity": c["similarity"]}
                    for c in (md.get("cases") or [])
                ],
            },
        )
        db.add(response)

    await db.commit()
    await db.refresh(complaint)
    return await build_complaint_out(db, complaint)


@router.get("", response_model=list[schemas.ComplaintOut])
async def list_my_complaints(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Complaint)
        .where(models.Complaint.user_id == current_user.user_id)
        .order_by(models.Complaint.created_at.desc())
    )
    rows = result.scalars().all()
    return [await build_complaint_out(db, c) for c in rows]


@router.get("/{complaint_id}", response_model=schemas.ComplaintOut)
async def get_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    is_owner = complaint.user_id == current_user.user_id
    is_staff = current_user.user_type in ("staff", "admin")
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="조회 권한이 없습니다.")
    return await build_complaint_out(db, complaint)


@router.patch("/{complaint_id}/status", response_model=schemas.ComplaintOut)
async def update_complaint_status(
    complaint_id: int,
    payload: schemas.ComplaintStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 상태입니다. (가능한 값: {', '.join(sorted(VALID_STATUSES))})",
        )
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    if complaint.status == payload.status:
        raise HTTPException(status_code=400, detail=f"이미 '{payload.status}' 상태입니다.")

    complaint.status = payload.status
    complaint.updated_at = datetime.utcnow()

    history = models.ComplaintStatusHistory(
        complaint_id=complaint.complaint_id,
        status=payload.status,
        changed_by=current_staff.user_id,
        note=payload.note,
    )
    db.add(history)

    label = STATUS_LABELS.get(payload.status, payload.status)
    message = f"'{complaint.title}' 민원 상태가 [{label}](으)로 변경되었습니다."
    if payload.note:
        message += f" 담당자 메모: {payload.note}"

    notification = models.Notification(
        user_id=complaint.user_id,
        complaint_id=complaint.complaint_id,
        channel="in_app",
        message=message,
        status="sent",
    )
    db.add(notification)

    await db.commit()
    await db.refresh(complaint)
    return await build_complaint_out(db, complaint)


@router.get("/{complaint_id}/history", response_model=list[schemas.ComplaintStatusHistoryOut])
async def get_complaint_history(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    is_owner = complaint.user_id == current_user.user_id
    is_staff = current_user.user_type in ("staff", "admin")
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="조회 권한이 없습니다.")
    result = await db.execute(
        select(models.ComplaintStatusHistory)
        .where(models.ComplaintStatusHistory.complaint_id == complaint_id)
        .order_by(models.ComplaintStatusHistory.changed_at.asc())
    )
    return result.scalars().all()


@router.patch("/{complaint_id}/memo", response_model=schemas.ComplaintOut)
async def update_complaint_memo(
    complaint_id: int,
    payload: schemas.ComplaintMemoUpdate,
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """담당자 메모 저장."""
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    complaint.memo = payload.memo
    complaint.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(complaint)
    return await build_complaint_out(db, complaint)


@router.post("/{complaint_id}/response", response_model=schemas.ComplaintOut, status_code=201)
async def create_official_response(
    complaint_id: int,
    payload: schemas.ComplaintResponseCreate,
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """공식 답변 등록 + 시민에게 알림."""
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")

    response = models.ComplaintResponse(
        complaint_id=complaint_id,
        content=payload.response,
    )
    db.add(response)
    complaint.updated_at = datetime.utcnow()

    notification = models.Notification(
        user_id=complaint.user_id,
        complaint_id=complaint_id,
        channel="in_app",
        message=f"'{complaint.title}' 민원에 공식 답변이 등록되었습니다.",
        status="sent",
    )
    db.add(notification)

    await db.commit()
    await db.refresh(complaint)
    return await build_complaint_out(db, complaint)


@router.patch("/{complaint_id}/department", response_model=schemas.ComplaintOut)
async def update_complaint_department(
    complaint_id: int,
    payload: schemas.ComplaintDepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """부서 변경."""
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    dept = await db.get(models.Department, payload.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    complaint.assigned_department_id = payload.department_id
    complaint.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(complaint)
    return await build_complaint_out(db, complaint)
