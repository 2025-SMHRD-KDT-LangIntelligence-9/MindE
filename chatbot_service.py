"""마음이 민원 챗봇 서비스 모듈

백엔드(FastAPI 등)에서 import해서 바로 호출하는 비즈니스 로직.
MCP 서버(mcp_server.py)도 이 모듈을 import해서 같은 함수를 노출.

함수 7개:
  - classify_complaint(text, top_k=3)            → 카테고리 분류
  - check_urgency(text)                          → 긴급 여부
  - search_laws(query, category_id=None, limit=5)→ 법령 RAG
  - search_cases(query, category_id=None, limit=5)→ 사례 RAG
  - search_faq(query, limit=5)                   → FAQ RAG
  - lookup_dept_by_category(category_id)         → 카테고리 → 부서 매핑
  - get_categories()                             → 11 카테고리 메타 정보

모두 sync 함수. async 사용 시 asyncio.to_thread()로 감싸면 됨.
모든 반환은 plain dict/list (JSON-safe).

환경변수:
  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB  → DB 연결
  CLASSIFIER_DIR, URGENCY_DIR, EMBED_MODEL       → 모델 경로 오버라이드 (선택)
"""
import os
import re
from pathlib import Path
from typing import Optional

# .env 자동 로드 (있으면)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / '.env')
except ImportError:
    pass  # python-dotenv 없으면 os.environ만 사용

# ===== 환경 설정 =====
ROOT = Path(__file__).parent
CLASSIFIER_DIR = Path(os.environ.get('CLASSIFIER_DIR', ROOT / 'models' / 'bert-v9' / 'final'))
URGENCY_DIR = Path(os.environ.get('URGENCY_DIR', ROOT / 'models' / 'urgency-bert' / 'final'))
EMBED_MODEL_NAME = os.environ.get('EMBED_MODEL', 'BM-K/KoSimCSE-roberta')

DB_CONFIG = dict(
    host=os.environ.get('PG_HOST', 'project-db-campus.smhrd.com'),
    port=int(os.environ.get('PG_PORT', '3310')),
    user=os.environ.get('PG_USER', 'mp_24k_li9_p3_3'),
    password=os.environ.get('PG_PASSWORD', ''),
    dbname=os.environ.get('PG_DB', 'mp_24k_li9_p3_3'),
    connect_timeout=15,
)

# 마스킹 토큰 정규화 (학습 시와 동일)
_MASK_REPLACEMENTS = [
    (re.compile(r'#@주소@?\s?#'),          '[ADDR]'),
    (re.compile(r'#@번호@?#'),             '[NUM]'),
    (re.compile(r'#@이름#'),               '[NAME]'),
    (re.compile(r'#@소속#'),               '[ORG]'),
    (re.compile(r'#@전번#'),               '[TEL]'),
    (re.compile(r'#@계정#'),               '[ACCT]'),
    (re.compile(r'#@상호명?#'),            '[BIZ]'),
    (re.compile(r'#@(?:장소|주차|위치)#'), '[LOC]'),
    (re.compile(r'#@신원#'),               '[PERSON]'),
    (re.compile(r'#@[^#]+#'),              '[UNK]'),
]

_URGENCY_EXCLUDE_RE = re.compile(
    r'예방|대비|우려가\s*있|안내|방법\s*알려|절차|신고\s*방법|문의\s*드|어떻게\s*해|어디로\s*신고'
)


# ===== 싱글톤 캐시 =====
_classifier = None
_urgency = None
_db_conn = None
_embed_model = None
_urgent_keywords = None
_category_map = None


def _normalize_text(text: str) -> str:
    for pat, repl in _MASK_REPLACEMENTS:
        text = pat.sub(repl, text)
    return text


def _get_classifier():
    global _classifier
    if _classifier is None:
        from classifier import ComplaintClassifier
        _classifier = ComplaintClassifier(model_dir=str(CLASSIFIER_DIR))
    return _classifier


def _get_urgency():
    global _urgency
    if _urgency is None:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        tokenizer = AutoTokenizer.from_pretrained(str(URGENCY_DIR))
        model = AutoModelForSequenceClassification.from_pretrained(str(URGENCY_DIR))
        model.to(device).eval()
        _urgency = {'tokenizer': tokenizer, 'model': model, 'device': device}
    return _urgency


def _get_db():
    """psycopg2 connection (singleton, ping fail 시 재연결)."""
    global _db_conn
    import psycopg2
    from pgvector.psycopg2 import register_vector
    if _db_conn is not None:
        try:
            with _db_conn.cursor() as c:
                c.execute('SELECT 1')
            return _db_conn
        except Exception:
            try: _db_conn.close()
            except Exception: pass
            _db_conn = None
    _db_conn = psycopg2.connect(**DB_CONFIG)
    register_vector(_db_conn)
    return _db_conn


