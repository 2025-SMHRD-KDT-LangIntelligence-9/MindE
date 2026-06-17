# config.py
# 애플리케이션 환경설정(환경변수 등)을 관리하는 파일입니다.
# TODO: pydantic-settings를 이용한 .env 값 로딩 구현

class Settings:
    """환경설정 값을 담는 클래스 (추후 pydantic BaseSettings로 교체 예정)"""

    APP_NAME: str = "마음결 AI 민원 상담 플랫폼"
    # TODO: DATABASE_URL, OPENAI_API_KEY 등 환경변수 추가


settings = Settings()
