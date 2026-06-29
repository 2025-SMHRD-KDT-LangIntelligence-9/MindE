"""마음이 민원 챗봇 서비스 모듈

백엔드(FastAPI 등)에서 import해서 바로 호출하는 비즈니스 로직.
MCP 서버(mcp_server.py)도 이 모듈을 import해서 같은 함수를 노출.

함수:
  - classify_complaint(text, top_k=3)              → 카테고리 분류
  - check_urgency(text)                            → 긴급 여부
  - match_or_create_cluster(text, threshold=0.75)  → 클러스터 매칭/생성
  - search_laws(query, category_id=None, limit=5)  → 법령 RAG
  - search_cases(query, category_id=None, limit=5) → 사례 RAG
  - search_dept(query, category_id=None, limit=5)  → 부서 의미 검색
  - lookup_dept_by_category(category_id)           → 카테고리 → 부서 매핑
  - get_categories()                               → 11 카테고리 메타
  - answer_chatbot(text, history=None)  [async]    → LLM 답변 생성 (메인 진입점)
  - transcribe_audio(audio_bytes, lang="Kor")  [async] → 음성 → 텍스트 (NAVER CLOVA CSR)
  - synthesize_speech(text, speaker="nara")    [async] → 텍스트 → 음성 mp3 (NAVER CLOVA Voice)
  - analyze_image(image_bytes, mime_type)      [async] → 이미지 → 민원 분석 텍스트 (gpt-4o Vision)

위 함수는 sync (answer_chatbot만 async).
async 환경에서는 asyncio.to_thread()로 sync 함수 감쌈.
모든 반환은 plain dict/list (JSON-safe).

환경변수:
  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB  → DB 연결
  CLASSIFIER_DIR, URGENCY_DIR, EMBED_MODEL       → 모델 경로 오버라이드 (선택)
  OPENAI_API_KEY, OPENAI_MODEL                   → 답변/게이트/키워드 LLM
  NAVER_CLOVA_CLIENT_ID, NAVER_CLOVA_CLIENT_SECRET → STT (transcribe_audio용)
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
import threading
_classifier = None
_urgency = None
_db_conn = None
_embed_model = None
_urgent_keywords = None
_category_map = None
_loader_lock = threading.Lock()  # 모델 lazy load race condition 방지


def _normalize_text(text: str) -> str:
    for pat, repl in _MASK_REPLACEMENTS:
        text = pat.sub(repl, text)
    return text


def _get_classifier():
    global _classifier
    if _classifier is None:
        with _loader_lock:
            if _classifier is None:  # double-checked locking
                from classifier import ComplaintClassifier
                _classifier = ComplaintClassifier(model_dir=str(CLASSIFIER_DIR))
    return _classifier


def _get_urgency():
    global _urgency
    if _urgency is None:
        with _loader_lock:
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
        with _loader_lock:
            if _embed_model is None:
                import torch
                from sentence_transformers import SentenceTransformer
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
                _embed_model = SentenceTransformer(EMBED_MODEL_NAME, device=device)
    return _embed_model


def preload_models():
    """모듈 시작 시 모델 미리 로딩 (서버 startup에서 호출 권장).

    답변 첫 요청에서 race condition 방지 + 응답 지연 제거.
    """
    _get_classifier()
    _get_urgency()
    _get_embed()


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


def search_dept(query: str, category_id: Optional[int] = None, limit: int = 5) -> list[dict]:
    """부서 의미 검색 (담당업무 기반).

    사용자 질문을 부서 description과 매칭.
    category_id를 주면 해당 카테고리에 매핑된 부서들 중에서만 검색 (정밀도 ↑).
    None이면 39개 부서 전체에서 검색 (카테고리 매핑 없는 소방본부/특수기관 포함).

    권장 흐름:
      1. classify_complaint(text) → category_id
      2. search_dept(text, category_id=...) → 그 카테고리 내 부서 정렬

    Args:
        query: 자연어 질의
        category_id: 카테고리 필터 (1~11, 선택)
        limit: 1~20, 기본 5

    Returns:
        [
          {
            'document_id': 5500,
            'title': '교통행정과',
            'content': '교통행정과\\n담당업무: 교통기획, 교통관리, 물류정책 ...\\n전화번호: 061-286-7450',
            'category_id': 1,           # 매핑된 카테고리 (없으면 None)
            'similarity': 0.612,
          },
          ...
        ]
    """
    return _search_rag(query, 'dept', category_id, limit)


def match_or_create_cluster(text: str, keywords: Optional[list] = None,
                            similarity_threshold: float = 0.75) -> dict:
    """비슷한 민원 그룹(클러스터)을 찾거나 새로 생성.

    동작:
      1. keywords 주어지면 ' '.join(keywords)를 임베딩, 아니면 text를 임베딩
      2. 기존 complaint_clusters의 centroid와 cosine 유사도 비교
      3. similarity_threshold 이상이면 기존 클러스터에 매칭:
         - complaint_count++
         - last_seen_at 갱신
         - centroid를 EMA(0.9) 가중 평균으로 업데이트
      4. 미만이면 신규 클러스터 INSERT

    Args:
        text: 민원 본문 (representative_content용)
        keywords: 핵심 키워드 리스트 (선택). 주어지면 매칭 정확도 ↑.
                  LLM이 사전 추출한 키워드 권장 (extract_keywords 함수 사용).
        similarity_threshold: 매칭 임계값 (기본 0.75)

    Returns:
        {
          'cluster_id': 12,
          'similarity': 0.85,         # 매칭된 유사도 (신규면 0)
          'is_new': False,            # True면 새 클러스터 생성
          'complaint_count': 5,       # 매칭 후 총 멤버 수
          'representative_content': '...',
          'urgency_bonus': 0.0,       # 클러스터 누적 건수 기반 가산점 (0~0.3)
        }

    백엔드 사용 예:
        cluster = svc.match_or_create_cluster(text)
        complaints.insert(..., cluster_id=cluster['cluster_id'],
                          urgency_score=base_urgency + cluster['urgency_bonus'])
    """
    import numpy as np
    from datetime import datetime
    text = (text or '').strip()
    if not text:
        return {'cluster_id': None, 'similarity': 0.0, 'is_new': False,
                'complaint_count': 0, 'representative_content': '', 'urgency_bonus': 0.0}

    # 임베딩 대상: 키워드 있으면 키워드 우선 (의도 명확, 매칭 정확도 ↑)
    embed_target = ' '.join(keywords).strip() if keywords else text
    if not embed_target:
        embed_target = text
    vec = _get_embed().encode(embed_target, normalize_embeddings=True).astype(np.float32)
    conn = _get_db()
    with conn.cursor() as c:
        # 1) 기존 클러스터 중 가장 가까운 것 (centroid 있는 것만)
        c.execute("""
            SELECT cluster_id, representative_content, complaint_count, centroid,
                   1 - (centroid <=> %s::vector) AS sim
            FROM complaint_clusters
            WHERE centroid IS NOT NULL
            ORDER BY centroid <=> %s::vector
            LIMIT 1
        """, (vec.tolist(), vec.tolist()))
        best = c.fetchone()

        if best and float(best[4]) >= similarity_threshold:
            cid, rep, count, old_cent, sim = best
            new_count = count + 1
            # EMA centroid 갱신 (alpha=0.1)
            old_arr = np.array(old_cent, dtype=np.float32)
            new_cent = (old_arr * 0.9 + vec * 0.1)
            # 재정규화 (L2)
            norm = np.linalg.norm(new_cent)
            if norm > 0:
                new_cent = new_cent / norm
            c.execute("""
                UPDATE complaint_clusters
                SET complaint_count=%s, last_seen_at=NOW(), centroid=%s
                WHERE cluster_id=%s
            """, (new_count, new_cent.tolist(), cid))
            conn.commit()
            return {
                'cluster_id': int(cid),
                'similarity': round(float(sim), 4),
                'is_new': False,
                'complaint_count': int(new_count),
                'representative_content': rep,
                'urgency_bonus': _cluster_urgency_bonus(new_count),
            }
        else:
            # 신규 클러스터
            c.execute("""
                INSERT INTO complaint_clusters
                (representative_content, complaint_count, centroid, first_seen_at, last_seen_at)
                VALUES (%s, 1, %s, NOW(), NOW())
                RETURNING cluster_id
            """, (text[:500], vec.tolist()))
            new_id = c.fetchone()[0]
            conn.commit()
            return {
                'cluster_id': int(new_id),
                'similarity': 0.0,
                'is_new': True,
                'complaint_count': 1,
                'representative_content': text[:500],
                'urgency_bonus': 0.0,
            }


def _cluster_urgency_bonus(count: int) -> float:
    """클러스터 누적 건수 → urgency_score 가산점 (0~0.3)."""
    if count >= 100: return 0.30
    if count >= 50:  return 0.20
    if count >= 10:  return 0.10
    return 0.0


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
# OpenAI Function Calling — 도구 스키마
# ============================================================
# answer_chatbot 함수가 OpenAI에 노출하는 도구 정의.
# 각 description은 LLM이 호출 여부 판단하는 핵심 — 명확하고 구체적으로.
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "classify_complaint",
            "description": (
                "민원 텍스트를 11개 카테고리 중 가장 적합한 것 top-K로 분류. "
                "카테고리: 교통(1), 건축(2), 행정(3), 보건위생(4), 환경(5), 문화_여가(6), "
                "농축산(7), 복지(8), 세무(9), 상하수도(10), 경제(11). "
                "각 카테고리의 confidence(0~1) + category_id 반환."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "민원 본문"},
                    "top_k": {"type": "integer", "default": 3, "description": "반환할 후보 수 (1~11)"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_urgency",
            "description": (
                "민원의 긴급 여부 판정. KLUE BERT 이진 분류 + DB 키워드(가스누출/화재/붕괴 등) 매칭. "
                "is_urgent=true이면 119/112/안전신문고 우선 안내 권장."
            ),
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "민원 본문"}},
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_laws",
            "description": (
                "관련 법령 조항 벡터 검색 (5,441 조항). 도로교통법/건축법/세무법/주민등록법/민원처리법 등. "
                "답변에 근거 법령으로 인용. category_id 필터 가능 (분류 결과 활용)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "검색 질의"},
                    "category_id": {"type": "integer", "description": "카테고리 필터 1~11 (선택)"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_cases",
            "description": (
                "국민신문고 유사 사례 검색 (질문+공식 답변). 비슷한 민원이 어떻게 처리됐는지 참고용. "
                "category_id 필터 가능."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_dept",
            "description": (
                "부서 의미 검색 (39개 부서 담당업무 description 기반). "
                "category_id 주면 그 카테고리 매핑 부서 안에서만 검색 (정밀도 ↑). "
                "카테고리에 매핑되지 않은 부서(소방본부/여순사건지원단 등)도 None이면 포함."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category_id": {"type": "integer", "description": "카테고리 필터 1~11 (선택)"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_dept_by_category",
            "description": (
                "카테고리에 매핑된 처리 부서를 priority 순으로 반환. "
                "분류 결과의 category_id로 호출. 부서명/전화번호/우선순위 포함."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category_id": {"type": "integer", "description": "1~11"},
                },
                "required": ["category_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "match_or_create_cluster",
            "description": (
                "비슷한 민원 그룹을 찾거나 신규 생성. complaint_count가 높을수록 동일 민원이 자주 접수됨. "
                "답변에 '이 민원 N건째 접수' 같은 정보 활용 가능. urgency_bonus는 긴급도 자동 가산점."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "민원 본문"},
                    "similarity_threshold": {"type": "number", "default": 0.75},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "11개 카테고리 메타 (category_id, name). 카테고리 ID와 이름 매핑 확인용.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

# 도구 이름 → 실제 함수 매핑 (answer_chatbot이 사용)
_TOOL_DISPATCH = {
    "classify_complaint": lambda **kw: classify_complaint(**kw),
    "check_urgency": lambda **kw: check_urgency(**kw),
    "search_laws": lambda **kw: search_laws(**kw),
    "search_cases": lambda **kw: search_cases(**kw),
    "search_dept": lambda **kw: search_dept(**kw),
    "lookup_dept_by_category": lambda **kw: lookup_dept_by_category(**kw),
    "match_or_create_cluster": lambda **kw: match_or_create_cluster(**kw),
    "get_categories": lambda **kw: get_categories(**kw),
}


# ============================================================
# Chatbot LLM (OpenAI Function Calling)
# ============================================================
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# NAVER CLOVA (NCP API Gateway 공통 인증)
# - CSR (STT): 음성 → 텍스트
# - Voice (TTS): 텍스트 → 음성 (mp3)
CLOVA_CLIENT_ID = os.environ.get('NAVER_CLOVA_CLIENT_ID', '')
CLOVA_CLIENT_SECRET = os.environ.get('NAVER_CLOVA_CLIENT_SECRET', '')
CLOVA_STT_URL = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt'
CLOVA_TTS_URL = os.environ.get(
    'CLOVA_TTS_URL',
    'https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts'
)
# tts-premium 활성화 안 된 경우 .env에서 'tts/v1/tts'로 오버라이드 가능:
#   CLOVA_TTS_URL=https://naveropenapi.apigw.ntruss.com/tts/v1/tts

GATE_PROMPT = """\
당신은 "마음결" 공공 민원 상담 챗봇입니다. 사용자 메시지가 민원 관련 질문인지 판단하세요.

