"""OCR + PDF 생성.

- POST /ocr/extract  — 이미지 + form_id → GPT-4o Vision으로 필드값 자동 추출
- POST /ocr/pdf      — form_id + values → 채워진 PDF 반환
"""
import base64
import io
import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from openai import AsyncOpenAI

from database import get_db
from auth import get_current_user
import models
import schemas

from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/ocr", tags=["ocr"])

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# 한글 폰트 경로 (윈도우 맑은고딕 우선, 없으면 리눅스 나눔고딕)
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\malgun.ttf",
    r"C:\Windows\Fonts\NanumGothic.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


def _find_font() -> str | None:
    for p in _FONT_CANDIDATES:
        if Path(p).exists():
            return p
    return None


def _build_extract_prompt(form: models.Form) -> str:
    """폼 필드 스펙을 GPT에게 알려주는 프롬프트."""
    fields = form.fields or []
    lines = [f"- {f['name']} ({f.get('label', '')}, type={f.get('type', 'text')})"
             for f in fields]
    field_desc = "\n".join(lines) if lines else "(없음)"
    keys = [f["name"] for f in fields]
    return (
        f"다음은 '{form.name}' 양식이다. 첨부 이미지에서 아래 필드에 해당하는 값을 추출해라.\n"
        f"필드 목록:\n{field_desc}\n\n"
        f"응답은 반드시 JSON 하나로만 답변한다. 키는 위 필드 name과 정확히 일치해야 한다.\n"
        f"필드에 해당하는 정보가 이미지에 없으면 값은 빈 문자열로 둔다.\n"
        f'예: {{"{keys[0] if keys else "field"}": "..."}}'
    )


@router.post("/extract")
async def ocr_extract(
    payload: schemas.OcrExtractRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """이미지 + form_id → 필드 값 dict."""
    form = await db.get(models.Form, payload.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    if not _client.api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 미설정.")

    prompt = _build_extract_prompt(form)
    data_url = f"data:{payload.mime_type};base64,{payload.image_base64}"

    try:
        resp = await _client.chat.completions.create(
            model=_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI 호출 실패: {e}")

    raw = resp.choices[0].message.content or "{}"
    try:
        values = json.loads(raw)
    except json.JSONDecodeError:
        values = {}

    # 스펙에 없는 키 제거 + 스펙에 있는데 응답에 없는 키는 빈 문자열
    allowed = {f["name"] for f in (form.fields or [])}
    cleaned = {k: values.get(k, "") for k in allowed}

    return {"form_id": form.form_id, "values": cleaned, "raw": values}


@router.post("/pdf")
async def ocr_pdf(
    payload: schemas.OcrPdfRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """form_id + values → 채워진 PDF 파일 반환."""
    form = await db.get(models.Form, payload.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font_path = _find_font()
    if not font_path:
        raise HTTPException(status_code=500, detail="한글 폰트를 찾을 수 없습니다.")
    font_name = "KFont"
    if font_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(font_name, font_path))

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # 제목
    c.setFont(font_name, 18)
    c.drawString(20 * mm, height - 25 * mm, form.name)
    if form.description:
        c.setFont(font_name, 10)
        c.drawString(20 * mm, height - 33 * mm, form.description)

    # 필드
    c.setFont(font_name, 11)
    y = height - 50 * mm
    for f in (form.fields or []):
        label = f.get("label") or f.get("name")
        key = f["name"]
        value = payload.values.get(key, "")
        if isinstance(value, (list, dict)):
            value = json.dumps(value, ensure_ascii=False)
        text = f"{label}: {value}"
        # 줄바꿈 (한 줄 최대 ~60자)
        chunks = [text[i:i + 60] for i in range(0, max(len(text), 1), 60)] or [text]
        for chunk in chunks:
            if y < 20 * mm:
                c.showPage()
                c.setFont(font_name, 11)
                y = height - 25 * mm
            c.drawString(20 * mm, y, chunk)
            y -= 8 * mm
        y -= 3 * mm

    c.save()
    pdf_bytes = buf.getvalue()
    filename = f"{form.name}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
