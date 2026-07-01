"""챗봇 라우터.

세션 기반 대화. 모든 대화는 chat_sessions 테이블에 저장된다.

엔드포인트:
- POST   /chat/ask          — 텍스트 입력 → 답변 (session_id 옵션, 없으면 자동 생성)
- POST   /chat/voice        — 음성 입력 (CLOVA CSR) → 텍스트 → 답변
- POST   /chat/image        — 이미지 (gpt-4o Vision) → 분석 → 답변
- POST   /chat/voice-reply  — 답변 텍스트 → 음성 mp3 (CLOVA Voice Premium)
- POST   /chat/sessions     — 세션 수동 생성 (클라이언트가 통째로 저장할 때)
- GET    /chat/sessions     — 내 세션 목록
- GET    /chat/sessions/{id}— 세션 단건 (messages 포함)
- PATCH  /chat/sessions/{id}— 세션 title/status 수정
- DELETE /chat/sessions/{id}— 세션 삭제
"""
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from auth import get_current_user
import models
import schemas
import chatbot_service as svc

router = APIRouter(prefix="/chat", tags=["chat"])

_MAX_HISTORY = 20  # 최근 10턴(20 메시지)만 LLM에 컨텍스트로 전달
_TITLE_MAX = 40   # 자동 생성 title 최대 길이


def _auto_title(first_message: str) -> str:
    t = first_message.strip().replace("\n", " ")
    if len(t) <= _TITLE_MAX:
        return t or "새 상담"
    return t[:_TITLE_MAX] + "…"


async def _load_or_create_session(
    db: AsyncSession,
    user_id: int,
    session_id: int | None,
    first_message: str,
) -> models.ChatSession:
    """session_id 있으면 로드+권한 체크, 없으면 새로 만들어 반환 (커밋 전 상태)."""
    if session_id is not None:
        session = await db.get(models.ChatSession, session_id)
        if not session:
            raise HTTPException(404, "세션을 찾을 수 없습니다.")
        if session.user_id != user_id:
            raise HTTPException(403, "조회 권한이 없습니다.")
        return session

    session = models.ChatSession(
        user_id=user_id,
        title=_auto_title(first_message),
        status="active",
        messages=[],
    )
    db.add(session)
    await db.flush()  # session_id 확보
    return session


def _append_and_save(session: models.ChatSession, user_msg: str, assistant_msg: str):
    """세션 messages에 한 턴 append. flag_modified로 JSONB 변경 인식."""
    msgs = list(session.messages) if session.messages else []
    msgs.append({"role": "user", "content": user_msg})
    msgs.append({"role": "assistant", "content": assistant_msg})
    session.messages = msgs
    session.updated_at = datetime.now()
    flag_modified(session, "messages")


def _history_for_llm(session: models.ChatSession) -> list[dict]:
    """LLM에 넘길 히스토리 (최근 _MAX_HISTORY 메시지만)."""
    msgs = session.messages or []
    if not isinstance(msgs, list):
        return []
    return msgs[-_MAX_HISTORY:]


class AskRequest(BaseModel):
    text: str
    session_id: int | None = None


@router.post("/ask")
async def chat_ask(
    payload: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """텍스트 챗봇 — 세션 기반. session_id 없으면 자동 생성."""
    session = await _load_or_create_session(
        db, current_user.user_id, payload.session_id, payload.text
    )
    history = _history_for_llm(session)
    result = await svc.answer_chatbot(payload.text, history=history)
    _append_and_save(session, payload.text, result["answer"])
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.session_id, **result}


@router.post("/voice")
async def chat_voice(
    audio: UploadFile = File(...),
    session_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """음성 입력 — CLOVA CSR로 텍스트 변환 후 챗봇 호출."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "음성 파일이 비어있습니다.")
    text = await svc.transcribe_audio(audio_bytes)
    if not text:
        raise HTTPException(400, "음성을 인식하지 못했습니다.")

    session = await _load_or_create_session(
        db, current_user.user_id, session_id, text
    )
    history = _history_for_llm(session)
    result = await svc.answer_chatbot(text, history=history)
    _append_and_save(session, text, result["answer"])
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.session_id, "transcribed": text, **result}


@router.post("/image")
async def chat_image(
    file: UploadFile = File(...),
    text: str = Form(""),
    session_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """이미지 + (선택) 텍스트 — gpt-4o Vision 분석 후 챗봇 호출."""
    img_bytes = await file.read()
    if not img_bytes:
        raise HTTPException(400, "이미지 파일이 비어있습니다.")

    img_desc = await svc.analyze_image(
        img_bytes, mime_type=file.content_type or "image/jpeg"
    )
    combined = (
        f"[첨부 이미지 분석]\n{img_desc}\n\n"
        f"[사용자 메시지]\n{text or '(이미지만 첨부)'}"
    )

    session = await _load_or_create_session(
        db, current_user.user_id, session_id, text or "이미지 첨부"
    )
    history = _history_for_llm(session)
    result = await svc.answer_chatbot(combined, history=history)
    _append_and_save(session, combined, result["answer"])
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.session_id, "image_description": img_desc, **result}


class VoiceReplyRequest(BaseModel):
    text: str
    speaker: str = "nara"


@router.post("/voice-reply")
async def chat_voice_reply(payload: VoiceReplyRequest):
    """답변 텍스트를 음성 mp3로 변환 (CLOVA Voice Premium)."""
    audio = await svc.synthesize_speech(payload.text, speaker=payload.speaker)
    return Response(content=audio, media_type="audio/mpeg")


# ---------- 채팅 세션 CRUD ----------
@router.post("/sessions", response_model=schemas.ChatSessionDetailOut, status_code=201)
async def create_chat_session(
    payload: schemas.ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """세션 수동 생성 (클라이언트가 통째로 저장하고 싶을 때)."""
    session = models.ChatSession(
        user_id=current_user.user_id,
        title=payload.title,
        status=payload.status,
        messages=payload.messages,
    )
    if payload.created_at:
        session.created_at = payload.created_at
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[schemas.ChatSessionOut])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """내 상담 세션 목록 (최근 활동순)."""
    result = await db.execute(
        select(models.ChatSession)
        .where(models.ChatSession.user_id == current_user.user_id)
        .order_by(models.ChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}", response_model=schemas.ChatSessionDetailOut)
async def get_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """세션 단건 (messages 포함)."""
    session = await db.get(models.ChatSession, session_id)
    if not session:
        raise HTTPException(404, "세션을 찾을 수 없습니다.")
    if session.user_id != current_user.user_id:
        raise HTTPException(403, "조회 권한이 없습니다.")
    return session


@router.patch("/sessions/{session_id}", response_model=schemas.ChatSessionDetailOut)
async def update_chat_session(
    session_id: int,
    payload: schemas.ChatSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """세션 title/status 수정."""
    session = await db.get(models.ChatSession, session_id)
    if not session:
        raise HTTPException(404, "세션을 찾을 수 없습니다.")
    if session.user_id != current_user.user_id:
        raise HTTPException(403, "수정 권한이 없습니다.")
    if payload.title is not None:
        session.title = payload.title
    if payload.status is not None:
        session.status = payload.status
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """세션 삭제."""
    session = await db.get(models.ChatSession, session_id)
    if not session:
        raise HTTPException(404, "세션을 찾을 수 없습니다.")
    if session.user_id != current_user.user_id:
        raise HTTPException(403, "삭제 권한이 없습니다.")
    await db.delete(session)
    await db.commit()