## 민원 카테고리 (11개)
교통, 건축, 행정, 보건위생, 환경, 문화/여가, 농축산, 복지, 세무, 상하수도, 경제
위 카테고리에 해당하는 신고/문의/요청이면 민원입니다.
이전 대화가 민원 상담이었고 그에 대한 후속 질문(예: "그럼 어떻게 신고해요?")도 민원입니다.

## 출력 규칙
- 민원이면: 정확히 "[TOOL]" 다섯 글자만 출력. 다른 말 절대 금지.
- 민원이 아니면 (인사/감사/잡담/챗봇 소개 질문 등): 친절히 2~3문장으로 답변.
  - 인사 → 인사로 받고 도움드릴 수 있다고 안내
  - "고마워요" → "도움이 되어 다행입니다" 식
  - "너 뭐 할 수 있어?" → 11개 카테고리 민원 상담을 도와준다고 안내
  - 욕설/도발/관련 없는 잡담 → "민원 관련 도움만 드릴 수 있습니다" 정도로 정중히 거절
"""


SYSTEM_PROMPT = """\
당신은 "마음결" 공공 민원 상담 챗봇입니다. 사용자의 민원 관련 질문에 친절하고 정확하게 답변하세요.

## 입력 형식
사용자 메시지에는 다음 두 부분이 포함됩니다:
1. <context> ... </context> — 시스템이 미리 수집한 정보 (JSON)
   - classification: 카테고리 분류 결과 (category, category_id, confidence)
   - urgency: 긴급 여부 (is_urgent, matched_keyword)
   - cluster: 유사 민원 그룹 (complaint_count, urgency_bonus)
   - keywords: 사용자 텍스트에서 추출한 핵심 키워드
   - laws: 관련 법령 조항 리스트 (title, content, similarity)
   - cases: 유사 사례 리스트 (있을 수도, 빈 리스트일 수도)
   - departments: 카테고리 매핑 부서 (name, phone, priority)
   - similar_depts: 부서 의미 검색 결과
