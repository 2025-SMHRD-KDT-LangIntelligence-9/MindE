-- complaint.sql
-- 민원(complaint) 테이블 스키마입니다.
-- TODO: 실제 컬럼(제목, 내용, 상태, 작성자, 부서, 생성일 등) 정의

CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY
    -- TODO: title, content, status, created_at 등 컬럼 추가
);
