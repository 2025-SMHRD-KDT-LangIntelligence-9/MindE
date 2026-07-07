"""
API가 주고받는 데이터의 '형태'를 정의 (Pydantic).
"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Literal


# ---------- 사용자(User) ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    apply_as_staff: bool = False
    department_id: int | None = None   # apply_as_staff=True 일 때만 사용됨


class UserOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    user_type: str
    phone: str | None = None
    department_id: int | None = None
    department_name: str | None = None   # 담당자 부서명 (JOIN으로 채움)
    created_at: datetime | None = None    # 가입일 (관리자 화면용)

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
    chat_session_id: int | None = None   # 챗봇 대화 끝에 접수한 경우 원본 세션 ID


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
    chat_session_id: int | None = None   # 원본 챗봇 세션 (담당자 "원본 대화 보기"용)

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
    file_size: int | None = None    # bytes
    uploaded_by: int | None = None  # 업로더 user_id (시민/담당자 구분용)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- 부서(Department) ----------
class DepartmentOut(BaseModel):
    department_id: int
    name: str
    # DB 컬럼은 contact_phone, 프론트에는 phone 으로 노출
    phone: str | None = Field(default=None, alias="contact_phone")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DepartmentCreate(BaseModel):
    name: str
    phone: str | None = None


class DepartmentUpdate(BaseModel):
    name: str
    phone: str | None = None


# ---------- 카테고리(Category) ----------
class CategoryOut(BaseModel):
    category_id: int
    name: str
    department_id: int | None = None
    department_name: str | None = None   # JOIN으로 채워서 dict 반환

    model_config = ConfigDict(from_attributes=True)


class CategoryCreate(BaseModel):
    name: str
    department_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str
    department_id: int | None = None


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


# ---------- 서식 자동 작성 (Form Templates) ----------
class FormTemplateSummary(BaseModel):
    """좌측 목록용 (필드 매핑 제외, 가벼운 응답)."""
    form_template_id: int
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class FormTemplateOut(BaseModel):
    """단건 상세 — field_mappings 포함."""
    form_template_id: int
    name: str
    description: str | None = None
    pdf_url: str
    field_mappings: list | dict
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class FormFillRequest(BaseModel):
    """AI 필드 채우기 요청."""
    template_id: int
    user_message: str | None = None        # 이 화면에서 사용자가 새로 입력한 텍스트
    chat_session_id: int | None = None     # 챗봇 상담에서 넘어온 경우
    current_fields: dict | None = None     # 이전에 채워졌거나 사용자가 수정한 값 (반복 갱신용)


class FormFillResponse(BaseModel):
    """AI 필드 채우기 응답."""
    template_id: int
    fields: dict                            # {필드key: 값} — 하위 호환용
    message: str = ""                       # AI 자연어 응답 (뭘 채웠는지 / 뭐가 더 필요한지)
    rendered_fields: list | dict = []       # 렌더용 필드 (align·오프셋 자동 조정된 좌표 + 값 포함)