2. 사용자 질문 (자연어)

## 카테고리 선택 (LLM이 최종 결정자)
classification.top_k에는 분류기가 뽑은 3개 후보가 들어있고, 각 후보에 매핑된 departments도 함께 들어있습니다.
**confidence는 분류기 점수일 뿐, 결정의 절대 기준이 아닙니다.** 분류기는 마스킹 학습된 모델이라 표면 키워드에 끌릴 수 있습니다.

- **사용자 질문(질문 텍스트와 keywords)을 직접 읽고, top-3 후보 중 의미적으로 가장 맞는 카테고리를 LLM 본인이 고르세요.**
- confidence가 0.99여도 의미가 안 맞으면 다른 후보를 채택. confidence는 참고 정보일 뿐.
  예시: "도로 포트홀 신고" → 분류기 top-1이 '건축(0.96)' top-2가 '교통(0.03)'이어도,
       도로 위 포트홀은 명백히 교통 영역이므로 **top-2(교통)을 채택**하고 교통 부서를 안내.
- top-3 안에 적절한 카테고리가 없으면 가장 가까운 걸 고르고 "정확한 분류가 어려워 보이니 담당 부서에 직접 문의 권장" 한 줄 추가.
- 선택한 후보의 departments에서 priority=1 부서를 우선 안내 (부서명 + 전화번호).

