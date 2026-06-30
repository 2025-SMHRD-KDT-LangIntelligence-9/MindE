"""
DB 연결을 담당하는 파일.
- 엔진(engine): DB와 통신하는 핵심 객체
- 세션(session): 실제 쿼리를 주고받는 단위 (요청마다 하나씩 생성/정리)
- Base: 모든 테이블 모델이 상속받는 부모 클래스

접속 정보는 .env 에 항목별(DB_USER, DB_PASSWORD ...)로 두고,
여기서 안전하게 조립합니다. (비밀번호에 @ : / 같은 특수문자가 있어도 자동 처리)
"""
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import DeclarativeBase

# .env 파일에서 환경변수를 읽어옴
load_dotenv()

# 접속 정보를 항목별로 읽음
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# 하나라도 빠지면 명확히 알려주고 멈춤
_missing = [k for k, v in {
    "DB_USER": DB_USER,
    "DB_PASSWORD": DB_PASSWORD,
    "DB_HOST": DB_HOST,
    "DB_PORT": DB_PORT,
    "DB_NAME": DB_NAME,
}.items() if not v]
if _missing:
    raise RuntimeError(f".env 에 다음 값이 설정되지 않았습니다: {', '.join(_missing)}")

# 사용자명·비밀번호의 특수문자를 URL 안전하게 변환 (@ -> %40 등)
_user = quote_plus(DB_USER)
_password = quote_plus(DB_PASSWORD)

DATABASE_URL = (
    f"postgresql+asyncpg://{_user}:{_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# echo=True 로 두면 실행되는 SQL이 콘솔에 찍혀서 개발 중 디버깅이 편함
# TODO(발표 직전): echo=False 로 변경 → 콘솔 로그 깔끔
engine = create_async_engine(DATABASE_URL, echo=False)

# 세션 팩토리: get_db()에서 이걸로 세션을 하나씩 찍어냄
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """모든 모델(테이블)이 상속받는 기반 클래스."""
    pass


async def get_db():
    """
    엔드포인트에서 Depends(get_db)로 주입받아 사용.
    요청이 끝나면 세션이 자동으로 닫힘.
    """
    async with AsyncSessionLocal() as session:
        yield session
