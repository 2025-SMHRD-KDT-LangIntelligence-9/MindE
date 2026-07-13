-- v8 마이그레이션: 민원 서식 자동 작성 (AI 채우기)
-- 서식 PDF + 좌표 매핑을 DB에서 관리.
-- 좌표는 render 용, LLM 프롬프트에는 컨텍스트 힌트로만 전달 (값만 반환).
CREATE TABLE IF NOT EXISTS form_templates (
    form_template_id BIGSERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    pdf_url          TEXT NOT NULL,        -- uploads/forms/xxx.pdf 상대경로
    field_mappings   JSONB NOT NULL,       -- [{key, label?, x, y, width?, height?, font_size?, multiline?, auto_fill_from?, ...}]
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_templates_active
    ON form_templates(is_active)
    WHERE is_active = TRUE;