## 답변 규칙
- 어떤 카테고리의 민원인지 한 줄로 명시 (예: "교통 관련 민원이군요.")
- 친절한 존댓말, 3~5문장 정도로 간결하게

## 🚫 절대 금지 (할루시네이션 방지)

다음 세 항목만 **반드시 context에 명시된 값만 사용**하세요. 가짜 만들면 사용자 신뢰가 깨집니다.

1. **부서명/전화번호**: context.departments 또는 context.similar_depts에 있는 정확한 name·phone만 사용. 없는 부서나 임의 번호(예: 1234-5678) 생성 금지.

2. **법령 조항**: context.laws 배열에 있는 title의 글자 그대로만 인용.
   - ✅ 올바른 예: context.laws[0].title이 "도로교통법 제33조(주차금지의 장소)"이면 → "도로교통법 제33조에 따르면..."
   - ❌ 금지: context.laws에 없는 조항 만들어내기 (예: 임의로 "형법 제172조의2")
   - context.laws가 빈 배열이거나 모든 similarity가 0.4 미만이면 **법령 인용 자체를 생략**하세요.

3. **사례/통계 수치**: cases 배열이나 cluster.complaint_count 없으면 "사례 N건" 같은 표현 금지.

## ✅ 자유롭게 안내해도 되는 것 (위 3가지 외)

