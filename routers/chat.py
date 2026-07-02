"""챗봇 라우터.

세션 기반 대화. 모든 대화는 chat_sessions 테이블에 저장된다.

엔드포인트:
- POST   /chat/ask          — 텍스트 입력 → 답변 (session_id 옵션, 없으면 자동 생성)
- POST   /chat/voice        — 음성 입력 (CLOVA CSR) → 텍스트 → 답변
- POST   /chat/image        — 이미지 (gpt-4o Vision) → 분석 → 답변 (이미지 저장)
- POST   /chat/file         — 문서/파일 첨부 → 세션에 붙임 (분석 X)
- POST   /chat/voice-reply  — 답변 텍스트 → 음성 mp3 (CLOVA Voice Premium)
- POST   /chat/sessions     — 세션 수동 생성 (클라이언트가 통째로 저장할 때)
- GET    /chat/sessions     — 내 세션 목록
- GET    /chat/sessions/{id}— 세션 단건 (messages 포함)
- PATCH  /chat/sessions/{id}— 세션 title/status 수정
- DELETE /chat/sessions/{id}— 세션 삭제
- POST   /chat/sessions/{id}/draft-complaint — 세션 → 민원 접수 초안 (title/content/attachments)
- GET    /chat/files/{name} — 세션에 첨부된 파일 다운로드 (권한 확인)
"""
import mimetypes
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
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

# 파일 저장 경로 — 프로젝트 루트의 uploads/chat/
_CHAT_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "chat"
_CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_MAX_FILE_SIZE = 20 * 1024 * 1024   # 20MB


def _save_upload(file_bytes: bytes, original_name: str, mime: str) -> dict:
    """업로드 파일을 uploads/chat/에 UUID 이름으로 저장. 메시지에 넣을 dict 반환."""
    ext = Path(original_name or "").suffix or mimetypes.guess_extension(mime or "") or ""
    filename = f"{uuid.uuid4().hex}{ext}"
    path = _CHAT_UPLOAD_DIR / filename
    path.write_bytes(file_bytes)
    ftype = "image" if (mime or "").startswith("image/") else "file"
    return {
        "file_url": f"uploads/chat/{filename}",   # 상대 경로
        "filename": filename,                       # 다운로드 endpoint용
        "file_type": ftype,
        "mime_type": mime or "application/octet-stream",
        "original_filename": original_name or filename,
        "size": len(file_bytes),
    }


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


def _append_and_save(
    session: models.ChatSession,
    user_msg: str,
    assistant_msg: str,
    user_attachments: list[dict] | None = None,
):
    """세션 messages에 한 턴 append. 각 메시지에 timestamp 포함.

    user_attachments가 있으면 user 메시지에 첨부 정보 함께 저장.
    """
    msgs = list(session.messages) if session.messages else []
    now = datetime.now().isoformat()
    user_entry = {"role": "user", "content": user_msg, "timestamp": now}
    if user_attachments:
        user_entry["attachments"] = user_attachments
    msgs.append(user_entry)
    msgs.append({"role": "assistant", "content": assistant_msg, "timestamp": datetime.now().isoformat()})
    session.messages = msgs
    session.updated_at = datetime.now()
    flag_modified(session, "messages")


def _append_attachment_only(session: models.ChatSession, attachment: dict, user_text: str = ""):
    """AI 호출 없이 첨부만 세션에 append (/chat/file 용)."""
    msgs = list(session.messages) if session.messages else []
    now = datetime.now().isoformat()
    msgs.append({
        "role": "user",
        "content": user_text or "(파일 첨부)",
        "timestamp": now,
        "attachments": [attachment],
    })
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

    if len(img_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(413, f"파일이 너무 큽니다 (최대 {_MAX_FILE_SIZE // (1024*1024)}MB)")

    img_desc = await svc.analyze_image(
        img_bytes, mime_type=file.content_type or "image/jpeg"
    )
    # 이미지 원본 저장 → attachment 정보에 분석 결과도 함께
    attachment = _save_upload(
        img_bytes, file.filename or "image.jpg", file.content_type or "image/jpeg"
    )
    attachment["description"] = img_desc

    combined = (
        f"[첨부 이미지 분석]\n{img_desc}\n\n"
        f"[사용자 메시지]\n{text or '(이미지만 첨부)'}"
    )

    session = await _load_or_create_session(
        db, current_user.user_id, session_id, text or "이미지 첨부"
    )
    history = _history_for_llm(session)
    result = await svc.answer_chatbot(combined, history=history)
    _append_and_save(session, combined, result["answer"], user_attachments=[attachment])
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.session_id, "image_description": img_desc, "attachment": attachment, **result}


