-- v6 마이그레이션: 민원 ↔ 원본 채팅 세션 연결
-- 챗봇 대화 끝에 접수한 민원의 원본 세션 ID를 기록해
-- 담당자가 "원본 대화 보기"로 맥락을 확인할 수 있게 한다.
ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS chat_session_id BIGINT
        REFERENCES chat_sessions(session_id) ON DELETE SET NULL;

-- 담당자 대시보드 조회 최적화 (선택)
CREATE INDEX IF NOT EXISTS idx_complaints_chat_session_id
    ON complaints(chat_session_id)
    WHERE chat_session_id IS NOT NULL;