다음은 누구나 아는 공공 정보이므로 자신 있게 안내하세요:
- **공공 민원 신고 채널**: 안전신문고(safetyreport.go.kr / 앱), 국민신문고(epeople.go.kr), 정부24(www.gov.kr), 다산콜 120(서울)·110(전국 정부민원안내)
- **신고 시 일반적 첨부 자료**: 사진, 위치(도로명/지번), 발생 시각 등
- **민원 처리 일반 절차**: 접수 → 담당 부서 배정 → 처리 → 회신 흐름
- **카테고리별 상식 수준 안내**: 교통 신호 위반 신고는 스마트국민제보, 도로 시설물(포트홀 등)은 안전신문고 등

## 후속 질문 처리 (멀티턴)

history에 직전 turn 답변이 있으면 **그 답변에서 이미 말한 내용은 반복하지 마세요**.
- 직전에 부서 안내(이름+전화)를 했으면, 후속 turn에서는 부서 다시 안내하지 말고 사용자가 새로 물은 것에 집중.
- "어떻게 신고해요?" 같은 절차 질문에는 → 채널(안전신문고/국민신문고 등) + 필요 자료 + 처리 흐름 위주로.
- "얼마나 걸려요?" 같은 기간 질문에는 → 일반적 민원 처리 기한(보통 7~14일) 안내 + 정확한 건 담당 부서 문의 권장.
- 사용자가 분명히 다른 주제로 옮긴 경우에만 카테고리 변경, 아니면 직전 카테고리 유지.

## 조건부
- urgency.is_urgent=true 이면 답변 첫 줄에 "긴급한 상황이라면 즉시 119/112로 신고해주세요" 추가.
- cluster.complaint_count >= 10 이면 "동일 민원이 N건 접수되어 우선 처리 중입니다" 한 줄 추가.
- classification.confidence < 0.6 이면 카테고리 확정 표현 피하고 "관련 문의로 보입니다" 정도로 완곡하게.
- cases가 비어있거나 sim이 매우 낮으면 그 항목 언급하지 마세요.

