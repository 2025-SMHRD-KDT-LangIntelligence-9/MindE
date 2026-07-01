"""rag_documents의 embedding이 NULL인 행을 KoSimCSE로 임베딩

batch 단위로 처리. GPU 사용 시 5,441 조항 → 약 2분.
재실행 안전: embedding IS NULL인 행만 처리.
"""
import sys
import time
import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
import torch

sys.stdout.reconfigure(encoding='utf-8')

DB = dict(
    host='project-db-campus.smhrd.com', port=3310,
    user='mp_24k_li9_p3_3', password='smhrd3', dbname='mp_24k_li9_p3_3',
    connect_timeout=15,
)
MODEL = 'BM-K/KoSimCSE-roberta'
BATCH = 64
# content를 그대로 임베딩 (조항 본문 평균 200~500자, max_seq_length 512 기본)


def main():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'device: {device}')
    print(f'모델 로딩: {MODEL}')
    model = SentenceTransformer(MODEL, device=device)
    print(f'  dim: {model.get_sentence_embedding_dimension()}')

    conn = psycopg2.connect(**DB)
    register_vector(conn)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM rag_documents WHERE embedding IS NULL")
    todo = cur.fetchone()[0]
    print(f'\nembedding NULL 행: {todo:,}')

    if todo == 0:
        print('처리할 행 없음')
        cur.close(); conn.close()
        return

    processed = 0
    t0 = time.time()

    while True:
        cur.execute("""
            SELECT document_id, content
            FROM rag_documents
            WHERE embedding IS NULL
            ORDER BY document_id
            LIMIT %s
        """, (BATCH,))
        rows = cur.fetchall()
        if not rows:
            break

        ids = [r[0] for r in rows]
        contents = [r[1] for r in rows]
        # 임베딩 (정규화)
        vecs = model.encode(
            contents,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=BATCH,
        ).astype(np.float32)

        # UPDATE batch
        for doc_id, vec in zip(ids, vecs):
            cur.execute(
                'UPDATE rag_documents SET embedding=%s WHERE document_id=%s',
                (vec, doc_id),
            )
        conn.commit()

        processed += len(rows)
        elapsed = time.time() - t0
        rate = processed / elapsed if elapsed > 0 else 0
        eta = (todo - processed) / rate if rate > 0 else 0
        print(f'  {processed:,}/{todo:,}  ({rate:.1f}/s, ETA {eta:.0f}s)')

    print(f'\n완료. 소요 {time.time()-t0:.1f}s')
    cur.close(); conn.close()


if __name__ == '__main__':
    main()
