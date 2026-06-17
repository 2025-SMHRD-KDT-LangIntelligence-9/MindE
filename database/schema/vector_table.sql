-- vector_table.sql
-- RAG용 벡터 임베딩 저장 테이블 스키마입니다.
-- TODO: pgvector extension 활성화 및 임베딩 컬럼 정의

-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY
    -- TODO: document_id, embedding(vector 타입), content 등 컬럼 추가
);
