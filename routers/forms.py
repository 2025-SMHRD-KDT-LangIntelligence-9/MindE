"""
민원 서식 자동 작성 라우터.

시나리오:
- 좌측: GET /forms/templates 로 서식 목록 조회 → 사용자가 선택
- 중앙: 대화창에서 사용자가 상황 설명 → POST /forms/fill 로 AI가 필드값 반환
        (챗봇 상담 세션에서 진입한 경우 chat_session_id 전달 시 이전 대화 컨텍스트 활용)
- 오른쪽: 미리보기. 프론트가 field_mappings의 좌표 + fields의 값으로 렌더.
         사용자가 직접 편집 가능. 이후 fill 요청엔 current_fields로 실어 반복 갱신.
- 다운로드: 프론트가 pdf_url로 원본 PDF 받아 좌표에 텍스트 얹어 PDF 생성.
- 제출: 프론트가 필드값 조합해 POST /complaints 호출 (기존 흐름).
"""
import io
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
import models
import schemas
import chatbot_service as svc

# 한글 폰트 (Windows Malgun Gothic). 없으면 렌더 실패.
_KOREAN_FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"

router = APIRouter(prefix="/forms", tags=["forms"])

# uploads/forms/ 아래에 서식 PDF 원본을 둔다. main.py 실행 디렉토리 기준 상대경로.
FORMS_DIR = Path("uploads/forms").resolve()


# 체크박스 자동 오프셋 상수 (mm 단위)
_CHECKBOX_X_OFFSET_MM = 1.0
_CHECKBOX_Y_OFFSET_MM = 0.5
_CHECKBOX_FONT_SIZE = 11.0

# pt <-> mm 변환
_PT_PER_MM = 72.0 / 25.4
_MM_PER_PT = 25.4 / 72.0


def _estimate_text_width_mm(text: str, size_pt: float = 9.0) -> float:
    """텍스트 폭을 mm 단위로 추정. 한글은 정사각형(폭≈크기), 라틴/숫자는 반폭."""
    if not text:
        return 0.0
    total_pt = 0.0
    for c in text:
        # 한글 완성형 (가-힣) or CJK 통합 한자
        if ("가" <= c <= "힣") or ("一" <= c <= "鿿"):
            total_pt += size_pt
        # 전각 특수문자 (□ 등)
        elif ("　" <= c <= "〿") or ("＀" <= c <= "￯"):
            total_pt += size_pt
        # 라틴·숫자·공백
        else:
            total_pt += size_pt * 0.55
    return total_pt * _MM_PER_PT


def _apply_render_adjustments(field_mappings, filled_values: dict) -> list:
    """정렬(align)을 감안해 각 필드 좌표를 자동 조정. 프론트는 좌측 정렬로만 그리면 됨.

    - align="right": 좌표가 텍스트 오른쪽 끝. 텍스트 폭만큼 좌표 x를 왼쪽으로 이동.
    - align="middle"/"center": 좌표가 텍스트 중앙. 반폭만큼 왼쪽으로 이동.
    - align="left" (default): 그대로.
    - 결과: 모든 필드 align="left"로 통일 → 프론트가 정렬 로직 불필요.
    """
    if not field_mappings:
        return field_mappings

    def _adjust_one(f: dict) -> dict:
        if not isinstance(f, dict):
            return f
        out = dict(f)
        name = out.get("name", "") or out.get("key", "")
        value = filled_values.get(name)
        align = out.get("align", "left")
        if not value or align == "left":
            out["align"] = "left"
            return out
        size_pt = float(out.get("size") or 9.0)
        width_mm = _estimate_text_width_mm(str(value), size_pt)
        pos = out.get("position")
        if isinstance(pos, list) and len(pos) >= 2:
            x, y = pos[0], pos[1]
            if align == "right":
                x = x - width_mm
            elif align in ("middle", "center"):
                x = x - width_mm / 2.0
            out["position"] = [round(x, 2), round(y, 2)]
        out["align"] = "left"
        return out

    # 페이지 배열 or flat 리스트 지원
    if isinstance(field_mappings, list) and field_mappings \
            and isinstance(field_mappings[0], list):
        return [[_adjust_one(f) for f in page] for page in field_mappings]
    if isinstance(field_mappings, list):
        return [_adjust_one(f) for f in field_mappings]
    return field_mappings


