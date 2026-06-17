# security.py
# 인증/인가, 비밀번호 해싱, JWT 토큰 처리 관련 모듈입니다.
# TODO: JWT 토큰 생성/검증 함수, 비밀번호 해싱 함수 구현

def hash_password(password: str) -> str:
    """비밀번호 해싱 함수 (구현 예정)"""
    raise NotImplementedError


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증 함수 (구현 예정)"""
    raise NotImplementedError
