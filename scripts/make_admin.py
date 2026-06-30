"""
첫 관리자(admin) 계정의 비밀번호 해시를 생성하는 일회용 스크립트.

사용법:
  1. (venv 활성화된 상태에서) python scripts/make_admin.py 실행
  2. 출력된 INSERT SQL을 DBeaver에서 실행
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ↓ 여기 세 가지 값을 본인 정보로 수정하세요
ADMIN_NAME = "관리자"
ADMIN_EMAIL = "admin@minde.go.kr"
ADMIN_PASSWORD = "admin1234"   # ← 원하는 비밀번호로 바꾸세요

password_hash = pwd_context.hash(ADMIN_PASSWORD)

print("=" * 70)
print("DBeaver에서 아래 SQL을 실행하세요:")
print("=" * 70)
print(f"""
INSERT INTO users (name, email, phone, password_hash, user_type, notification_enabled)
VALUES (
  '{ADMIN_NAME}',
  '{ADMIN_EMAIL}',
  NULL,
  '{password_hash}',
  'admin',
  TRUE
);
""")
print("=" * 70)
print(f"로그인 정보:  이메일={ADMIN_EMAIL}  /  비밀번호={ADMIN_PASSWORD}")
print("=" * 70)