def _get_embed():
    global _embed_model
    if _embed_model is None:
        import torch
        from sentence_transformers import SentenceTransformer
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME, device=device)
    return _embed_model


def _get_category_map() -> dict:
    """name → category_id"""
    global _category_map
    if _category_map is None:
        conn = _get_db()
        with conn.cursor() as c:
            c.execute('SELECT category_id, name FROM categories ORDER BY category_id')
            _category_map = {name: int(cid) for cid, name in c.fetchall()}
    return _category_map


def _get_urgent_keywords() -> list:
    global _urgent_keywords
    if _urgent_keywords is None:
        conn = _get_db()
        with conn.cursor() as c:
            c.execute("SELECT keyword, COALESCE(category_id, 0), weight FROM urgency_keywords ORDER BY weight DESC")
            _urgent_keywords = [
                {'keyword': k, 'category_id': cid or None, 'weight': float(w)}
                for k, cid, w in c.fetchall()
            ]
    return _urgent_keywords


# ============================================================
# Public API
# ============================================================

def get_categories() -> list[dict]:
    """11개 카테고리 메타 정보.

    Returns:
        [{'category_id': 1, 'name': '교통'}, ...] (11개)
    """
    conn = _get_db()
    with conn.cursor() as c:
        c.execute('SELECT category_id, name FROM categories ORDER BY category_id')
        return [{'category_id': int(cid), 'name': name} for cid, name in c.fetchall()]


def classify_complaint(text: str, top_k: int = 3) -> dict:
    """민원 텍스트를 11개 카테고리 중 가장 적합한 것으로 분류.

    Args:
        text: 민원 본문 (한글, 평균 70자 권장)
        top_k: 반환할 후보 수 (1~11)

    Returns:
        {
          'category': '교통',
          'category_id': 1,
          'confidence': 0.97,
          'top_k': [{'category': '교통', 'category_id': 1, 'confidence': 0.97}, ...]
        }

    예시 입력:
        "집 앞에 차가 자꾸 불법주차해서 너무 불편합니다."
    """
    text = (text or '').strip()
    if not text:
        return {'category': None, 'category_id': None, 'confidence': 0.0, 'top_k': []}

    clf = _get_classifier()
    r = clf.predict(text, top_k=top_k)
    cat_map = _get_category_map()
    return {
        'category': r.get('category'),
        'category_id': cat_map.get(r.get('category')),
        'confidence': round(float(r.get('confidence', 0.0)), 4),
        'top_k': [
            {
                'category': c,
                'category_id': cat_map.get(c),
                'confidence': round(float(s), 4),
            }
            for c, s in r.get('top_k', [])
        ],
    }


def check_urgency(text: str) -> dict:
    """민원의 긴급 여부 판정.

    KLUE BERT 이진 분류기 + DB 키워드 매칭 + 예외룰.
    is_urgent=True면 즉시 119/112/안전신문고 우선 안내 권장.

    Args:
        text: 민원 본문

    Returns:
        {
          'is_urgent': True/False,
          'probability_urgent': 0.95,
          'probability_normal': 0.05,
          'matched_keyword': '가스누출',
          'all_matched_keywords': ['가스누출', '연기'],
          'rule_excluded': False    # 예방·안내·문의 등 단어로 긴급에서 제외됨
        }
    """
    import torch
    text = (text or '').strip()
    if not text:
        return {'is_urgent': False, 'probability_urgent': 0.0, 'probability_normal': 1.0,
                'matched_keyword': '', 'all_matched_keywords': [], 'rule_excluded': False}

    urg = _get_urgency()
    enc = urg['tokenizer'](text, return_tensors='pt', truncation=True, max_length=128, padding=True)
    enc = {k: v.to(urg['device']) for k, v in enc.items()}
    with torch.no_grad():
        logits = urg['model'](**enc).logits
    probs = torch.softmax(logits, dim=-1).squeeze().tolist()
    is_urgent_model = bool(probs[1] > 0.5)

    matched = [kw for kw in _get_urgent_keywords() if kw['keyword'] in text]
    matched_keyword = matched[0]['keyword'] if matched else ''
    rule_excluded = bool(matched_keyword and _URGENCY_EXCLUDE_RE.search(text))

    return {
        'is_urgent': is_urgent_model and not rule_excluded,
        'probability_urgent': round(probs[1], 4),
        'probability_normal': round(probs[0], 4),
        'matched_keyword': matched_keyword,
        'all_matched_keywords': [m['keyword'] for m in matched],
        'rule_excluded': rule_excluded,
    }


