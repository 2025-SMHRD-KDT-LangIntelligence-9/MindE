-- v7 마이그레이션: 카테고리 ↔ 대표 부서 직접 연결
-- 관리자 화면에서 카테고리별 담당 부서를 1:1로 지정할 수 있게 한다.
-- (기존 category_department_mapping 다대다는 챗봇 부서 검색용으로 그대로 유지)
ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS department_id BIGINT
        REFERENCES departments(department_id) ON DELETE SET NULL;

-- 관리자 UI 조회 최적화 (대부분 NULL로 남을 수 있으니 부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_categories_department_id
    ON categories(department_id)
    WHERE department_id IS NOT NULL;
