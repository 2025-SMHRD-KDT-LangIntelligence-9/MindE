-- v4 마이그레이션: 민원 양식 테이블
CREATE TABLE IF NOT EXISTS forms (
    form_id      BIGSERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    fields       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);