def _search_rag(query: str, source_type: str, category_id: Optional[int] = None, limit: int = 5) -> list[dict]:
    """공통 RAG 벡터 검색 (pgvector cosine)."""
    import numpy as np
    query = (query or '').strip()
    if not query:
        return []
    qv = _get_embed().encode(query, normalize_embeddings=True).astype(np.float32)
    conn = _get_db()
    sql = """
        SELECT document_id, title, content, category_id,
               1 - (embedding <=> %s::vector) AS similarity
        FROM rag_documents
        WHERE source_type=%s AND embedding IS NOT NULL
    """
    params = [qv.tolist(), source_type]
    if category_id is not None:
        sql += ' AND category_id=%s'
        params.append(category_id)
    sql += ' ORDER BY embedding <=> %s::vector LIMIT %s'
    params.extend([qv.tolist(), max(1, min(20, limit))])
    with conn.cursor() as c:
        c.execute(sql, params)
        rows = c.fetchall()
    return [
        {
            'document_id': int(r[0]),
            'title': r[1],
            'content': r[2][:500] + ('...' if len(r[2]) > 500 else ''),
            'category_id': r[3],
            'similarity': round(float(r[4]), 4),
        }
        for r in rows
    ]


def search_laws(query: str, category_id: Optional[int] = None, limit: int = 5) -> list[dict]:
    """관련 법령 조항 검색 (벡터 유사도).

    26개 법령(민원처리법/도로교통법/건축법/세무법/주민등록법 등)에서 조항 단위로 검색.

    Args:
        query: 검색 질의
        category_id: 카테고리 필터 (선택, 1~11)
        limit: 반환 수 (1~20, 기본 5)

    Returns:
        [
          {
            'document_id': 3617,
            'title': '도로교통법 제17조(자동차등과 노면전차의 속도)',
            'content': '① 자동차등...',
            'category_id': 1,
            'similarity': 0.587   # 코사인 유사도 (0~1, 높을수록 유사)
          },
          ...
        ]
    """
    return _search_rag(query, 'law', category_id, limit)


def search_cases(query: str, category_id: Optional[int] = None, limit: int = 5) -> list[dict]:
    """국민신문고 유사 사례 검색 (질문+답변).

    크롤링한 epeople 사례에서 의미적으로 비슷한 민원 + 공식 답변을 반환.
    답변 작성 시 "이런 비슷한 민원은 이렇게 처리했습니다" 참조용.

    Args, Returns: search_laws와 동일 구조.
    """
    return _search_rag(query, 'case', category_id, limit)


def search_faq(query: str, limit: int = 5) -> list[dict]:
    """교육부 FAQ 검색.

    교육 카테고리 민원(학교/저작권/입시 등) 답변용. category_id 필터 없음.

    Args, Returns: search_laws와 동일 구조 (단 category_id 인자 없음).
    """
    return _search_rag(query, 'faq', None, limit)


def lookup_dept_by_category(category_id: int) -> list[dict]:
    """카테고리에 매핑된 처리 부서를 priority 순으로 반환.

    Args:
        category_id: 1~11

    Returns:
        [
          {'department_id': 1, 'name': '교통행정과', 'email': None, 'phone': None, 'priority': 1},
          {'department_id': 2, 'name': '도로정책과', 'email': None, 'phone': None, 'priority': 2},
        ]
    """
    conn = _get_db()
    with conn.cursor() as c:
        c.execute("""
            SELECT d.department_id, d.name, d.contact_email, d.contact_phone, m.priority
            FROM category_department_mapping m
            JOIN departments d ON d.department_id=m.department_id
            WHERE m.category_id=%s
            ORDER BY m.priority
        """, (category_id,))
        return [
            {'department_id': int(r[0]), 'name': r[1], 'email': r[2], 'phone': r[3], 'priority': int(r[4])}
            for r in c.fetchall()
        ]


# ============================================================
# Smoke test (수동 실행용)
# ============================================================
if __name__ == '__main__':
    import json, sys
    sys.stdout.reconfigure(encoding='utf-8')

    print('=== chatbot_service smoke test ===\n')

    print('[get_categories]')
    cats = get_categories()
    print(f'  {len(cats)}개')
    for c in cats[:3]:
        print(f'  {c}')

    print('\n[classify_complaint]')
    r = classify_complaint('집 앞 도로 포트홀 신고합니다', top_k=3)
    print(f'  {r["category"]} (id={r["category_id"]}, conf={r["confidence"]})')

    print('\n[check_urgency]')
    r = check_urgency('아파트에서 가스누출이 발생했습니다 위험합니다')
    print(f'  is_urgent={r["is_urgent"]} kw={r["matched_keyword"]}')

    print('\n[search_laws]')
    for d in search_laws('주차금지 어디까지', category_id=1, limit=3):
        print(f'  sim={d["similarity"]} | {d["title"][:50]}')

    print('\n[lookup_dept_by_category(1)]')
    for d in lookup_dept_by_category(1):
        print(f'  pri={d["priority"]} | {d["name"]}')
