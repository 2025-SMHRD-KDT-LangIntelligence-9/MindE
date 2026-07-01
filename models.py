"""
DB 테이블 ↔ 파이썬 클래스 매핑.

중요: 테이블은 이미 SQL로 만들어 둔 상태이므로, 여기서는 '새로 만드는' 게 아니라
기존 테이블에 모델을 '연결'만 합니다. (절대 Base.metadata.create_all 호출 X)

컬럼 타입/길이/제약은 실제 만들어 둔 DDL과 동일하게 맞췄습니다.
모든 식별자(ID, PK/FK)는 BIGINT 로 통일했습니다.
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Integer,
    SmallInteger,
    String,
    Text,
    Boolean,
    Numeric,
    TIMESTAMP,
    ForeignKey,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector  # rag_documents.embedding 용

from database import Base


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(100))
    contact_phone: Mapped[str | None] = mapped_column(String(20))


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    user_type: Mapped[str] = mapped_column(String(20), nullable=False)  # citizen/staff/admin
    notification_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    department_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.department_id")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )


class ComplaintCluster(Base):
    __tablename__ = "complaint_clusters"

    cluster_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    representative_content: Mapped[str | None] = mapped_column(Text)
    complaint_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )


class Complaint(Base):
    __tablename__ = "complaints"

    complaint_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("categories.category_id"))
    assigned_department_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.department_id")
    )
    cluster_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("complaint_clusters.cluster_id")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    urgency_score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
    memo: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)


class CategoryDepartmentMapping(Base):
    __tablename__ = "category_department_mapping"

    mapping_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("categories.category_id"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("departments.department_id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)


class UrgencyKeyword(Base):
    __tablename__ = "urgency_keywords"

    keyword_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    keyword: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.category_id")
    )
    weight: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)


class RagDocument(Base):
    __tablename__ = "rag_documents"

    document_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str | None] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.category_id")
    )
    # ⚠️ 차원(1536)은 실제 쓸 임베딩 모델에 맞춰 확정 필요 (BGE-M3면 1024)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768))


class ComplaintResponse(Base):
    __tablename__ = "complaint_responses"

    response_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    complaint_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("complaints.complaint_id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    referenced_docs: Mapped[dict | list | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )


class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

    history_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    complaint_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("complaints.complaint_id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
    changed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.user_id"))
    note: Mapped[str | None] = mapped_column(Text)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    complaint_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("complaints.complaint_id")
    )
    channel: Mapped[str] = mapped_column(String(10), nullable=False)  # kakao/sms/push
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False)  # sent/failed
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    messages: Mapped[list | dict] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )


class ComplaintAttachment(Base):
    __tablename__ = "complaint_attachments"

    attachment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    complaint_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("complaints.complaint_id"), nullable=False
    )
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # image/document
    original_filename: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )
