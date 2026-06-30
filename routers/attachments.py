"""
민원 첨부파일 엔드포인트 (SFR-003 첨부파일 등록, TER-004 파일 형식 검증)

파일은 서버의 uploads/ 폴더에 저장하고,
DB의 complaint_attachments 테이블에는 그 경로(file_url)만 기록합니다.
"""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
import models
import schemas
from fastapi.responses import FileResponse

router = APIRouter(prefix="/complaints", tags=["attachments"])

# 파일이 저장될 폴더 (프로젝트 루트의 uploads/)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)  # 폴더 없으면 자동 생성

# 허용할 확장자 → 파일 유형 매핑 (TER-004: 형식 검증)
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
DOCUMENT_EXTS = {".pdf", ".doc", ".docx", ".hwp", ".txt"}


def _detect_file_type(filename: str) -> str | None:
    """확장자로 파일 유형 판별. 허용 안 되면 None."""
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in DOCUMENT_EXTS:
        return "document"
    return None


@router.post(
    "/{complaint_id}/attachments",
    response_model=schemas.AttachmentOut,
    status_code=201,
)
async def upload_attachment(
    complaint_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # 로그인 필수
):
    """특정 민원에 이미지/문서 파일을 첨부."""
    # 1) 민원 존재 + 본인 소유 확인
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    if complaint.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="본인 민원에만 첨부할 수 있습니다.")

    # 2) 파일 형식 검증 (TER-004)
    file_type = _detect_file_type(file.filename)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 파일 형식입니다. (이미지 또는 문서 파일만 가능)",
        )

    # 3) 파일 저장 (이름 충돌 방지를 위해 고유 이름 부여)
    ext = Path(file.filename).suffix.lower()
    saved_name = f"{uuid.uuid4().hex}{ext}"
    saved_path = UPLOAD_DIR / saved_name
    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    # 4) DB에 첨부 기록 저장
    attachment = models.ComplaintAttachment(
        complaint_id=complaint_id,
        file_url=str(saved_path),           # 저장 경로
        file_type=file_type,                # image / document
        original_filename=file.filename,    # 사용자가 올린 원래 이름
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment


@router.get(
    "/{complaint_id}/attachments",
    response_model=list[schemas.AttachmentOut],
)
async def list_attachments(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """특정 민원의 첨부파일 목록 조회."""
    complaint = await db.get(models.Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="민원을 찾을 수 없습니다.")
    if complaint.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="본인 민원만 조회할 수 있습니다.")

    result = await db.scalars(
        select(models.ComplaintAttachment).where(
            models.ComplaintAttachment.complaint_id == complaint_id
        )
    )
    return list(result)

# 다운로드는 URL prefix가 달라서 별도 라우터로 분리
attachment_router = APIRouter(prefix="/attachments", tags=["attachments"])


@attachment_router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """첨부파일 다운로드. 본인 민원 작성자 또는 staff/admin만 가능."""
    # 1) 첨부 행 존재 확인
    attachment = await db.get(models.ComplaintAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")

    # 2) 권한 확인: staff/admin이거나, 본인 민원이거나
    if current_user.user_type not in ("staff", "admin"):
        complaint = await db.get(models.Complaint, attachment.complaint_id)
        if not complaint or complaint.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="다운로드 권한이 없습니다.")

    # 3) 디스크에 실제 파일이 있는지 확인
    file_path = Path(attachment.file_url)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 서버에 존재하지 않습니다.")

    # 4) 원본 파일명으로 다운로드 응답
    return FileResponse(
        path=file_path,
        filename=attachment.original_filename,
        media_type="application/octet-stream",
    )
    