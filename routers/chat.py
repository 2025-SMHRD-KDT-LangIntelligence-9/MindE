"""챗봇 라우터.

엔드포인트:
- POST /chat/ask         — 텍스트 입력 → 답변
- POST /chat/voice       — 음성 입력 (CLOVA CSR) → 텍스트 변환 → 답변
- POST /chat/image       — 이미지 입력 (gpt-4o Vision) → 분석 → 답변
- POST /chat/voice-reply — 답변 텍스트 → 음성 mp3 (CLOVA Voice Premium)
- DELETE /chat/reset     — 사용자 history 초기화

history는 user_id별 in-memory dict로 보관 (발표/데모용).
운영에선 Redis 또는 DB로 옮기는 게 안전.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from auth import get_current_user
import models
import chatbot_service as svc

router = APIRouter(prefix="/chat", tags=["chat"])

# 세션별 대화 누적. 키: user_id
_SESSIONS: dict[int, list[dict]] = {}
_MAX_HISTORY = 20  # 최근 10턴(=20 메시지) 유지


def _get_history(user_id: int) -> list[dict]:
    return _SESSIONS.get(user_id, [])


def _append_history(user_id: int, user_msg: str, assistant_msg: str):
    h = _SESSIONS.setdefault(user_id, [])
    h.append({"role": "user", "content": user_msg})
    h.append({"role": "assistant", "content": assistant_msg})
    _SESSIONS[user_id] = h[-_MAX_HISTORY:]


class AskRequest(BaseModel):
    text: str


@router.post("/ask")
async def chat_ask(
    payload: AskRequest,
    current_user: models.User = Depends(get_current_user),
):
    """텍스트 챗봇 — 게이트/멀티턴/도구/답변 LLM 통합."""
    history = _get_history(current_user.user_id)
    result = await svc.answer_chatbot(payload.text, history=history)
    _append_history(current_user.user_id, payload.text, result["answer"])
    return result


@router.post("/voice")
async def chat_voice(
    audio: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """음성 입력 — CLOVA CSR로 텍스트 변환 후 챗봇 호출."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "음성 파일이 비어있습니다.")
    text = await svc.transcribe_audio(audio_bytes)
    if not text:
        raise HTTPException(400, "음성을 인식하지 못했습니다.")

    history = _get_history(current_user.user_id)
    result = await svc.answer_chatbot(text, history=history)
    _append_history(current_user.user_id, text, result["answer"])
    return {"transcribed": text, **result}


@router.post("/image")
async def chat_image(
    file: UploadFile = File(...),
    text: str = Form(""),
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

    history = _get_history(current_user.user_id)
    result = await svc.answer_chatbot(combined, history=history)
    _append_history(current_user.user_id, combined, result["answer"])
    return {"image_description": img_desc, **result}


class VoiceReplyRequest(BaseModel):
    text: str
    speaker: str = "nara"


@router.post("/voice-reply")
async def chat_voice_reply(payload: VoiceReplyRequest):
    """답변 텍스트를 음성 mp3로 변환 (CLOVA Voice Premium).

    NCP에서 CLOVA Voice Premium 서비스가 활성화되어 있어야 함.
    """
    audio = await svc.synthesize_speech(payload.text, speaker=payload.speaker)
    return Response(content=audio, media_type="audio/mpeg")


@router.delete("/reset")
async def chat_reset(current_user: models.User = Depends(get_current_user)):
    """현재 사용자의 대화 history 초기화."""
    _SESSIONS.pop(current_user.user_id, None)
    return {"status": "reset"}
