-- v3 마이그레이션: 채팅 세션 테이블 추가
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id  BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id),
    title       VARCHAR(200) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, created_at DESC);
