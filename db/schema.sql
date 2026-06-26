-- ===== 마음이 민원 챗봇 DB 스키마 =====
-- PostgreSQL + pgvector
-- 12개 테이블

CREATE EXTENSION IF NOT EXISTS vector;

-- categories
CREATE TABLE categories (
    category_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    PRIMARY KEY (category_id)
);

-- departments
CREATE TABLE departments (
    department_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    PRIMARY KEY (department_id)
);

-- category_department_mapping
CREATE TABLE category_department_mapping (
    mapping_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (mapping_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- urgency_keywords
CREATE TABLE urgency_keywords (
    keyword_id BIGINT NOT NULL,
    keyword VARCHAR(50) NOT NULL,
    category_id BIGINT,
    weight NUMERIC(3,2) NOT NULL,
    PRIMARY KEY (keyword_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- users
CREATE TABLE users (
    user_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    notification_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

-- complaint_clusters
CREATE TABLE complaint_clusters (
    cluster_id BIGINT NOT NULL,
    representative_content TEXT,
    complaint_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (cluster_id)
);

-- complaints
CREATE TABLE complaints (
    complaint_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    category_id BIGINT,
    assigned_department_id BIGINT,
    cluster_id BIGINT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    urgency_score NUMERIC(4,3) NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (complaint_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (assigned_department_id) REFERENCES departments(department_id),
    FOREIGN KEY (cluster_id) REFERENCES complaint_clusters(cluster_id)
);

-- complaint_responses
CREATE TABLE complaint_responses (
    response_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    referenced_docs JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (response_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- complaint_attachments
CREATE TABLE complaint_attachments (
    attachment_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (attachment_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- complaint_status_history
CREATE TABLE complaint_status_history (
    history_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT now(),
    changed_by BIGINT,
    note TEXT,
    PRIMARY KEY (history_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- notifications
CREATE TABLE notifications (
    notification_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    complaint_id BIGINT,
    channel VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT now(),
    status VARCHAR(10) NOT NULL,
    PRIMARY KEY (notification_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- rag_documents
CREATE TABLE rag_documents (
    document_id BIGINT NOT NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    category_id BIGINT,
    embedding vector(768),
    source_type VARCHAR(20),
    PRIMARY KEY (document_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ===== 시드 데이터 =====

-- 11 카테고리
INSERT INTO categories (category_id, name) VALUES (1, '교통') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (2, '건축') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (3, '행정') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (4, '보건위생') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (5, '환경') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (6, '문화_여가') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (7, '농축산') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (8, '복지') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (9, '세무') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (10, '상하수도') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (11, '경제') ON CONFLICT DO NOTHING;

-- 20 부서
INSERT INTO departments (department_id, name) VALUES (1, '교통행정과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (2, '도로정책과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (3, '건축개발과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (4, '토지관리과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (5, '자치행정과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (6, '총무과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (7, '식품의약과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (8, '감염병관리과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (9, '환경정책과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (10, '기후대기과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (11, '관광과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (12, '스포츠산업과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (13, '농업정책과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (14, '축산정책과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (15, '사회복지과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (16, '노인복지과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (17, '장애인복지과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (18, '세정과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (19, '수자원관리과') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name) VALUES (20, '기반산업과') ON CONFLICT DO NOTHING;

-- 카테고리-부서 매핑
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (1, 1, 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (2, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (3, 2, 4, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (4, 2, 3, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (5, 3, 6, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (6, 3, 5, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (7, 4, 8, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (8, 4, 7, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (9, 5, 10, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (10, 5, 9, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (11, 6, 12, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (12, 6, 11, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (13, 7, 14, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (14, 7, 13, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (15, 8, 17, 3) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (16, 8, 16, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (17, 8, 15, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (18, 9, 18, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (19, 10, 19, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (20, 10, 9, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (21, 11, 20, 1) ON CONFLICT DO NOTHING;

-- 29 긴급 키워드
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (1, '화재', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (2, '폭발음', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (3, '감전', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (4, '매몰', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (5, '깔렸', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (6, '추락', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (7, '떨어졌', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (8, '가스누출', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (9, '가스 누설', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (10, '산사태', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (11, '지진', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (12, '쓰나미', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (13, '방사능', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (14, '독극물', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (15, '화학물질 누출', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (16, '아동학대', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (17, '가정폭력', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (18, '노인학대', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (19, '붕괴', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (20, '무너지', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (21, '무너졌', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (22, '쓰러졌', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (23, '쓰러진', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (24, '전봇대 쓰러', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (25, '토사 무너', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (26, '독성', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (27, '가스냄새', NULL, 0.85) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (28, '연기', NULL, 0.85) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (29, '전선 끊', NULL, 0.85) ON CONFLICT DO NOTHING;

-- 시퀀스 재설정 (시드 데이터 INSERT 후)
SELECT setval(pg_get_serial_sequence('categories', 'category_id'), (SELECT MAX(category_id) FROM categories));
SELECT setval(pg_get_serial_sequence('departments', 'department_id'), (SELECT MAX(department_id) FROM departments));
SELECT setval(pg_get_serial_sequence('category_department_mapping', 'mapping_id'), (SELECT MAX(mapping_id) FROM category_department_mapping));
SELECT setval(pg_get_serial_sequence('urgency_keywords', 'keyword_id'), (SELECT MAX(keyword_id) FROM urgency_keywords));
