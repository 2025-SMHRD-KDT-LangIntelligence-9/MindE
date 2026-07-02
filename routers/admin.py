"""
관리자(admin) 전용 엔드포인트.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
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


# ==========================================================================
# 통계 (관리자 대시보드용) — 프론트가 골라서 씀
# ==========================================================================

@router.get("/stats/summary")
async def stats_summary(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """대시보드 상단 요약 카드용 (숫자만).

    반환: 오늘 접수, 이번주 접수, 이번달 접수, 총 접수,
          처리중, 답변완료, 긴급(urgency>=0.7), 신규 사용자(이번주).
    """
    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    async def count(q):
        r = await db.execute(q)
        return int(r.scalar() or 0)

    C = models.Complaint
    total = await count(select(func.count()).select_from(C))
    today_ = await count(select(func.count()).select_from(C).where(C.created_at >= today))
    week_ = await count(select(func.count()).select_from(C).where(C.created_at >= week_ago))
    month_ = await count(select(func.count()).select_from(C).where(C.created_at >= month_ago))
    in_progress = await count(select(func.count()).select_from(C).where(C.status.in_(["received", "assigned", "in_progress"])))
    answered = await count(select(func.count()).select_from(C).where(C.status == "answered"))
    closed = await count(select(func.count()).select_from(C).where(C.status == "closed"))
    urgent = await count(select(func.count()).select_from(C).where(C.urgency_score >= 0.7))

    U = models.User
    users_total = await count(select(func.count()).select_from(U))
    users_new_week = await count(select(func.count()).select_from(U).where(U.created_at >= week_ago))

    N = models.Notification
    unread_notifications = await count(select(func.count()).select_from(N).where(N.is_read == False))

    return {
        "complaints": {
            "total": total,
            "today": today_,
            "this_week": week_,
            "this_month": month_,
            "in_progress": in_progress,
            "answered": answered,
            "closed": closed,
            "urgent": urgent,
        },
        "users": {
            "total": users_total,
            "new_this_week": users_new_week,
        },
        "notifications": {
            "unread": unread_notifications,
        },
    }


@router.get("/stats/by-status")
async def stats_by_status(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """상태별 민원 수 (도넛/파이 차트용)."""
    C = models.Complaint
    result = await db.execute(
        select(C.status, func.count().label("cnt"))
        .group_by(C.status)
        .order_by(func.count().desc())
    )
    return [{"status": r[0], "count": int(r[1])} for r in result.all()]


@router.get("/stats/by-category")
async def stats_by_category(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """카테고리별 민원 수 (막대 차트용).

    카테고리 없는 민원(category_id=NULL)은 '미분류'로.
    """
    C = models.Complaint
    Cat = models.Category
    result = await db.execute(
        select(C.category_id, Cat.name, func.count().label("cnt"))
        .join(Cat, C.category_id == Cat.category_id, isouter=True)
        .group_by(C.category_id, Cat.name)
        .order_by(func.count().desc())
    )
    return [
        {
            "category_id": r[0],
            "category": r[1] or "미분류",
            "count": int(r[2]),
        }
        for r in result.all()
    ]


@router.get("/stats/by-department")
async def stats_by_department(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """부서별 배정 민원 수 + 상태 breakdown.

    할당 안 된 민원은 '미배정'.
    """
    C = models.Complaint
    D = models.Department
    result = await db.execute(
        select(
            C.assigned_department_id,
            D.name,
            C.status,
            func.count().label("cnt"),
        )
        .join(D, C.assigned_department_id == D.department_id, isouter=True)
        .group_by(C.assigned_department_id, D.name, C.status)
    )
    # 부서별로 집계
    depts: dict = {}
    for r in result.all():
        dept_id = r[0]
        dept_name = r[1] or "미배정"
        status = r[2]
        cnt = int(r[3])
        key = dept_id or 0
        if key not in depts:
            depts[key] = {
                "department_id": dept_id,
                "department": dept_name,
                "total": 0,
                "by_status": {},
            }
        depts[key]["total"] += cnt
        depts[key]["by_status"][status] = cnt
    return sorted(depts.values(), key=lambda x: -x["total"])


@router.get("/stats/timeline")
async def stats_timeline(
    days: int = Query(7, ge=1, le=90, description="며칠 치 (1~90)"),
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """일별 민원 접수/답변완료 추이 (선/영역 차트용).

    Args:
        days: 몇 일 조회 (기본 7일).

    반환: 날짜별 접수 수 + 답변완료 수.
    """
    now = datetime.utcnow()
    start = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)

    C = models.Complaint
    # 접수일 기준 일별
    created_result = await db.execute(
        select(func.date(C.created_at).label("d"), func.count().label("cnt"))
        .where(C.created_at >= start)
        .group_by(func.date(C.created_at))
    )
    created_map = {str(r[0]): int(r[1]) for r in created_result.all()}

    # 답변완료일 기준 일별 (status_history 참고)
    H = models.ComplaintStatusHistory
    answered_result = await db.execute(
        select(func.date(H.changed_at).label("d"), func.count().label("cnt"))
        .where(and_(H.status == "answered", H.changed_at >= start))
        .group_by(func.date(H.changed_at))
    )
    answered_map = {str(r[0]): int(r[1]) for r in answered_result.all()}

    # 날짜별로 정렬해서 반환 (0인 날도 채워서)
    timeline = []
    for i in range(days):
        d = (start + timedelta(days=i)).date()
        d_str = str(d)
        timeline.append({
            "date": d_str,
            "created": created_map.get(d_str, 0),
            "answered": answered_map.get(d_str, 0),
        })
    return timeline


@router.get("/stats/urgency")
async def stats_urgency(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """긴급도 분포 (막대/히스토그램용).

    - critical: urgency >= 0.9
    - high:     0.7 <= urgency < 0.9
    - medium:   0.4 <= urgency < 0.7
    - low:      urgency < 0.4
    """
    C = models.Complaint
    async def count(cond):
        r = await db.execute(select(func.count()).select_from(C).where(cond))
        return int(r.scalar() or 0)
    critical = await count(C.urgency_score >= 0.9)
    high = await count(and_(C.urgency_score >= 0.7, C.urgency_score < 0.9))
    medium = await count(and_(C.urgency_score >= 0.4, C.urgency_score < 0.7))
    low = await count(C.urgency_score < 0.4)
    return {
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "thresholds": {
            "critical": 0.9,
            "high": 0.7,
            "medium": 0.4,
        },
    }


@router.get("/stats/urgent-top")
async def stats_urgent_top(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """긴급도 높은 최근 민원 top-N (관리자 알림 배너용)."""
    C = models.Complaint
    result = await db.execute(
        select(C)
        .where(C.urgency_score >= 0.7)
        .order_by(C.urgency_score.desc(), C.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [await build_complaint_out(db, c) for c in rows]


@router.get("/stats/hot-clusters")
async def stats_hot_clusters(
    limit: int = Query(10, ge=1, le=30),
    min_count: int = Query(3, ge=2, description="최소 클러스터 크기"),
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """접수 폭증 클러스터 (같은 유형 민원 대량 접수 감지)."""
    Cluster = models.ComplaintCluster
    result = await db.execute(
        select(Cluster)
        .where(Cluster.complaint_count >= min_count)
        .order_by(Cluster.complaint_count.desc(), Cluster.last_seen_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "cluster_id": c.cluster_id,
            "representative_content": (c.representative_content or "")[:200],
            "complaint_count": c.complaint_count,
            "first_seen_at": c.first_seen_at,
            "last_seen_at": c.last_seen_at,
        }
        for c in rows
    ]


@router.get("/stats/response-metrics")
async def stats_response_metrics(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """답변 지표: 답변률, 평균 답변 시간, 미답변 건수."""
    C = models.Complaint
    total_r = await db.execute(select(func.count()).select_from(C))
    total = int(total_r.scalar() or 0)

    answered_r = await db.execute(
        select(func.count()).select_from(C).where(C.status.in_(["answered", "closed"]))
    )
    answered = int(answered_r.scalar() or 0)

    pending_r = await db.execute(
        select(func.count()).select_from(C).where(
            C.status.in_(["received", "assigned", "in_progress", "needs_more_info"])
        )
    )
    pending = int(pending_r.scalar() or 0)

    # 평균 답변 시간: created_at → status='answered' 최초 시각의 diff (시간 단위)
    H = models.ComplaintStatusHistory
    avg_r = await db.execute(
        select(func.avg(
            func.extract("epoch", H.changed_at - C.created_at) / 3600.0
        ))
        .select_from(H)
        .join(C, H.complaint_id == C.complaint_id)
        .where(H.status == "answered")
    )
    avg_hours = avg_r.scalar()
    avg_hours = round(float(avg_hours), 2) if avg_hours is not None else None

    return {
        "total": total,
        "answered": answered,
        "pending": pending,
        "answer_rate": round(answered / total, 4) if total else 0.0,
        "avg_answer_hours": avg_hours,
    }


@router.get("/stats/user-metrics")
async def stats_user_metrics(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """사용자 지표: 시민/담당자/관리자 카운트, 이번주/이번달 신규 가입."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    U = models.User
    async def count(cond=None):
        q = select(func.count()).select_from(U)
        if cond is not None:
            q = q.where(cond)
        r = await db.execute(q)
        return int(r.scalar() or 0)

    result = await db.execute(
        select(U.user_type, func.count()).group_by(U.user_type)
    )
    by_type = {r[0]: int(r[1]) for r in result.all()}

    return {
        "total": await count(),
        "by_type": by_type,
        "new_this_week": await count(U.created_at >= week_ago),
        "new_this_month": await count(U.created_at >= month_ago),
    }


@router.get("/stats/attachment-rate")
async def stats_attachment_rate(
    db: AsyncSession = Depends(get_db),
    current_staff: models.User = Depends(get_current_staff),
):
    """첨부파일 첨부율 (첨부 있는 민원 비율)."""
    C = models.Complaint
    A = models.ComplaintAttachment
    total_r = await db.execute(select(func.count()).select_from(C))
    total = int(total_r.scalar() or 0)
    with_att_r = await db.execute(
        select(func.count(func.distinct(A.complaint_id))).select_from(A)
    )
    with_att = int(with_att_r.scalar() or 0)
    return {
        "total_complaints": total,
        "with_attachment": with_att,
        "attachment_rate": round(with_att / total, 4) if total else 0.0,
    }
