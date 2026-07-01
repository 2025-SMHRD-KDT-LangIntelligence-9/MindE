"""
API가 주고받는 데이터의 '형태'를 정의 (Pydantic).
"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Literal


# ---------- 사용자(User) ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    apply_as_staff: bool = False


class UserOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    user_type: str
    phone: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    """프로필 수정. 비밀번호 변경 시 current_password 필수."""
    current_password: str
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    password: str | None = None


class UserDepartmentUpdate(BaseModel):
    department_id: int | None


# ---------- 토큰(JWT) ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- 민원(Complaint) ----------
class ComplaintCreate(BaseModel):
    title: str
    content: str


class ComplaintOut(BaseModel):
    complaint_id: int
    user_id: int
    category_id: int | None = None
    assigned_department_id: int | None = None
    title: str
    content: str
    status: str
    created_at: datetime
    urgency_score: float = 0
    # 추가 표시용 필드 (JOIN으로 채워서 dict 반환)
    category: str | None = None
    department: str | None = None
    citizen_name: str | None = None
    updated_at: datetime | None = None
    memo: str | None = None
    reply: str | None = None
    reply_date: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ComplaintStatusUpdate(BaseModel):
    status: Literal[
        "received", "assigned", "in_progress", "answered",
        "closed", "rejected", "needs_more_info",
    ]
    note: str | None = None


class ComplaintStatusHistoryOut(BaseModel):
    history_id: int
    complaint_id: int
    status: str
    changed_at: datetime
    changed_by: int | None
    note: str | None

    model_config = ConfigDict(from_attributes=True)


class ComplaintMemoUpdate(BaseModel):
    memo: str


class ComplaintResponseCreate(BaseModel):
    response: str


class ComplaintDepartmentUpdate(BaseModel):
    department_id: int


# ---------- 알림(Notification) ----------
class NotificationOut(BaseModel):
    notification_id: int
    user_id: int
    complaint_id: int | None
    channel: str
    message: str
    sent_at: datetime
    status: str
    is_read: bool = False

    model_config = ConfigDict(from_attributes=True)


# ---------- 첨부파일(Attachment) ----------
class AttachmentOut(BaseModel):
    attachment_id: int
    complaint_id: int
    file_url: str
    file_type: str
    original_filename: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- 부서(Department) ----------
class DepartmentOut(BaseModel):
    department_id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class DepartmentCreate(BaseModel):
    name: str


class DepartmentUpdate(BaseModel):
    name: str


# ---------- 카테고리(Category) ----------
class CategoryOut(BaseModel):
    category_id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


# ---------- 알림 설정 ----------
class NotificationEnabledUpdate(BaseModel):
    notification_enabled: bool


# ---------- 채팅 세션 ----------
class ChatSessionCreate(BaseModel):
    title: str
    status: str = "active"
    messages: list | dict = []
    created_at: datetime | None = None


class ChatSessionOut(BaseModel):
    session_id: int
    title: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionDetailOut(BaseModel):
    session_id: int
    user_id: int
    title: str
    status: str
    messages: list | dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
