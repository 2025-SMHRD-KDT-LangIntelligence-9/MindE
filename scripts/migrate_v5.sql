-- v5 마이그레이션: 첨부파일 크기(bytes) 추가
ALTER TABLE complaint_attachments
    ADD COLUMN IF NOT EXISTS file_size BIGINT;