def _is_checkbox_name(name: str) -> bool:
    """필드명이 체크박스 성격인지 판정.

    - □ 문자 포함
    - 또는 대괄호 안 공백 개수 무관 (`[]`, `[ ]`, `[  ]`, `[ V ]` 등)
    """
    if not name:
        return False
    if "□" in name:
        return True
    import re as _re
    return bool(_re.search(r"\[\s*\]", name))


def _auto_adjust_field_mappings(field_mappings):
    """DB의 raw field_mappings에 프론트 렌더용 자동 조정 적용.

    - 체크박스 성격 필드: 좌표 +1mm 오른쪽, +0.5mm 위 + font_size 통일 (V가 [ ] 안 예쁘게)
    - 일반 텍스트 필드: 그대로

    입력 형식 두 가지 지원 (팀 표준 페이지 배열 or flat 리스트).
    DB 원본은 안 건드리고, 응답용 사본 반환.
    """
    if not field_mappings:
        return field_mappings

    def _adjust_field(f: dict) -> dict:
        if not isinstance(f, dict):
            return f
        # 원본 훼손 방지용 얕은 복사
        out = dict(f)
        if _is_checkbox_name(out.get("name", "") or out.get("key", "")):
            # 좌표 조정 (position 배열 or x/y 분리 둘 다 지원)
            pos = out.get("position")
            if isinstance(pos, list) and len(pos) >= 2:
                out["position"] = [pos[0] + _CHECKBOX_X_OFFSET_MM,
                                   pos[1] + _CHECKBOX_Y_OFFSET_MM]
            elif out.get("x") is not None and out.get("y") is not None:
                out["x"] = out["x"] + _CHECKBOX_X_OFFSET_MM
                out["y"] = out["y"] + _CHECKBOX_Y_OFFSET_MM
            # 크기 통일
            out["size"] = _CHECKBOX_FONT_SIZE
            # 정렬은 left로 고정
            out["align"] = "left"
        return out

    # 팀 표준: 페이지 배열
    if isinstance(field_mappings, list) and field_mappings \
            and isinstance(field_mappings[0], list):
        return [[_adjust_field(f) for f in page] for page in field_mappings]
    # flat 리스트
    if isinstance(field_mappings, list):
        return [_adjust_field(f) for f in field_mappings]
    return field_mappings


