-- v2 마이그레이션: 프론트 명세 반영
-- 1. complaints: 담당자 메모, 수정 일시
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- 2. notifications: 읽음 상태
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. users: 담당자 소속 부서
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(department_id);
