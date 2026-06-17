# vector_store.py
# 벡터 데이터베이스 연결 및 저장/조회를 담당하는 모듈입니다.
# TODO: pgvector 또는 다른 벡터 DB 연결 및 CRUD 로직 구현

def save_vector(document_id: str, embedding: list):
    """임베딩 벡터를 저장하는 함수 (구현 예정)"""
    raise NotImplementedError


def search_vector(query_embedding: list, top_k: int = 5):
    """유사 벡터를 검색하는 함수 (구현 예정)"""
    raise NotImplementedError