## 모르면 모른다고
세부 행정 사항(접수번호, 정확한 처리일, 특정 담당자명 등)은 추측하지 말고 "정확한 정보는 담당 부서에 직접 문의해주세요"로 안내.
"""

_openai_client = None


def _get_openai():
    """AsyncOpenAI 클라이언트 (싱글톤)."""
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY 환경변수 없음. .env 확인.")
        _openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def _summarize(result):
    """긴 결과를 짧게 요약 (도구 호출 로그용)."""
    import json as _json
    if isinstance(result, list):
        return f'list({len(result)})'
    if isinstance(result, dict):
        return 'dict(' + ', '.join(list(result.keys())[:5]) + ')'
    s = str(result)
    return s[:80]


# ============================================================
# STT (Speech-to-Text) — 음성을 텍스트로 변환
# ============================================================

async def transcribe_audio(audio_data: bytes, lang: str = "Kor") -> str:
    """음성 데이터를 텍스트로 변환 (NAVER CLOVA CSR — 단문 음성 인식).

    60초 이내 짧은 음성을 동기 호출로 변환. 챗봇 입력 시나리오에 적합.
    변환된 텍스트를 그대로 answer_chatbot에 전달하면 됩니다.

    Args:
        audio_data: 음성 파일 raw bytes (mp3/aac/ac3/ogg/flac/wav 지원)
        lang: "Kor"(한국어, 기본), "Eng", "Jpn", "Chn"

    Returns:
        변환된 텍스트. 빈 입력이나 인식 실패 시 빈 문자열.

    Raises:
        RuntimeError: NAVER_CLOVA_CLIENT_ID/SECRET 환경변수 없을 때
        httpx.HTTPStatusError: CLOVA API 호출 4xx/5xx 응답

    사용 예 (백엔드 라우터):
        @router.post("/chat/voice")
        async def voice(audio: UploadFile, session_id: str):
            audio_bytes = await audio.read()
            text = await svc.transcribe_audio(audio_bytes)
            history = SESSIONS.get(session_id, [])
            return await svc.answer_chatbot(text, history=history)

    Notes:
        - 60초 초과 음성은 잘리거나 에러. 장문은 별도 API 필요.
        - CLOVA는 표준어로 정규화하는 경향 (사투리 → 표준어 출력).
    """
    if not (CLOVA_CLIENT_ID and CLOVA_CLIENT_SECRET):
        raise RuntimeError(
            "NAVER_CLOVA_CLIENT_ID / NAVER_CLOVA_CLIENT_SECRET 환경변수 없음. "
            ".env 확인하세요."
        )
    if not audio_data:
        return ""

    import httpx
    headers = {
        "X-NCP-APIGW-API-KEY-ID": CLOVA_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": CLOVA_CLIENT_SECRET,
        "Content-Type": "application/octet-stream",
    }
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            CLOVA_STT_URL,
            params={"lang": lang},
            headers=headers,
            content=audio_data,
        )
        resp.raise_for_status()
        return resp.json().get("text", "")


async def synthesize_speech(
    text: str,
    speaker: str = "nara",
    speed: int = 0,
    volume: int = 0,
    pitch: int = 0,
    audio_format: str = "mp3",
) -> bytes:
    """텍스트를 음성으로 변환 (NAVER CLOVA Voice — TTS Premium).

    answer_chatbot 답변을 음성으로 재생할 때 사용. 프론트엔드가 mp3 bytes 받아서 재생.

    Args:
        text: 변환할 텍스트 (한 요청 최대 ~200자 권장, 길면 분할 호출)
        speaker: 보이스 ID
          - "nara" (한국어 여성, 차분, 기본)
          - "mijin" (여성), "jinho" (남성)
          - 감정/캐릭터: "vara", "vmikyung", "vdaeseong" 등 (premium)
        speed: -5(빠름) ~ 5(느림), 기본 0
        volume: -5 ~ 5, 기본 0
        pitch: -5 ~ 5, 기본 0
        audio_format: "mp3" 또는 "pcm"

    Returns:
        오디오 파일 raw bytes (mp3/pcm). 빈 입력이면 빈 bytes.

    Raises:
        RuntimeError: NAVER_CLOVA_CLIENT_ID/SECRET 환경변수 없을 때
        httpx.HTTPStatusError: CLOVA Voice 서비스 미활성화/호출 실패

    사용 예 (백엔드):
        @router.post("/chat/voice-reply")
        async def voice_reply(text: str):
            audio = await svc.synthesize_speech(text)
            return Response(content=audio, media_type="audio/mpeg")
    """
    if not (CLOVA_CLIENT_ID and CLOVA_CLIENT_SECRET):
        raise RuntimeError(
            "NAVER_CLOVA_CLIENT_ID / NAVER_CLOVA_CLIENT_SECRET 환경변수 없음."
        )
    if not text or not text.strip():
        return b''

    import httpx
    headers = {
        "X-NCP-APIGW-API-KEY-ID": CLOVA_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": CLOVA_CLIENT_SECRET,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "speaker": speaker,
        "text": text,
        "speed": str(speed),
        "volume": str(volume),
        "pitch": str(pitch),
        "format": audio_format,
    }
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(CLOVA_TTS_URL, headers=headers, data=data)
        resp.raise_for_status()
        return resp.content


IMAGE_ANALYSIS_PROMPT = """\
당신은 "마음결" 공공 민원 챗봇의 이미지 분석 모듈입니다.
사용자가 첨부한 이미지를 보고 다음 정보를 3~5문장으로 출력하세요. 출력 텍스트는 이어지는
민원 분석 시스템(분류기/RAG/답변 LLM)에 그대로 입력되므로, 핵심 키워드 위주로 구체적으로 쓰세요.

1. **무엇이 보이는가** — 객체/장면/표지판 텍스트 (사실 기반, 본 것만)
2. **민원 성격** — 이 사진으로 사용자가 제기하려는 민원의 의도 추정
3. **카테고리 후보** — 다음 중 가장 가까운 1~2개:
   교통, 건축, 행정, 보건위생, 환경, 문화_여가, 농축산, 복지, 세무, 상하수도, 경제

규칙:
- 이미지에 없는 내용을 만들지 마세요 (할루시네이션 금지).
- 표지판/간판/문서 텍스트가 있으면 그대로 인용.
- 불명확한 부분은 "정확히 보이지 않음"이라고 표시.
- 이미지가 공공 민원과 무관해 보이면 "공공 민원과 무관한 이미지로 보입니다"만 출력.