@router.get("/templates", response_model=list[schemas.FormTemplateSummary])
async def list_form_templates(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """활성 서식 목록. 좌측 리스트용 (필드 매핑 제외 — 가벼운 응답)."""
    result = await db.execute(
        select(models.FormTemplate)
        .where(models.FormTemplate.is_active.is_(True))
        .order_by(models.FormTemplate.form_template_id.asc())
    )
    return result.scalars().all()


@router.get("/templates/{template_id}", response_model=schemas.FormTemplateOut)
async def get_form_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """단건 상세 (field_mappings 포함).

    체크박스 성격 필드는 렌더 시 [ ] 박스 안에 예쁘게 정렬되도록
    좌표·크기를 서버가 자동 조정해서 응답한다.
    프론트는 응답의 position/size/align을 그대로 사용하면 된다.
    """
    tpl = await db.get(models.FormTemplate, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail="서식을 찾을 수 없습니다.")

    # PDF에서 표 격자 감지 → 팀이 아직 안 찍은 셀을 자동 좌표로 병합
    pdf_full = None
    if tpl.pdf_url:
        candidate = FORMS_DIR / Path(tpl.pdf_url).name
        if candidate.exists() and candidate.is_file():
            pdf_full = str(candidate)
    fm_with_cells = svc._generate_table_cell_fields(tpl.field_mappings, pdf_full)

    return {
        "form_template_id": tpl.form_template_id,
        "name": tpl.name,
        "description": tpl.description,
        "pdf_url": tpl.pdf_url,
        "field_mappings": _auto_adjust_field_mappings(fm_with_cells),
        "is_active": tpl.is_active,
    }


@router.get("/templates/{template_id}/pdf")
async def get_form_template_pdf(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """서식 PDF 원본 다운로드 (프론트가 오버레이 렌더용으로 로드)."""
    tpl = await db.get(models.FormTemplate, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail="서식을 찾을 수 없습니다.")

    # pdf_url은 uploads/forms/xxx.pdf 형태의 상대경로. Path traversal 방지.
    rel = (tpl.pdf_url or "").lstrip("/\\")
    full = (Path("uploads/forms").resolve() / Path(rel).name)
    if not full.exists() or not full.is_file():
        raise HTTPException(status_code=404, detail="서식 파일이 없습니다.")
    return FileResponse(
        path=str(full),
        media_type="application/pdf",
        filename=f"{tpl.name}.pdf",
    )


def _render_filled_pdf(pdf_source_path: str, field_mappings, values: dict) -> bytes:
    """PyMuPDF로 서식 PDF에 값을 픽셀 정확히 렌더해 bytes로 반환.

    - 팀 metadata 좌표(mm, Y bottom-origin) → PDF pt (top-origin) 변환
    - Malgun Gothic 폰트로 실제 폭 측정 → 우측/중앙 정렬 픽셀 정확
    - 체크박스도 오프셋 자동 적용
    """
    import fitz

    if not os.path.exists(_KOREAN_FONT_PATH):
        raise HTTPException(500, "한글 폰트를 찾을 수 없습니다. (서버 설치 필요)")

    doc = fitz.open(pdf_source_path)
    try:
        korean_font = fitz.Font(fontfile=_KOREAN_FONT_PATH)

        pages = field_mappings if (field_mappings and isinstance(field_mappings, list)
                                    and isinstance(field_mappings[0], list)) \
                                else [field_mappings or []]

        for pi, page in enumerate(doc):
            if pi >= len(pages):
                break
            for f in pages[pi]:
                if not isinstance(f, dict):
                    continue
                name = f.get("name") or f.get("key") or ""
                value = values.get(name)
                if not value or f.get("type") == "image":
                    continue

                pos = f.get("position") or []
                if len(pos) < 2:
                    continue
                x_mm, y_mm = float(pos[0]), float(pos[1])
                size = float(f.get("size") or 9.0)
                align = f.get("align", "left")

                # 체크박스는 오프셋 적용 (프론트 렌더와 동일 규칙)
                is_checkbox = _is_checkbox_name(name)
                if is_checkbox and value == "V":
                    x_mm += _CHECKBOX_X_OFFSET_MM
                    y_mm += _CHECKBOX_Y_OFFSET_MM
                    size = _CHECKBOX_FONT_SIZE

                # mm → pt (PyMuPDF는 top-origin)
                x_pt = x_mm * _PT_PER_MM
                y_pt = page.rect.height - y_mm * _PT_PER_MM

                # 실제 폰트로 폭 측정 → 우측/중앙 정렬 정확히
                text_width_pt = korean_font.text_length(str(value), fontsize=size)

                # 긴 텍스트 자동 줄바꿈: 셀 폭 감지 후 textbox로 렌더
                # 자동 생성 표 셀이거나, 텍스트 길거나, multiline 지정이면 자동 wrap
                is_auto_cell = bool(f.get("auto_generated"))
                is_long = (is_auto_cell
                           or text_width_pt > 60
                           or f.get("multiline") is True)
                if is_long:
                    # 셀 폭 추정: PyMuPDF find_tables()로 앵커 위치의 셀 폭 감지
                    cell_width_pt = None
                    try:
                        tables = list(page.find_tables())
                        for t in tables:
                            for row in t.rows:
                                for cb in (row.cells or []):
                                    if not cb:
                                        continue
                                    if (cb[0] <= x_pt <= cb[2]
                                            and cb[1] <= y_pt <= cb[3]):
                                        cell_width_pt = cb[2] - cb[0] - 4  # 4pt 여백
                                        cell_top = cb[1] + 2
                                        cell_bottom = cb[3] - 2
                                        break
                                if cell_width_pt:
                                    break
                            if cell_width_pt:
                                break
                    except Exception:
                        pass
                    # 셀 못 찾으면 페이지 우측까지 여백 남기고 wrap
                    if not cell_width_pt:
                        cell_width_pt = page.rect.width - x_pt - 20
                        cell_top = y_pt - size
                        cell_bottom = y_pt + size * 6   # 6줄 예상
                    rect = fitz.Rect(x_pt, cell_top, x_pt + cell_width_pt, cell_bottom)
                    page.insert_textbox(
                        rect,
                        str(value),
                        fontsize=size,
                        fontfile=_KOREAN_FONT_PATH,
                        fontname="malgun",
                        color=(0, 0, 0),
                        align=fitz.TEXT_ALIGN_LEFT,
                    )
                else:
                    # 짧은 텍스트: 정렬 오프셋 후 한 줄 렌더
                    if align == "right":
                        x_pt -= text_width_pt
                    elif align in ("middle", "center"):
                        x_pt -= text_width_pt / 2
                    page.insert_text(
                        (x_pt, y_pt),
                        str(value),
                        fontsize=size,
                        fontfile=_KOREAN_FONT_PATH,
                        fontname="malgun",
                        color=(0, 0, 0),
                    )

        buf = io.BytesIO()
        doc.save(buf, garbage=4, deflate=True)   # garbage collection + 압축
        return buf.getvalue()
    finally:
        doc.close()


class FormRenderRequest(BaseModel):
    fields: dict   # {필드 이름: 값}


def _render_debug_pdf(pdf_source_path: str, field_mappings) -> bytes:
    """서식 PDF 위에 필드 위치를 색깔 박스로 시각화.

    - 팀 좌표: 파란 박스 (원본)
    - 자동 생성 (앵커 확장/표 감지): 빨간 박스
    - 각 박스에 필드명 라벨
    - 개발·디버그·정확도 확인용
    """
    import fitz
    if not os.path.exists(_KOREAN_FONT_PATH):
        raise HTTPException(500, "한글 폰트를 찾을 수 없습니다.")

    doc = fitz.open(pdf_source_path)
    try:
        pages = field_mappings if (field_mappings and isinstance(field_mappings, list)
                                    and isinstance(field_mappings[0], list)) \
                                else [field_mappings or []]
        for pi, page in enumerate(doc):
            if pi >= len(pages):
                break
            for f in pages[pi]:
                if not isinstance(f, dict):
                    continue
                pos = f.get("position") or []
                if len(pos) < 2:
                    continue
                x_mm, y_mm = float(pos[0]), float(pos[1])
                x_pt = x_mm * _PT_PER_MM
                y_pt = page.rect.height - y_mm * _PT_PER_MM

                # 자동 생성 여부에 따라 색상 선택
                is_auto = bool(f.get("auto_generated"))
                color = (0.9, 0, 0) if is_auto else (0, 0.3, 0.9)  # 빨강 or 파랑

                # 필드 박스 크기: 이름 폭 만큼 + 여백
                name = f.get("name") or f.get("key") or ""
                # 폰트 폭 측정
                font = fitz.Font(fontfile=_KOREAN_FONT_PATH)
                label_width = font.text_length(name[:20], fontsize=6)
                box_w = max(20, min(label_width + 6, 120))
                box_h = 10

                rect = fitz.Rect(x_pt - 1, y_pt - box_h + 2, x_pt + box_w, y_pt + 2)
                page.draw_rect(rect, color=color, width=0.5, fill=None)

                # 좌표점 자체를 작은 점으로 표시
                page.draw_circle((x_pt, y_pt), 1.5, color=color, fill=color)

                # 라벨 (필드명)
                label = name[:20] + ("..." if len(name) > 20 else "")
                page.insert_text(
                    (x_pt + 2, y_pt - 1),
                    label,
                    fontsize=5,
                    fontfile=_KOREAN_FONT_PATH,
                    fontname="malgun",
                    color=color,
                )

        buf = io.BytesIO()
        doc.save(buf, garbage=4, deflate=True)
        return buf.getvalue()
    finally:
        doc.close()


@router.get("/templates/{template_id}/debug-preview")
async def debug_preview(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """서식의 모든 필드 위치를 색깔 박스로 시각화한 디버그 PDF 반환.

    - 파란 박스 + 라벨: 팀이 직접 찍은 좌표
    - 빨간 박스 + 라벨: PyMuPDF/pdfplumber 자동 확장 좌표
    - 좌표점 자체는 작은 원으로 표시
    - 발표·QA·좌표 정확도 확인용
    """
    tpl = await db.get(models.FormTemplate, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail="서식을 찾을 수 없습니다.")

    pdf_full = FORMS_DIR / Path(tpl.pdf_url or "").name
    if not pdf_full.exists() or not pdf_full.is_file():
        raise HTTPException(status_code=404, detail="서식 파일이 없습니다.")

    # 자동 확장까지 병합된 field_mappings 사용
    fm = svc._generate_table_cell_fields(tpl.field_mappings or [], str(pdf_full))
    pdf_bytes = _render_debug_pdf(str(pdf_full), fm)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{tpl.name}_debug.pdf"',
        },
    )


@router.post("/templates/{template_id}/render")
async def render_form_pdf(
    template_id: int,
    payload: FormRenderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """서식 PDF에 값을 백엔드에서 픽셀 정확히 렌더해 다운로드 스트림 반환.

    - `fields`에 이름→값 dict 전달 (프론트가 사용자 편집 반영된 최종 값)
    - 서버가 원본 PDF에 Malgun Gothic으로 렌더 후 bytes로 응답
    - 프론트는 다운로드 UI에 바로 연결 (Blob 저장)
    """
    tpl = await db.get(models.FormTemplate, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail="서식을 찾을 수 없습니다.")

    pdf_full = FORMS_DIR / Path(tpl.pdf_url or "").name
    if not pdf_full.exists() or not pdf_full.is_file():
        raise HTTPException(status_code=404, detail="서식 파일이 없습니다.")

    # 자동 표 셀 병합된 metadata 사용 (사용자가 채운 표 셀 값도 렌더에 포함)
    fm = svc._generate_table_cell_fields(tpl.field_mappings or [], str(pdf_full))

    pdf_bytes = _render_filled_pdf(str(pdf_full), fm, payload.fields)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{tpl.name}_filled.pdf"',
        },
    )


