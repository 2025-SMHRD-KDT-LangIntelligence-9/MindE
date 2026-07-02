"""민원 양식(Form) CRUD.

- GET  /forms          — 전체 목록 (로그인 사용자면 조회 가능)
- GET  /forms/{id}     — 단건
- POST /forms          — admin만
- PATCH /forms/{id}    — admin만
- DELETE /forms/{id}   — admin만
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, get_current_admin
import models
import schemas

router = APIRouter(prefix="/forms", tags=["forms"])


@router.get("", response_model=list[schemas.FormOut])
async def list_forms(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Form).order_by(models.Form.form_id.asc())
    )
    return result.scalars().all()


@router.get("/{form_id}", response_model=schemas.FormOut)
async def get_form(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    form = await db.get(models.Form, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    return form


@router.post("", response_model=schemas.FormOut, status_code=201)
async def create_form(
    payload: schemas.FormCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    form = models.Form(
        name=payload.name,
        description=payload.description,
        fields=[f.model_dump() for f in payload.fields],
    )
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return form


@router.patch("/{form_id}", response_model=schemas.FormOut)
async def update_form(
    form_id: int,
    payload: schemas.FormUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    form = await db.get(models.Form, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    if payload.name is not None:
        form.name = payload.name
    if payload.description is not None:
        form.description = payload.description
    if payload.fields is not None:
        form.fields = [f.model_dump() for f in payload.fields]
    await db.commit()
    await db.refresh(form)
    return form


@router.delete("/{form_id}", status_code=204)
async def delete_form(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    form = await db.get(models.Form, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    await db.delete(form)
    await db.commit()
    return
