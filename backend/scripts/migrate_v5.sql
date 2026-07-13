-- v5 마이그레이션: 첨부파일 크기 + 업로더 식별
ALTER TABLE complaint_attachments
    ADD COLUMN IF NOT EXISTS file_size BIGINT,
    ADD COLUMN IF NOT EXISTS uploaded_by BIGINT REFERENCES users(user_id);

-- 기존 첨부는 민원 소유자가 업로드한 것으로 간주하여 backfill
UPDATE complaint_attachments a
SET uploaded_by = c.user_id
FROM complaints c
WHERE a.complaint_id = c.complaint_id AND a.uploaded_by IS NULL;
