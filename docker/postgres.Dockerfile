# postgres.Dockerfile
# PostgreSQL 데이터베이스 서비스용 Dockerfile입니다.
# TODO: pgvector extension 설치 및 초기화 스크립트 추가

FROM postgres:16

# TODO: database/schema의 SQL 파일들을 /docker-entrypoint-initdb.d/ 로 복사하여 초기화
