-- v4 마이그레이션: 채팅 세션 최근 활동순 정렬 지원
ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
    ON chat_sessions(user_id, updated_at DESC);