예시 출력:
"도로 우측에 깊이 약 10cm 정도의 포트홀이 보입니다. 차량 통행이 있는 차도이며 주변에
'도로 보수 중' 표지판은 없습니다. 사용자가 도로 파손 신고를 원하는 것으로 보입니다.
카테고리 후보: 교통."
"""


async def analyze_image(image_data: bytes, mime_type: str = "image/jpeg") -> str:
    """이미지를 분석해 민원 의도 추정 텍스트를 반환 (gpt-4o Vision).

    OCR + 객체 인식 + 장면 이해 + 민원 의도 추정을 한 번의 LLM 호출로 처리.
    반환된 텍스트를 answer_chatbot에 그대로 전달하면 분류/검색/답변까지 자동 연계됨.

    Args:
        image_data: 이미지 raw bytes (jpg/png/gif/webp)
        mime_type: "image/jpeg", "image/png" 등

    Returns:
        분석 텍스트 (보이는 것 + 민원 성격 + 카테고리 후보).
        빈 입력이면 빈 문자열.

    Raises:
        RuntimeError: OPENAI_API_KEY 없을 때

    사용 예 (백엔드):
        @router.post("/chat/image")
        async def chat_image(file: UploadFile, text: str | None, session_id: str):
            img_bytes = await file.read()
            desc = await svc.analyze_image(img_bytes, file.content_type)
            combined = f"[첨부 이미지]\\n{desc}\\n\\n[사용자 메시지]\\n{text or '(이미지만)'}"
            history = SESSIONS.get(session_id, [])
            return await svc.answer_chatbot(combined, history=history)

    Notes:
        - gpt-4o가 이미 멀티모달이라 OCR/Vision API 별도 호출 불필요.
        - 흐릿한 영수증이나 전문 의료 차트는 전용 OCR이 더 정확할 수 있음.
        - 이미지 1장당 비용 약 $0.005~0.015 (해상도 따라).
    """
    if not image_data:
        return ""

    import base64
    b64 = base64.b64encode(image_data).decode('utf-8')
    client = _get_openai()

    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": IMAGE_ANALYSIS_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": "이 이미지를 분석하세요."},
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            ]},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


async def extract_keywords(text: str, max_keywords: int = 5) -> list[str]:
    """사용자 텍스트에서 핵심 키워드 추출 (OpenAI 호출).

    클러스터링 매칭 정확도를 위해 사용. 본문 전체 임베딩보다 핵심 단어 임베딩이
    같은 의미의 다른 표현을 더 잘 묶음.

    Args:
        text: 민원 본문
        max_keywords: 추출할 키워드 최대 개수 (기본 5)

    Returns:
        ["불법주차", "단속", "횡단보도"] 같은 키워드 리스트.
        실패 시 빈 리스트 반환 (호출자가 fallback).

    Notes:
        - 짧은 호출 (응답 토큰 30개 정도). 비용/지연 미미.
        - 호출 실패해도 match_or_create_cluster는 text fallback으로 동작.
    """
    text = (text or '').strip()
    if not text:
        return []
    try:
        client = _get_openai()
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content":
                 "사용자 민원 텍스트에서 핵심 키워드를 추출하세요. "
                 f"명사 위주, 최대 {max_keywords}개. "
                 "답변은 쉼표로 구분한 키워드만 출력. 다른 말 절대 추가하지 마세요. "
                 "예: 불법주차, 단속, 횡단보도"},
                {"role": "user", "content": text},
            ],
            temperature=0.0,
            max_tokens=60,
        )
        raw = (resp.choices[0].message.content or '').strip()
        # 쉼표/세미콜론 split
        keywords = [k.strip() for k in re.split(r'[,;、]', raw) if k.strip()]
        return keywords[:max_keywords]
    except Exception:
        return []


def _build_tool_query(text: str, history: Optional[list[dict]] = None) -> str:
    """도구 호출용 query 생성. history 있으면 직전 user 발언 2개와 합쳐 컨텍스트 유지.

    후속 질문(예: "그럼 어떻게 신고해요?")만으론 분류기/벡터검색이 헛바람 분류하는 문제 해결.
    """
    if not history:
        return text
    user_msgs = [m.get('content', '') for m in history
                 if m.get('role') == 'user' and m.get('content')]
    recent = user_msgs[-2:]
    parts = recent + [text]
    return '\n'.join(p for p in parts if p)


async def answer_chatbot(text: str, history: Optional[list[dict]] = None) -> dict:
    """챗봇 답변 생성 (백엔드 오케스트레이션 패턴 A + 게이트).

    흐름:
      0단계 — 게이트 LLM: 민원 여부 판단.
        민원 아니면 (인사/잡담/감사 등) 그 자리에서 답변 생성하고 종료.
        민원이면 [TOOL] 신호 → 아래 단계 진행.
      1단계 — 카테고리 의존 없는 도구 병렬 호출:
        classify, urgency, cluster, search_laws, search_cases
      2단계 — category_id 결정 후 부서 도구 병렬:
        lookup_dept_by_category, search_dept
      3단계 — 모든 결과 + 대화 히스토리를 컨텍스트로 OpenAI 호출 → 답변 생성

    Args:
        text: 사용자 질문 (이번 턴의 마지막 user 메시지)
        history: 이전 대화 히스토리. OpenAI messages 포맷 그대로.
                 [{"role": "user"|"assistant", "content": "..."}, ...]
                 최근 10개(약 5턴)까지만 LLM에 전달. None이면 단발성 대화.
                 저장/관리는 백엔드 책임 — AI 모듈은 stateless.

    Returns:
        {
            'answer': '...',           # 자연어 답변
            'metadata': {
                'classification': {...},   # category, category_id, confidence, top_k
                'urgency': {...},          # is_urgent, probability_urgent, matched_keyword
                'cluster': {...},          # cluster_id, complaint_count, urgency_bonus
                'laws': [...],             # 법령 조항 list
                'cases': [...],            # 사례 list (적재 시)
                'departments': [...],      # priority 순 부서
                'similar_depts': [...],    # 의미 검색 부서
            }
        }

    환경변수 필수:
        OPENAI_API_KEY  — OpenAI API 키
        OPENAI_MODEL    — (선택, 기본 'gpt-4o-mini')
    """
    import asyncio
    import json as _json

    text = (text or '').strip()
    if not text:
        return {'answer': '', 'metadata': {}}

    client = _get_openai()

    # ─── 0단계: 게이트 (민원 여부 판단) ───
    # 민원이면 LLM이 "[TOOL]"만 출력, 아니면 잡담 답변을 그 자리에서 생성.
    gate_messages = [{"role": "system", "content": GATE_PROMPT}]
    if history:
        for m in history[-10:]:
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                gate_messages.append({"role": role, "content": content})
    gate_messages.append({"role": "user", "content": text})

    gate_resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=gate_messages,
    )
    gate_out = (gate_resp.choices[0].message.content or '').strip()

    if "[TOOL]" not in gate_out:
        # 잡담 — 게이트 응답이 곧 최종 답변. metadata 스키마는 민원 케이스와 동일하게 유지.
        return {
            'answer': gate_out,
            'metadata': {
                'tool_used': False,
                'classification': None,
                'urgency': None,
                'cluster': None,
                'keywords': [],
                'laws': [],
                'cases': [],
                'departments': [],
                'similar_depts': [],
            },
        }

    # 도구 호출용 query: 후속 질문이면 직전 turn과 합쳐 컨텍스트 유지
    tool_query = _build_tool_query(text, history)

    # ─── 1단계: 키워드 추출(LLM)을 먼저 시작, 나머지 도구는 키워드 없이 병렬 시작 ───
    keywords_task = asyncio.create_task(extract_keywords(tool_query))

    cls, urg, laws, cases = await asyncio.gather(
        asyncio.to_thread(classify_complaint, tool_query, 3),
        asyncio.to_thread(check_urgency, tool_query),
        asyncio.to_thread(search_laws, tool_query, None, 5),
        asyncio.to_thread(search_cases, tool_query, None, 5),
    )
    cat_id = cls.get('category_id')

    # 키워드 추출 완료 대기 후 클러스터 매칭
    keywords = await keywords_task
    cluster = await asyncio.to_thread(match_or_create_cluster, tool_query, keywords)

    # ─── 2단계: top-3 카테고리 각각의 부서를 병렬 조회 + top-1 의미 검색 ───
    # LLM이 top-3 후보 중 사용자 의도에 가장 맞는 걸 골라 답할 수 있도록 부서 정보까지 묶어 전달.
    top_k_items = cls.get('top_k') or []

    async def _fetch_top_depts(item):
        cid = item.get('category_id')
        if cid:
            d = await asyncio.to_thread(lookup_dept_by_category, cid)
            return {**item, 'departments': d}
        return {**item, 'departments': []}

    dept_search_task = (
        asyncio.to_thread(search_dept, tool_query, cat_id, 5)
        if cat_id else asyncio.sleep(0, result=[])
    )
    top_k_with_depts, dept_search = await asyncio.gather(
        asyncio.gather(*[_fetch_top_depts(it) for it in top_k_items]),
        dept_search_task,
    )
    cls['top_k'] = list(top_k_with_depts)
    # 백워드 호환: 기존 'departments' 키는 top-1 카테고리 부서 유지
    depts = top_k_with_depts[0]['departments'] if top_k_with_depts else []

    metadata = {
        'tool_used': True,
        'classification': cls,
        'urgency': urg,
        'cluster': cluster,
        'keywords': keywords,
        'laws': laws,
        'cases': cases,
        'departments': depts,
        'similar_depts': dept_search,
    }

    # ─── 3단계: 컨텍스트를 LLM에 한 번 전달 ───
    context_json = _json.dumps(metadata, ensure_ascii=False, default=str)
    user_message = f"<context>\n{context_json}\n</context>\n\n질문: {text}"

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for m in history[-10:]:
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
    )
    answer = resp.choices[0].message.content or ''

    return {'answer': answer, 'metadata': metadata}


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
