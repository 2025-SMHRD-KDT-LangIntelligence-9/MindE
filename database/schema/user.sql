-- user.sql
-- 사용자(user) 테이블 스키마입니다.
-- TODO: 실제 컬럼(이메일, 비밀번호, 권한 등) 정의

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY
    -- TODO: email, hashed_password, role 등 컬럼 추가
);