@router.post("/file")
async def chat_file(
    file: UploadFile = File(...),
    text: str = Form(""),
    session_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """일반 파일 첨부 (문서·PDF·기타). AI 분석 없이 세션에 attachment로만 저장.

    이미지면 /chat/image 를 쓰는 게 낫다 (Vision 분석 포함).
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "파일이 비어있습니다.")
    if len(file_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(413, f"파일이 너무 큽니다 (최대 {_MAX_FILE_SIZE // (1024*1024)}MB)")

    attachment = _save_upload(
        file_bytes,
        file.filename or "file",
        file.content_type or "application/octet-stream",
    )

    session = await _load_or_create_session(
        db, current_user.user_id, session_id, text or attachment["original_filename"]
    )
    _append_attachment_only(session, attachment, user_text=text)
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.session_id, "attachment": attachment}


@router.get("/files/{filename}")
async def chat_download_file(
    filename: str,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """세션에 첨부된 파일 다운로드. 권한: 파일이 참조된 세션의 소유자만.

    filename은 UUID 기반이라 추측 불가하지만, 소유권도 확인.
    """
    # 파일 존재 확인
    safe_name = Path(filename).name  # path traversal 방지
    path = _CHAT_UPLOAD_DIR / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "파일을 찾을 수 없습니다.")

    # 이 유저의 세션 중 이 파일을 참조하는 것 있는지 확인
    target_url = f"uploads/chat/{safe_name}"
    result = await db.execute(
        select(models.ChatSession).where(models.ChatSession.user_id == current_user.user_id)
    )
    owned = False
    for session in result.scalars().all():
        msgs = session.messages or []
        for m in (msgs if isinstance(msgs, list) else []):
            for a in (m.get("attachments") or []):
                if a.get("file_url") == target_url or a.get("filename") == safe_name:
                    owned = True
                    break
            if owned:
                break
        if owned:
            break
    if not owned:
        raise HTTPException(403, "이 파일에 접근 권한이 없습니다.")

    return FileResponse(path, filename=safe_name)


class VoiceReplyRequest(BaseModel):
    text: str
    speaker: str = "nara"
    provider: str = "eleven"   # 기본은 마음결 확정 voice (ElevenLabs). 실패 시 자동으로 edge fallback.


@router.post("/voice-reply")
async def chat_voice_reply(payload: VoiceReplyRequest):
    """답변 텍스트를 음성 mp3로 변환.

    기본: ElevenLabs 마음결 확정 voice (uyVNoMrnUku1dZyVEXwD).
    실패(크레딧 소진/네트워크/키 없음) 시 edge-tts로 자동 fallback → 데모 안전.
    """
    try:
        audio = await svc.synthesize_speech(
            payload.text, speaker=payload.speaker, provider=payload.provider
        )
    except Exception:
        # ElevenLabs 실패 시 edge-tts로 fallback (데모 중 무음 방지)
        audio = await svc.synthesize_speech(
            payload.text, speaker=payload.speaker, provider="edge"
        )
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


# ---------- 민원 접수 초안 자동 생성 ----------
_DRAFT_PROMPT = """\
당신은 시민 민원 상담 챗봇의 접수 어시스턴트입니다.
아래 유저↔AI 대화 로그를 바탕으로 시민이 '민원 접수' 화면에서 바로 쓸 수 있는
**민원 제목**과 **민원 내용**을 만들어주세요.

## 규칙
- **제목**: 간결한 한 줄 (10~30자). 이슈 유형이 드러나야 함.
  예: "도로 포트홀 신고", "가로등 고장 문의", "가족관계증명서 발급 절차"
- **내용**: 담당 공무원이 읽고 처리할 수 있는 정중한 서술체 (2~4문장, 100~250자).
  - 상황·위치·불편 정도를 구체적으로.
  - 이미지가 첨부되었다면 이미지에서 확인된 사실을 반영.
  - **금지**: "카테고리 후보:", "[첨부 이미지 분석]", "[사용자 메시지]" 같은 시스템 메타 표기는 절대 넣지 마세요.
  - 이모지·해시태그 금지. 대화체("~에요") 대신 서술체("~니다") 사용.

## 대화 로그
{conversation}

## 첨부 이미지 분석 (있으면 참고)
{image_desc}

## 출력 형식 (JSON만 출력)
{{"title": "...", "content": "..."}}
"""


class DraftComplaintOut(BaseModel):
    session_id: int
    title: str
    content: str
    attachments: list[dict] = []


@router.post("/sessions/{session_id}/draft-complaint", response_model=DraftComplaintOut)
async def draft_complaint_from_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """세션 대화를 바탕으로 민원 접수용 title/content 초안 자동 생성.

    프론트가 "민원 접수" 버튼 클릭 시 호출 → 반환된 title/content 로 폼 자동 채움.
    첨부 파일도 세션에 있던 것 그대로 반환 (프론트가 접수 시 다시 붙일 수 있게).
    유저는 초안 확인·수정 후 POST /complaints 로 실제 접수.
    """
    session = await db.get(models.ChatSession, session_id)
    if not session:
        raise HTTPException(404, "세션을 찾을 수 없습니다.")
    if session.user_id != current_user.user_id:
        raise HTTPException(403, "조회 권한이 없습니다.")

    msgs = session.messages or []
    if not isinstance(msgs, list) or not msgs:
        raise HTTPException(400, "세션에 대화 내용이 없습니다.")

    # 대화 로그 구성 (system meta 텍스트 제거)
    import re as _re
    conv_lines: list[str] = []
    attachments_all: list[dict] = []
    image_descs: list[str] = []
    for m in msgs:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        # 첨부 정보 수집
        for a in (m.get("attachments") or []):
            attachments_all.append(a)
            if a.get("description"):
                image_descs.append(a["description"])
        # 이미지 분석 태그 제거 (LLM에 clean text만 주도록)
        content = _re.sub(r'\[첨부 이미지 분석\]\n.*?\n\n\[사용자 메시지\]\n', '', content, flags=_re.DOTALL)
        content = _re.sub(r'카테고리 후보:.*', '', content).strip()
        if not content:
            continue
        prefix = "유저" if role == "user" else "AI"
        conv_lines.append(f"{prefix}: {content}")

    conversation = "\n".join(conv_lines) or "(대화 내용 없음)"
    image_desc_text = "\n".join(image_descs) if image_descs else "(첨부 이미지 없음)"

    prompt = _DRAFT_PROMPT.format(conversation=conversation, image_desc=image_desc_text)

    # LLM 호출
    client = svc._get_openai()
    resp = await client.chat.completions.create(
        model=svc.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    import json as _json
    raw = (resp.choices[0].message.content or "").strip()
    try:
        parsed = _json.loads(raw)
        title = str(parsed.get("title", "")).strip()
        content = str(parsed.get("content", "")).strip()
    except Exception:
        raise HTTPException(500, f"초안 생성 파싱 실패: {raw[:200]}")

    if not title:
        title = "민원 접수"
    if not content:
        content = conversation[:200]

    return DraftComplaintOut(
        session_id=session_id,
        title=title[:200],
        content=content,
        attachments=attachments_all,
    )
