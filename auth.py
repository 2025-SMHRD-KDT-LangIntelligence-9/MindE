"""
인증(JWT) 및 권한(role) 관련 공통 로직.

- create_access_token(): 로그인 성공 시 토큰을 발급
- get_current_user(): 요청에 담긴 토큰을 검증하고, 그 주인(User)을 찾아 돌려줌
  → 엔드포인트에서 Depends(get_current_user)로 주입받으면 '로그인한 사용자'를 바로 사용 가능
- get_current_staff(): 담당자(staff) 또는 관리자(admin)만 통과
- get_current_admin(): 관리자(admin)만 통과
"""
import os
from datetime import datetime, timedelta, timezone

import jwt  # PyJWT
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
import models

# ── 토큰 서명에 쓰는 비밀키 ──────────────────────────────
# 실제로는 .env 에 두고 외부에 노출되면 안 됩니다.
# (없으면 개발용 임시값 사용 — 운영 전 반드시 .env로 옮기세요)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-change-me-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 토큰 유효시간: 24시간

# Swagger에서 자물쇠(Authorize) 버튼이 생기게 해주는 설정.
# tokenUrl은 '토큰을 발급받는 주소' = 로그인 엔드포인트
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


def create_access_token(user_id: int) -> str:
    """user_id를 담은 토큰을 만들어 문자열로 반환."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),   # sub = 토큰의 주인(여기선 user_id)
        "exp": expire,         # exp = 만료 시각
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> models.User:
    """토큰을 검증하고 해당 사용자를 DB에서 찾아 반환. 실패 시 401."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except jwt.PyJWTError:
        # 토큰이 위조됐거나 만료된 경우
        raise credentials_error

    user = await db.get(models.User, int(user_id))
    if user is None:
        raise credentials_error
    return user


async def get_current_staff(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """담당자(staff) 또는 관리자(admin)만 통과. 그 외엔 403."""
    if current_user.user_type not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="담당자 권한이 필요합니다.",
        )
    return current_user


async def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """관리자(admin)만 통과. 그 외엔 403."""
    if current_user.user_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )
    return current_user
