-- v9 마이그레이션: 서식 자동 채움 정확도 개선 — 사전 요약 저장
-- 서식 등록 시 1회만 LLM으로 PDF 전문을 요약해 저장 →
-- 매 요청 프롬프트에 서식 큰 그림을 부담 없이 제공.
ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS summary TEXT;