@router.post("/fill", response_model=schemas.FormFillResponse)
async def fill_form(
    payload: schemas.FormFillRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """AI가 서식 필드값을 채워 반환. 좌표는 건드리지 않음.

    - chat_session_id 있으면 본인 세션이어야 함 (컨텍스트 로드).
    - 자동 필드(성명·연락처 등 auto_fill_from='user.name'/'user.phone')는
      LLM이 뭘 뱉든 서버가 current_user 값으로 강제 덮어쓴다.
    """
    tpl = await db.get(models.FormTemplate, payload.template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail="서식을 찾을 수 없습니다.")

    # 세션 컨텍스트 (선택)
    session_messages = None
    if payload.chat_session_id is not None:
        sess = await db.get(models.ChatSession, payload.chat_session_id)
        if not sess or sess.user_id != current_user.user_id:
            raise HTTPException(status_code=400, detail="유효하지 않은 채팅 세션입니다.")
        msgs = sess.messages
        if isinstance(msgs, list):
            session_messages = msgs

    # 실제 PDF가 있으면 좌표 근처 텍스트를 LLM 힌트에 포함 → 필드 컨텍스트↑
    # 파일 없으면 None으로 넘겨 힌트 없이 진행 (안전).
    pdf_full = None
    if tpl.pdf_url:
        candidate = FORMS_DIR / Path(tpl.pdf_url).name
        if candidate.exists() and candidate.is_file():
            pdf_full = str(candidate)

    # 표 격자 감지로 자동 생성된 셀도 LLM이 볼 수 있게 병합
    fm_with_cells = svc._generate_table_cell_fields(tpl.field_mappings or [], pdf_full)

    template_dict = {
        "name": tpl.name,
        "description": tpl.description,
        "field_mappings": fm_with_cells,
        "summary": tpl.summary,
    }
    user_context = {
        "name": current_user.name,
        "phone": current_user.phone,
    }

    fields, message = await svc.fill_form_fields(
        template=template_dict,
        user_message=payload.user_message,
        session_messages=session_messages,
        current_fields=payload.current_fields,
        user_context=user_context,
        pdf_path=pdf_full,
    )

    # 렌더용 필드 생성 — 체크박스 오프셋 + align 자동 조정 + 값 포함
    # 프론트는 이걸 그대로 좌측 정렬로 그리면 완벽하게 정렬됨.
    rendered_pages = _auto_adjust_field_mappings(fm_with_cells)
    rendered_pages = _apply_render_adjustments(rendered_pages, fields)
    # 값 필드 병합 (name → value)
    def _attach_value(f):
        if not isinstance(f, dict):
            return f
        out = dict(f)
        name = out.get("name") or out.get("key")
        v = fields.get(name)
        if v is not None:
            out["value"] = v
        return out

    if rendered_pages and isinstance(rendered_pages, list) \
            and rendered_pages and isinstance(rendered_pages[0], list):
        rendered_fields = [[_attach_value(f) for f in page] for page in rendered_pages]
    else:
        rendered_fields = [_attach_value(f) for f in (rendered_pages or [])]

    return {
        "template_id": payload.template_id,
        "fields": fields,
        "message": message,
        "rendered_fields": rendered_fields,
    }
