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
# 모델 경로: 로컬 폴더 또는 HuggingFace model_id 둘 다 지원.
# 기본값은 HF hub (private 저장소, HF_TOKEN env 필요).
# 로컬 파일 쓰려면 .env에서 CLASSIFIER_DIR / URGENCY_DIR을 절대경로로 오버라이드.
CLASSIFIER_DIR = os.environ.get('CLASSIFIER_DIR', 'atti433/minde-classifier')
URGENCY_DIR = os.environ.get('URGENCY_DIR', 'atti433/minde-urgency')
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


def _search_rag(query: str, source_type, category_id: Optional[int] = None, limit: int = 5) -> list[dict]:
    """공통 RAG 벡터 검색 (pgvector cosine).

    source_type: str 또는 list[str]. list면 여러 소스 통합 검색.
    """
    import numpy as np
    query = (query or '').strip()
    if not query:
        return []
    qv = _get_embed().encode(query, normalize_embeddings=True).astype(np.float32)
    conn = _get_db()
    if isinstance(source_type, (list, tuple)):
        types_tuple = tuple(source_type)
        source_clause = 'source_type = ANY(%s)'
        source_param = [list(types_tuple)]
    else:
        source_clause = 'source_type=%s'
        source_param = [source_type]
    sql = f"""
        SELECT document_id, title, content, category_id, source_type,
               1 - (embedding <=> %s::vector) AS similarity
        FROM rag_documents
        WHERE {source_clause} AND embedding IS NOT NULL
    """
    params = [qv.tolist()] + source_param
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
            'source_type': r[4],
            'similarity': round(float(r[5]), 4),
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
    """유사 사례 검색 — 국민신문고 사례(case) + 우리 platform 접수 민원(complaint) 통합.

    답변 작성 시 "이런 비슷한 민원은 이렇게 처리했습니다" 참조용.
    반환에 source_type 포함 ('case' | 'complaint') — 프론트가 구분 표시 가능.

    Args, Returns: search_laws와 동일 구조 + source_type 필드.
    """
    return _search_rag(query, ['case', 'complaint'], category_id, limit)


def index_complaint_for_rag(complaint_id: int, title: str, content: str, category_id: Optional[int] = None) -> Optional[int]:
    """접수된 민원을 rag_documents에 임베딩·저장. 유사 사례 검색용.

    실패해도 예외 던지지 않음 (접수 자체는 성공해야 하므로).

    Returns: document_id (신규) 또는 None (실패).
    """
    text = f"{title}\n\n{content}"
    try:
        embed = _get_embed().encode(text, normalize_embeddings=True)
        conn = _get_db()
        with conn.cursor() as c:
            c.execute(
                """INSERT INTO rag_documents (title, content, category_id, source_type, embedding)
                   VALUES (%s, %s, %s, 'complaint', %s)
                   RETURNING document_id""",
                (title[:200], content[:3000], category_id, embed.tolist()),
            )
            doc_id = c.fetchone()[0]
        conn.commit()
        return int(doc_id)
    except Exception:
        return None


_procedure_title_idf = None


def _get_procedure_title_idf() -> dict:
    """procedure title에서 계산한 IDF (rare한 명사에 큰 가중치).

    싱글톤 캐시. 첫 호출 시 DB에서 unique title 다 뽑아 IDF 계산.
    "여권", "등기부등본" 같은 도메인 특정 명사는 IDF 높고,
    "발급", "신고", "신청" 같은 흔한 접미사는 IDF 낮음.
    """
    global _procedure_title_idf
    if _procedure_title_idf is not None:
        return _procedure_title_idf
    import math, re as _re
    with _loader_lock:
        if _procedure_title_idf is not None:
            return _procedure_title_idf
        try:
            conn = _get_db()
            with conn.cursor() as c:
                c.execute("SELECT DISTINCT title FROM rag_documents WHERE source_type='procedure'")
                titles = [r[0] for r in c.fetchall() if r[0]]
        except Exception:
            titles = []
        if not titles:
            _procedure_title_idf = {}
            return _procedure_title_idf
        N = len(titles)
        df: dict[str, int] = {}
        for t in titles:
            for tok in set(_re.findall(r'[가-힣]{2,}', t)):
                df[tok] = df.get(tok, 0) + 1
        idf = {tok: math.log(N / cnt) for tok, cnt in df.items()}
        # 모르는 토큰의 fallback IDF (평균값)
        idf['__default__'] = math.log(N / max(1, sum(df.values()) // len(df)))
        _procedure_title_idf = idf
        return _procedure_title_idf


def _title_keyword_boost(query: str, title: str) -> float:
    """IDF 가중 title 키워드 매칭 부스트.

    KoSimCSE 벡터가 특정 도메인 명사(여권/주민등록등본/건축신고 등)에 약해서
    top-1 매칭이 흐릿한 경우가 있음. 쿼리와 title에 공통되는 명사의 IDF 합으로
    부스트해서 특정 명사가 매칭될 때 강하게 리랭킹.
    """
    import re
    q_tokens = set(re.findall(r'[가-힣]{2,}', query))
    if not q_tokens:
        return 0.0
    idf = _get_procedure_title_idf()
    default_idf = idf.get('__default__', 3.0) if idf else 3.0
    total_idf = 0.0
    for tok in q_tokens:
        if tok in title:
            total_idf += idf.get(tok, default_idf) if idf else 3.0
    # 스케일링: 최대 부스트 0.40 (매우 rare한 토큰 매칭 여러 개일 때만 도달)
    return min(0.40, total_idf * 0.06)


def search_procedures(query: str, limit: int = 5) -> list[dict]:
    """정부24 행정 서비스 절차/서류 검색 (벡터 유사도 + title 키워드 하이브리드).

    9,438건의 민원 사무 카탈로그가 필드 단위로 청킹돼 있음 (약 46,000 청크).
    필드: 용도/신청방법/구비서류/처리기간/수수료/절차/근거법령/소관기관.
    "필요 서류", "신청 절차", "처리 기간", "수수료" 유형 질문에 정확한 답변용.

    검색 방식: 벡터 top-20 → title 키워드 매칭 부스트 → 리랭킹 → top-limit.
    같은 title(동일 민원)의 청크가 여러 개 뽑히면 각 필드 정보가 모여
    답변 LLM이 종합해 답변할 수 있음.

    category_id 필터는 쓰지 않음 (정부24 대주제와 우리 카테고리 축이 다름).

    Args, Returns: search_laws와 동일 구조. content는 라벨 형식.
    """
    candidates = _search_rag(query, 'procedure', category_id=None, limit=20)
    for c in candidates:
        boost = _title_keyword_boost(query, c['title'])
        c['similarity'] = round(c['similarity'] + boost, 4)
    candidates.sort(key=lambda x: -x['similarity'])
    return candidates[:max(1, min(20, limit))]


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
                            similarity_threshold: float = 0.70) -> dict:
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
                    "similarity_threshold": {"type": "number", "default": 0.70},
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
   - procedures: 정부24 행정 서비스 카탈로그 검색 결과 (신청방법/구비서류/처리기간/수수료/절차)
   - departments: 카테고리 매핑 부서 (name, phone, priority)
   - similar_depts: 부서 의미 검색 결과
2. 사용자 질문 (자연어)

## 복수 민원 처리 (sub_queries)

metadata.sub_queries는 사용자 텍스트에서 분해된 독립 민원 리스트입니다.

- **1개**: 기존 흐름대로 (아래 다른 규칙 적용)
- **2개 이상**: 각 서브 민원에 대해 **개별 안내**를 하나의 답변에 모아서 제공.
  각 서브 민원마다:
  1. 어떤 민원인지 한 줄로 요약 (그 서브의 카테고리 명시)
  2. 담당 부서 이름 + 전화번호 (각 서브의 departments[0])
  3. 필요 시 신고 채널·자료·처리 기한 짧게 안내
  자연스러운 문단 구조로: "먼저 A 관련 민원은 …, 두 번째로 B 관련 민원은 …"
  아래의 카테고리·부서·법령·긴급·클러스터 규칙은 각 서브의 metadata를 개별적으로 적용.

## 카테고리 선택 (LLM이 최종 결정자)
classification.top_k에는 분류기가 뽑은 3개 후보가 들어있고, 각 후보에 매핑된 departments도 함께 들어있습니다.
**confidence는 분류기 점수일 뿐, 결정의 절대 기준이 아닙니다.** 분류기는 마스킹 학습된 모델이라 표면 키워드에 끌릴 수 있습니다.

- **사용자 질문(질문 텍스트와 keywords)을 직접 읽고, top-3 후보 중 의미적으로 가장 맞는 카테고리를 LLM 본인이 고르세요.**
- confidence가 0.99여도 의미가 안 맞으면 다른 후보를 채택. confidence는 참고 정보일 뿐.
  예시: "도로 포트홀 신고" → 분류기 top-1이 '건축(0.96)' top-2가 '교통(0.03)'이어도,
       도로 위 포트홀은 명백히 교통 영역이므로 **top-2(교통)을 채택**하고 교통 부서를 안내.
- top-3 안에 적절한 카테고리가 없으면 가장 가까운 걸 고르고 "정확한 분류가 어려워 보이니 담당 부서에 직접 문의 권장" 한 줄 추가.

## 담당 부서 판단 (⭐ 매우 중요 — 부서 억지 매칭 방지)

**context.departments 는 전라남도청 산하 39개 부서만** 포함합니다.
모든 민원이 이 목록에 딱 맞는 담당이 있는 게 아닙니다. **잘못된 부서를 안내하면 시민이 잘못된 곳에 헛걸음합니다.**

**단계별 판단 (반드시 이 순서로):**
1. 이 민원이 정말 **전라남도청(지방자치) 소관**인가?
2. 아니면 다른 기관 소관인가? — 아래 "우리 소관 아닌 것" 참고
3. 아래 두 경우 중 어디에 해당하는지 판단하고 답변:

**A. 우리(도청) 소관 — 아래 유형일 때만 도청 부서 안내:**
- 도로/보도/포트홀/가로등/신호등/공원/도청 관할 시설물
- 지방세, 도청 조례/행정
- 환경/위생/청소 (지방 관할)
- 상하수도 (도청 관할 구역)
- 도청 자체 민원/문의
→ 이 경우 context.departments[0] 부서명+전화번호 자신 있게 안내

**B. 우리 소관 아닌 것 — 도청 부서 언급하지 말고 진짜 담당으로 유도:**

| 민원 성격 | 실제 담당 (여기로 안내) |
|---|---|
| **학교** (수업, 학생, 교사, 학교 시설, **학교 소음/체육대회/운동회**, 급식, 학교폭력) | 관할 교육청 (전라남도교육청 061-260-0114), 해당 학교 행정실, 교육부(1577-1577) |
| 경찰/범죄/폭력/사기/도난 | 112, 관할 경찰서 |
| 소방/화재/응급 | 119 |
| 여권/병역/출입국/특허 등 중앙 정부 소관 | 정부24 (www.gov.kr), 국민신문고 (epeople.go.kr) |
| 국세/세무 (지방세 아닌) | 국세청 126, 홈택스 |
| 노동/실업/근로/산재 | 고용노동부, 관할 고용센터 (1350) |
| 의료/건강보험 | 국민건강보험공단 1577-1000 |
| 금융/보이스피싱 | 금융감독원 1332 |
| 기타 소관 불분명 | 국민신문고 (epeople.go.kr) 접수 권장 |

**판단 예시:**
- "학교 운동장 체육대회 소음이 심해요" → 도청 관광과·문화여가과 아님. **교육청·해당 학교 안내**.
  ❌ "관광과에 문의하세요" (오답)
  ✅ "학교 소음 관련 민원은 관할 교육청(전라남도교육청)이나 해당 학교 행정실로 문의하시는 것이 정확합니다. 또는 국민신문고(epeople.go.kr)로 접수 가능합니다."
- "여권 재발급" → 도청 아님. **정부24 안내**.
- "이웃 간 소음" → 도청 관할 (환경분쟁) 또는 경찰서.
- "포트홀" → 도청 소관 (도로과) ✓
- "학교 앞 신호등 고장" → 도청/시청 교통 부서 ✓ (학교 앞이지만 도로 시설물임)

**애매하면 도청 부서 언급하지 말고 국민신문고/정부24로 유도.** 시민이 헛걸음 하는 게 최악.

## 답변 규칙
- **첫 턴만** 카테고리를 한 줄로 명시 (예: "교통 관련 민원이군요."). 후속 턴에서는 생략.
- **질문의 정보량에 답변량 맞추기**. 짧은 질문 → 짧은 답변 (2~3문장), 복잡한 질문 → 조금 더 상세 (3~5문장).
- 친절한 존댓말, 자연스러운 대화 톤.
- **잘못된 부서를 억지로 소개하지 말 것.** 소관이 애매하면 국민신문고/정부24로 유도.
- **관련 없는 사례/법령 억지로 끼워넣지 말 것.** similarity 0.5 미만이면 그냥 생략.

## 🚫 절대 금지 (할루시네이션 방지)

다음 세 항목만 **반드시 context에 명시된 값만 사용**하세요. 가짜 만들면 사용자 신뢰가 깨집니다.

1. **부서명/전화번호**: context.departments 또는 context.similar_depts에 있는 정확한 name·phone만 사용. 없는 부서나 임의 번호(예: 1234-5678) 생성 금지.

2. **법령 조항 (매우 엄격)**:
   - context.laws (또는 sub_queries[N].laws) 배열의 `title` 문자열에 있는 법명·조항만 인용 가능. **그 외 어떤 법령·조항도 절대 만들어내지 마세요.**
   - ❌ **가장 흔한 실수 — 절대 금지 예시**: "전자정부법 제14조", "지방세법 제OO조", "행정절차법에 따르면...", "형법 제172조의2" 같이 배열에 없는 조항을 임의로 언급하는 것.
   - context.laws가 빈 배열이거나 모든 similarity가 0.4 미만이면 → **법령 인용 자체를 생략**. "관련 법령이 있습니다"조차 쓰지 마세요.
   - 일반 상식으로 "이런 법이 있을 것 같다"는 추측 인용도 금지. 확실치 않으면 "법령 근거는 담당 부서에 문의 권장"으로만.
   - sub_queries가 여러 개일 때도 마찬가지 — 각 서브의 laws에 있는 것만 인용, 다른 서브의 laws나 창작 법령 금지.

3. **사례/통계 수치**: cases 배열이나 cluster.complaint_count 없으면 "사례 N건" 같은 표현 금지.

## ✅ 자유롭게 안내해도 되는 것 (위 3가지 외)

다음은 누구나 아는 공공 정보이므로 자신 있게 안내하세요:
- **공공 민원 신고 채널**: 안전신문고(safetyreport.go.kr / 앱), 국민신문고(epeople.go.kr), 정부24(www.gov.kr), 다산콜 120(서울)·110(전국 정부민원안내)
- **긴급/응급 채널**: 119(소방·응급), 112(경찰), 1332(금융감독원 보이스피싱)
- **중앙 정부·상급 기관** (지방자치 소관 아닐 때):
  - 교육 관련 → 전라남도교육청(061-260-0114), 교육부(1577-1577), 해당 학교 행정실
  - 국세 → 국세청 126, 홈택스(www.hometax.go.kr)
  - 노동/근로/실업 → 고용노동부 상담센터 1350
  - 건강보험/의료 → 국민건강보험공단 1577-1000, 국민연금공단 1355
  - 여권/출입국/병역/특허 → 정부24 또는 국민신문고
- **신고 시 일반적 첨부 자료**: 사진, 위치(도로명/지번), 발생 시각 등
- **민원 처리 일반 절차**: 접수 → 담당 부서 배정 → 처리 → 회신 흐름
- **카테고리별 상식 수준 안내**: 교통 신호 위반 신고는 스마트국민제보, 도로 시설물(포트홀 등)은 안전신문고 등

## 후속 질문 처리 (멀티턴) ⭐ 중요

**history에 직전 답변이 있으면 반드시 다음을 지키세요:**

1. **카테고리 재소개 금지** — "교통 관련 민원이군요" 같은 표현은 첫 턴에만. 후속엔 절대 X.
2. **부서/전화번호 재안내 금지** — 이미 말했으면 다시 쓰지 마세요. 유저가 "그 부서 연락처 뭐였지?" 명시적으로 물을 때만 재안내.
3. **자연스럽게 대화 이어가기** — "네, 신고 가능합니다.", "그 경우엔 ...", "말씀하신 상황이라면 ..." 같이 대화 흐름을 자연스럽게.
4. **답변 길이 축소** — 후속 답변은 2~3문장. 유저가 딱 한 가지 물었으면 딱 그것만 답.
5. **관련 없으면 사례/법령/procedures 생략** — 억지로 끼워넣지 마세요. similarity 낮으면 그냥 안 쓰기.

**나쁜 예 (지금 문제):**
- 턴1 "제 집 앞 주차 불법인가요?" → "교통 관련 민원이군요. 도로교통법... 교통행정과 061-286-7450입니다..."
- 턴2 "그러면 신고할 수 있어요?" → "교통 관련 민원에 대해 문의하셨습니다. 도로교통법... 교통행정과 061-286-7450입니다..."
  → **재소개 반복, 부서 재안내, 답변 길어짐. 나쁨.**

**좋은 예 (기대):**
- 턴2 "그러면 신고할 수 있어요?" → "네, 신고 가능합니다. 안전신문고 앱에 사진과 위치 첨부하시면 단속 공무원 현장 확인 없이도 처리됩니다."
  → **간결, 대화 이어짐, 유저가 물은 것만 답.**

**유형별 후속 응답 지침:**
- "어떻게 신고해요?" → 채널(안전신문고/국민신문고) + 필요 자료 짧게. 부서 재안내 X.
- "얼마나 걸려요?" → 일반적 기한(7~14일) 한 줄. 정확한 건 담당 부서 문의 권장.
- "다른 방법 있어요?" → 대체 채널만.
- "취소되나요?" → 조건 짧게.
- 유저가 명시적으로 새 주제로 옮긴 경우에만 카테고리 변경.

## 행정 절차 안내 활용 (context.procedures) ⭐

context.procedures는 정부24의 실제 민원 사무 카탈로그입니다. 다음 유형 질문엔 **반드시 이 데이터를 최우선 활용**하세요:

- "필요 서류가 뭐예요?" / "어떤 서류 준비해야 해요?"
- "신청 절차/방법이 어떻게 돼요?"
- "얼마나 걸려요?" / "처리 기간이?"
- "수수료는?"
- "어디서 신청해요?" / "온라인으로 되나요?"
- "○○ 발급받으려면?"

**활용 방법:**
- top-1 항목의 similarity ≥ 0.5면 그 문서 내용을 사실 그대로 인용
- content 안의 라벨(`[구비서류]`, `[처리기간]`, `[수수료]`, `[절차]`, `[소관기관]`, `[출처]`)에서 필요한 필드를 뽑아 답변에 반영
- URL이 [출처] 라벨에 있으면 자연스럽게 안내 ("정부24에서 온라인 신청 가능: https://...")
- 여러 개 관련 있으면 top-1 하나에 집중 (답변 산만해짐 방지)

**엄격 규칙 (창작 금지):**
- procedures에 없는 서류/기간/수수료를 임의로 만들지 마세요. 예: "3~5일" 같은 대충 값 금지.
- procedures가 비었거나 top-1 similarity < 0.5면 → "정확한 절차는 정부24(www.gov.kr) 또는 담당 부서에 문의 권장" 정도로 안내.
- 법령 인용 규칙과 동일 — 원문에 있는 값만.

sub_queries가 여러 개면 각 서브의 procedures를 개별적으로 활용.

## 유사 사례 활용 (context.cases)

context.cases (또는 sub_queries[N].cases)에 관련성 있는 사례가 있으면 **반드시 답변에 반영**하세요.

- **활용 조건**: similarity ≥ 0.5인 사례가 하나라도 있으면 답변에 포함
- **인용 방식**: top-1 사례 1건만 짧게 인용 (여러 개 넣으면 답변 산만)
  - 형식 예: "유사 사례로 '{title}'이 있으며, 이 경우 {content 요약}"
  - title은 metadata.cases[0].title 문자열 그대로 사용 (창작 금지)
  - content는 첫 100~200자 정도로 요약
- **위치**: 부서 안내 뒤, 신고 채널 안내 다음에 자연스럽게. 답변 맨 끝에 "다른 지자체의 유사 처리 사례를 참고하시면..." 같은 문구로
- **미활용 조건**: cases 배열이 비어있거나 top-1의 similarity < 0.5면 언급 생략
- sub_queries가 여러 개면 각 서브의 cases를 개별적으로 활용

## 조건부
- urgency.is_urgent=true 이면 답변 첫 줄에 "긴급한 상황이라면 즉시 119/112로 신고해주세요" 추가.
- cluster.complaint_count >= 10 이면 "동일 민원이 N건 접수되어 우선 처리 중입니다" 한 줄 추가.
- classification.confidence < 0.6 이면 카테고리 확정 표현 피하고 "관련 문의로 보입니다" 정도로 완곡하게.

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


# edge-tts 보이스 매핑 (기존 CLOVA speaker 이름 → Microsoft Edge Neural Voice)
_EDGE_VOICE_MAP = {
    'nara': 'ko-KR-SunHiNeural',      # 여성, 차분 (기본, 나라와 유사한 톤)
    'sunhi': 'ko-KR-SunHiNeural',
    'sun': 'ko-KR-SunHiNeural',
    'mijin': 'ko-KR-SunHiNeural',     # 여성 대체
    'jinho': 'ko-KR-InJoonNeural',    # 남성
    'injoon': 'ko-KR-InJoonNeural',
    'in': 'ko-KR-InJoonNeural',
}

# ElevenLabs 보이스 ID 매핑 (한국어는 multilingual_v2 모델로 처리)
# 'nara' (기본) = 마음결 프로젝트 확정 voice — Starter tier 이상에서 접근 가능
_ELEVEN_VOICE_MAP = {
    'nara': 'ksaI0TCD9BstzEzlxj4q',    # ⭐ 마음결 확정 voice (기본)
    'minde': 'ksaI0TCD9BstzEzlxj4q',   # 별칭
    'legacy': 'uyVNoMrnUku1dZyVEXwD',  # 이전 마음결 voice (필요 시 사용)
    'bella': 'EXAVITQu4vr4xnSDxMaL',   # 백업/대체 옵션들 (Free tier 접근 가능)
    'rachel': '21m00Tcm4TlvDq8ikWAM',
    'jinho': 'pNInz6obpgDQGcFmaJgB',   # Adam (남성)
    'adam': 'pNInz6obpgDQGcFmaJgB',
    'antoni': 'ErXwobaYiN019PkySvjV',
}

ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
ELEVENLABS_MODEL = os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2')
# env로 default voice ID 오버라이드 가능 (배포 후 voice 교체 시 코드 재배포 없이)
ELEVENLABS_DEFAULT_VOICE = os.environ.get('ELEVENLABS_DEFAULT_VOICE', 'ksaI0TCD9BstzEzlxj4q')
# ElevenLabs 재생 속도. 범위 0.7 (느림) ~ 1.2 (최대 빠름). 기본 1.0.
ELEVENLABS_SPEED = float(os.environ.get('ELEVENLABS_SPEED', '1.1'))
# 목소리 안정성. 0.0 (변화 큼, 표현력) ~ 1.0 (매우 안정, 톤 일정).
ELEVENLABS_STABILITY = float(os.environ.get('ELEVENLABS_STABILITY', '1.0'))
# 원본 voice 유사도 부스트. 0.0 ~ 1.0. 높을수록 원본 톤에 가까움.
ELEVENLABS_SIMILARITY = float(os.environ.get('ELEVENLABS_SIMILARITY', '0.5'))
# 스타일 과장. 0.0 (자연스러움, 중립) ~ 1.0 (감정/표현 과장). 민원 안내는 0 권장.
ELEVENLABS_STYLE = float(os.environ.get('ELEVENLABS_STYLE', '0.0'))


def _edge_voice(speaker: str) -> str:
    """CLOVA 스피커 이름을 edge-tts 보이스로 매핑. 모르는 이름은 SunHi로."""
    return _EDGE_VOICE_MAP.get((speaker or '').lower(), 'ko-KR-SunHiNeural')


def _eleven_voice(speaker: str) -> str:
    """스피커 이름을 ElevenLabs voice ID로 매핑. 모르는 이름은 default(env override 가능)."""
    return _ELEVEN_VOICE_MAP.get((speaker or '').lower(), ELEVENLABS_DEFAULT_VOICE)


async def _synthesize_edge(text: str, speaker: str, speed: int, volume: int, pitch: int) -> bytes:
    """edge-tts 백엔드 (무료 무제한)."""
    import edge_tts
    rate = f'{-int(speed) * 10:+d}%'
    volume_str = f'{int(volume) * 10:+d}%'
    pitch_str = f'{int(pitch) * 10:+d}Hz'
    voice = _edge_voice(speaker)
    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume_str, pitch=pitch_str)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk.get('type') == 'audio':
            chunks.append(chunk['data'])
    return b''.join(chunks)


async def _synthesize_eleven(text: str, speaker: str) -> bytes:
    """ElevenLabs 백엔드 (월 10,000자 무료, 그 이상 유료)."""
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY 환경변수가 없습니다.")
    import httpx
    voice_id = _eleven_voice(speaker)
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
    headers = {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
    }
    body = {
        'text': text,
        'model_id': ELEVENLABS_MODEL,
        # 텍스트 정규화 강제 활성화 — 숫자/약어를 자연스러운 발음으로 변환.
        # "auto"는 종종 정규화 안 됨. "on"이면 웹사이트처럼 확실히 처리.
        'apply_text_normalization': 'on',
        'voice_settings': {
            'stability': ELEVENLABS_STABILITY,       # 1.0 = 매우 안정 (톤 일정)
            'similarity_boost': ELEVENLABS_SIMILARITY,
            'style': ELEVENLABS_STYLE,               # 0.0 = 중립 (민원 안내에 적합)
            'speed': ELEVENLABS_SPEED,               # 1.0 = 보통
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.post(url, headers=headers, json=body)
        resp.raise_for_status()
        return resp.content


async def synthesize_speech(
    text: str,
    speaker: str = "nara",
    speed: int = 0,
    volume: int = 0,
    pitch: int = 0,
    audio_format: str = "mp3",
    provider: str = "edge",
) -> bytes:
    """텍스트를 음성으로 변환 (edge-tts 기본, ElevenLabs 옵션).

    Args:
        text: 변환할 텍스트
        speaker: 보이스 이름 (provider별 매핑됨)
          - edge: nara/sun/sunhi → SunHi (여성), jinho/injoon → InJoon (남성)
          - eleven: nara/bella → Bella (여성), jinho/adam → Adam (남성), rachel, antoni 등
        speed/volume/pitch: -5~5. edge-tts 전용 (eleven은 무시).
        audio_format: mp3 (양쪽 동일).
        provider: "edge" (기본, 무료 무제한) | "eleven" (ElevenLabs, 월 10K자 한도)

    Returns:
        mp3 raw bytes. 빈 입력이면 빈 bytes.

    Raises:
        RuntimeError: provider='eleven'인데 ELEVENLABS_API_KEY 환경변수 없을 때
        httpx.HTTPStatusError: ElevenLabs 호출 실패 (한도 초과 등)

    사용 예:
        audio = await svc.synthesize_speech("안녕하세요")                      # edge (기본)
        audio = await svc.synthesize_speech("안녕", provider="eleven")         # ElevenLabs
        audio = await svc.synthesize_speech("Hi", speaker="rachel", provider="eleven")
    """
    if not text or not text.strip():
        return b''

    provider = (provider or 'edge').lower()
    if provider == 'eleven' or provider == 'elevenlabs':
        return await _synthesize_eleven(text, speaker)
    return await _synthesize_edge(text, speaker, speed, volume, pitch)


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


DECOMPOSE_PROMPT = """\
당신은 사용자 민원 텍스트가 몇 개의 독립 민원(서로 다른 도메인/담당 부서)을 포함하는지 판단하는 도우미입니다.

## 판단 규칙

**두 개 이상으로 분리하는 경우 (핵심):**
- 서로 다른 공공 도메인이 병렬로 등장할 때. 도메인 예시: 교통/건축/세무/환경/복지/상하수도/보건위생/문화_여가/농축산/경제/행정
- "A했는데 B도", "A랑 B", "A하고 B도" 같은 병렬 접속 표현이 다른 도메인을 연결하면 분리
- 예:
  - "포트홀 신고했는데 자동차세 감면도 문의드려요" → 2개 (교통 + 세무)
  - "쓰레기 무단투기랑 노인복지 문의" → 2개 (환경 + 복지)
  - "도서관 운영시간이랑 재산세 납부" → 2개 (문화_여가 + 세무)

**하나로 유지하는 경우:**
- 후속 질문 ("그럼 어떻게 신고?", "얼마나 걸려요?", "취소할 수 있어요?")
- 같은 도메인 안의 원인·피해·상황 설명 ("도로에 포트홀이 나서 차가 망가질 것 같아 신고합니다")
- 이미지 분석 결과가 포함된 텍스트도 하나로 유지

## 출력 형식

정확히 JSON 객체 하나. 다른 말 절대 금지.
{"queries": ["질문1", "질문2"]}
"""


async def decompose_query(text: str, history: Optional[list[dict]] = None) -> list[str]:
    """민원 텍스트를 독립 서브 민원 리스트로 분해.

    - 하나면 [원문] 반환
    - 여러 개면 각각 자연스러운 문장으로 분리한 리스트 반환
    - 실패 시 [원문] fallback (안전)

    Args:
        text: 사용자 현재 발언
        history: (선택) 이전 대화 — 후속 질문 판단 참고용

    Returns:
        list[str]: 서브 민원 리스트. 항상 최소 1개.
    """
    text = (text or '').strip()
    if not text:
        return []

    import json as _json
    client = _get_openai()

    messages = [{"role": "system", "content": DECOMPOSE_PROMPT}]
    if history:
        for m in history[-6:]:  # 최근 3턴만
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": text})

    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0,
            max_tokens=500,
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or '').strip()
        parsed = _json.loads(raw)
        queries = parsed.get('queries', [])
        cleaned = [q.strip() for q in queries if isinstance(q, str) and q.strip()]
        if not cleaned:
            return [text]
        return cleaned
    except Exception:
        return [text]


# ============================================================
# 서식 자동 작성 — PDF 근접 텍스트 캐시
# ============================================================
_pdf_layout_cache: dict[str, list[dict]] = {}


def _load_pdf_layout(pdf_path: str) -> list[dict]:
    """PDF 파싱해서 페이지별 words + tables 반환 + 캐싱.

    각 페이지: {width, height, words: [{text, cx, cy}], tables: [{bbox, rows: [[{bbox, text}]]}]}
    좌표는 pt, 좌상단 원점.
    실패 시 [] 반환 (호출 측이 안전하게 빈 결과로 fallback).
    """
    if pdf_path in _pdf_layout_cache:
        return _pdf_layout_cache[pdf_path]
    try:
        import pdfplumber
    except ImportError:
        _pdf_layout_cache[pdf_path] = []
        return []
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages:
                words = p.extract_words()
                # 표 감지 + 셀 격자 추출
                tables = []
                try:
                    for t in p.find_tables():
                        grid = t.extract() or []
                        row_data = []
                        for i, row in enumerate(t.rows):
                            row_cells = []
                            # row.cells는 각 셀의 bbox (튜플) or None (merged)
                            cell_bboxes = getattr(row, "cells", None) or []
                            for j, cell_bbox in enumerate(cell_bboxes):
                                text = ""
                                if i < len(grid) and j < len(grid[i]):
                                    raw = grid[i][j]
                                    if raw:
                                        text = str(raw).replace("\n", " ").strip()
                                row_cells.append({"bbox": cell_bbox, "text": text})
                            row_data.append(row_cells)
                        tables.append({"bbox": t.bbox, "rows": row_data})
                except Exception:
                    tables = []
                # 페이지 전체 텍스트 (라인 단위, 상단부터)
                try:
                    full_text = p.extract_text() or ""
                except Exception:
                    full_text = ""
                pages.append({
                    "width": p.width,
                    "height": p.height,
                    "words": [
                        {
                            "text": w["text"],
                            "cx": (w["x0"] + w["x1"]) / 2,
                            "cy": (w["top"] + w["bottom"]) / 2,
                        }
                        for w in words
                    ],
                    "tables": tables,
                    "full_text": full_text,
                })
    except Exception:
        pages = []
    _pdf_layout_cache[pdf_path] = pages
    return pages


def _field_table_context(layout: list[dict], page_idx: int, x_mm: float, y_mm: float) -> dict | None:
    """(x_mm, y_mm)가 어느 표의 어느 셀에 있는지 → {row_header, col_header}.

    행 헤더 = 같은 행 최좌측 텍스트 셀, 열 헤더 = 같은 열 최상단 텍스트 셀.
    표 밖이면 None.
    """
    if not layout or page_idx >= len(layout):
        return None
    page = layout[page_idx]
    x_pt = x_mm * _MM_TO_PT
    y_pt_top = page["height"] - y_mm * _MM_TO_PT
    for table in page.get("tables", []):
        tb = table["bbox"]
        if not (tb[0] <= x_pt <= tb[2] and tb[1] <= y_pt_top <= tb[3]):
            continue
        rows = table["rows"]
        for i, row in enumerate(rows):
            for j, cell in enumerate(row):
                bbox = cell.get("bbox")
                if not bbox:
                    continue
                cx0, ctop, cx1, cbottom = bbox
                if not (cx0 <= x_pt <= cx1 and ctop <= y_pt_top <= cbottom):
                    continue
                # 행 헤더: 같은 행 왼쪽에서 첫 번째 텍스트 셀
                row_header = ""
                for c in row:
                    t = (c.get("text") or "").strip()
                    if t:
                        row_header = t
                        break
                # 열 헤더: 같은 열 위쪽에서 첫 번째 텍스트 셀
                col_header = ""
                for other_row in rows:
                    if j < len(other_row):
                        t = (other_row[j].get("text") or "").strip()
                        if t:
                            col_header = t
                            break
                # 자기 자신이 헤더로 잡히면 (헤더 셀 자체를 채우는 필드) 무시
                cell_text = (cell.get("text") or "").strip()
                if row_header == cell_text:
                    row_header = ""
                if col_header == cell_text:
                    col_header = ""
                if row_header or col_header:
                    return {"row_header": row_header, "col_header": col_header}
                return None
    return None


_MM_TO_PT = 72.0 / 25.4   # 팀 메타데이터 좌표는 mm, pdfplumber는 pt


def _nearby_texts(layout: list[dict], page_idx: int, x_mm: float, y_mm: float,
                  radius_pt: float = 25.0, top_k: int = 5) -> list[str]:
    """(x_mm, y_mm) 좌표 근처 단어 top_k (근접순).

    메타데이터 좌표는 mm + Y 하단원점 → pdfplumber pt + Y 상단원점으로 변환.
    """
    if not layout or page_idx >= len(layout):
        return []
    page = layout[page_idx]
    x_pt = x_mm * _MM_TO_PT
    y_pt_top = page["height"] - y_mm * _MM_TO_PT
    hits: list[tuple[float, str]] = []
    for w in page["words"]:
        dx = w["cx"] - x_pt
        dy = w["cy"] - y_pt_top
        dist = (dx * dx + dy * dy) ** 0.5
        if dist <= radius_pt:
            hits.append((dist, w["text"]))
    hits.sort(key=lambda t: t[0])
    # 완전 중복 텍스트 제거
    seen = set()
    result = []
    for _, t in hits:
        if t in seen:
            continue
        seen.add(t)
        result.append(t)
        if len(result) >= top_k:
            break
    return result


def _flatten_field_mappings(field_mappings) -> list[dict]:
    """팀 표준 메타데이터(페이지 배열)를 flat 리스트로 정규화.

    입력 형식 두 가지 지원:
    A) 팀 표준: [[{name, type, position:[x,y], font?, size?, align?}, ...], [], ...]
    B) 예전 형식: [{key, x, y, label?, multiline?, ...}, ...]  (하위 호환)

    반환: [{key, x, y, page, type, font?, size?, align?, ...}]
    중복 name은 _2, _3 접미로 dedupe (렌더링용 좌표는 각각 다르니 데이터로선 별개).
    """
    flat = []
    seen = {}   # name → count

    def push(entry: dict, page_idx: int):
        raw_name = entry.get("name") or entry.get("key")
        if not raw_name:
            return
        # dedupe
        seen[raw_name] = seen.get(raw_name, 0) + 1
        key = raw_name if seen[raw_name] == 1 else f"{raw_name}_{seen[raw_name]}"

        pos = entry.get("position")
        x = entry.get("x")
        y = entry.get("y")
        if isinstance(pos, (list, tuple)) and len(pos) >= 2:
            x, y = pos[0], pos[1]

        out = {
            "key": key,
            "page": page_idx,
            "x": x,
            "y": y,
            "type": entry.get("type", "text"),
        }
        for k in ("label", "font", "size", "align", "width", "height",
                  "multiline", "auto_fill_from", "auto_generated"):
            if entry.get(k) is not None:
                out[k] = entry[k]
        flat.append(out)

    if not field_mappings:
        return flat

    # 형식 A: 첫 원소가 list이면 페이지 배열
    if isinstance(field_mappings, list) and field_mappings and isinstance(field_mappings[0], list):
        for pi, page in enumerate(field_mappings):
            for item in (page or []):
                if isinstance(item, dict):
                    push(item, pi)
    # 형식 B: flat 리스트
    elif isinstance(field_mappings, list):
        for item in field_mappings:
            if isinstance(item, dict):
                push(item, 0)
    return flat


async def generate_form_summary(pdf_path: str, template_name: str = "",
                                 template_desc: str = "") -> str:
    """PDF 전문을 LLM에 통독시켜 서식 사전 요약을 생성 (한 서식당 1회 호출).

    반환 요약은 form_templates.summary에 저장해 두면
    이후 매 fill_form_fields 요청 시 프롬프트에 짧게 붙일 수 있음.
    """
    layout = _load_pdf_layout(pdf_path)
    if not layout:
        return ""
    # 페이지별 전문을 이어붙임 (페이지당 최대 3000자)
    parts = []
    for pi, page in enumerate(layout):
        ft = (page.get("full_text") or "").strip()
        if not ft:
            continue
        parts.append(f"[페이지 {pi}]\n{ft[:3000]}")
    if not parts:
        return ""
    all_text = "\n\n".join(parts)

    system = (
        "너는 공공 민원 서식 요약 도우미다. "
        "주어진 서식 전문을 읽고, AI가 나중에 이 서식의 필드를 자동 채울 때 참고할 "
        "'서식 이해 요약'을 만든다. 형식은 자유롭지만 다음을 포함하라:\n"
        "1) 서식의 목적 (누가 언제 왜 쓰는지)\n"
        "2) 주요 섹션 구성 (섹션 이름과 순서)\n"
        "3) 체크박스 그룹들의 의미와 배타/독립 여부\n"
        "4) 판단 기준 (예: 특수관계인·조정대상지역 정의, 관계 분류 등)\n"
        "5) 데이터 필드가 요구하는 정보의 성격 (짧은 텍스트/금액/날짜/서명 등)\n"
        "800자 이내로 간결하게. 이후 LLM 프롬프트에 붙일 것이므로 "
        "명확하고 규칙 위주로."
    )
    user = f"서식 이름: {template_name}\n서식 설명: {template_desc}\n\n서식 전문:\n{all_text}"

    client = _get_openai()
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
            max_tokens=1200,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""


# mm ↔ pt 변환 상수 (PDF는 pt, 팀 메타데이터는 mm)
_PT_PER_MM = 72.0 / 25.4
_MM_PER_PT = 25.4 / 72.0


def _expand_table_rows_from_anchors(field_mappings, pdf_path: str) -> list:
    """팀 좌표를 앵커로 삼아 PyMuPDF로 그 행의 모든 셀 자동 확장.

    핵심 아이디어:
    - 팀이 표 안의 셀(예: '취득세' 행 라벨) 하나만 찍어도
    - PyMuPDF가 그 위치를 포함한 표를 찾아 그 행의 모든 셀 좌표를 자동 뽑음
    - 이름: {team_field_name}_{col_header}
    - 결과: 팀 metadata + 자동 확장 셀들 병합

    - pdfplumber(_generate_table_cell_fields)와 상호 보완:
      * 이 함수는 팀 앵커 기반 확장 → 팀이 안 찍은 표는 자동 확장 X
      * pdfplumber 버전은 표 전체를 탐지 → 좌표 정확도 살짝 낮을 수 있음
    - 둘 다 auto_generated=True 플래그로 라벨 정리 로직 공유
    """
    if not field_mappings or not pdf_path:
        return field_mappings
    try:
        import fitz
    except ImportError:
        return field_mappings
    if not os.path.exists(pdf_path):
        return field_mappings

    MM_PT = 72.0 / 25.4
    PT_MM = 25.4 / 72.0

    is_page_structured = (
        isinstance(field_mappings, list) and field_mappings
        and isinstance(field_mappings[0], list)
    )
    pages = field_mappings if is_page_structured else [field_mappings]

    doc = fitz.open(pdf_path)
    try:
        result_pages = []
        for pi, page_fields in enumerate(pages):
            merged = list(page_fields)
            if pi >= len(doc):
                result_pages.append(merged)
                continue
            page = doc[pi]
            h_pt = page.rect.height
            try:
                tables = list(page.find_tables())
            except Exception:
                tables = []

            # 이미 추가된 자동 셀 위치 (중복 방지)
            existing_positions = []
            for f in page_fields:
                pos = f.get("position") or []
                if isinstance(pos, list) and len(pos) >= 2:
                    existing_positions.append((float(pos[0]), float(pos[1])))

            processed_row_ids = set()  # (table_index, row_index) 중복 처리 방지

            for tf in page_fields:
                name = tf.get("name") or tf.get("key") or ""
                pos = tf.get("position") or []
                if len(pos) < 2:
                    continue
                team_x_pt = float(pos[0]) * MM_PT
                team_y_pt = h_pt - float(pos[1]) * MM_PT

                # 이 앵커를 포함하는 표 찾기
                containing_ti = None
                containing = None
                for ti, t in enumerate(tables):
                    b = t.bbox
                    if b[0] <= team_x_pt <= b[2] and b[1] <= team_y_pt <= b[3]:
                        containing_ti = ti
                        containing = t
                        break
                if not containing:
                    continue

                # 이 앵커의 행 인덱스 찾기
                row_idx = None
                for ri, row in enumerate(containing.rows):
                    for cell_bbox in (row.cells or []):
                        if not cell_bbox:
                            continue
                        if (cell_bbox[0] <= team_x_pt <= cell_bbox[2]
                                and cell_bbox[1] <= team_y_pt <= cell_bbox[3]):
                            row_idx = ri
                            break
                    if row_idx is not None:
                        break
                if row_idx is None:
                    continue

                # 같은 (표, 행) 중복 처리 방지
                if (containing_ti, row_idx) in processed_row_ids:
                    continue
                processed_row_ids.add((containing_ti, row_idx))

                # 첫 행을 헤더로 (텍스트 정규화: 자간 공백 붙임)
                grid = containing.extract() or []
                col_headers = []
                if grid:
                    for c in grid[0]:
                        s = str(c or "").replace("\n", " ").strip()
                        parts = s.split()
                        if parts and all(len(p) == 1 for p in parts):
                            s = "".join(parts)
                        col_headers.append(s)

                # 이 행의 모든 셀 좌표 자동 추출
                row = containing.rows[row_idx]
                for ci, cell_bbox in enumerate(row.cells or []):
                    if not cell_bbox:
                        continue
                    # PDF에 이미 텍스트가 있는 셀 (헤더/라벨) 스킵
                    cell_text = ""
                    if row_idx < len(grid) and ci < len(grid[row_idx]):
                        cell_text = str(grid[row_idx][ci] or "").strip()
                    if cell_text:
                        continue

                    cx_pt = (cell_bbox[0] + cell_bbox[2]) / 2
                    cy_pt = (cell_bbox[1] + cell_bbox[3]) / 2
                    cx_mm = cx_pt * PT_MM
                    cy_mm = (h_pt - cy_pt) * PT_MM

                    # 기존 팀 좌표와 겹치는지 확인 (±3mm)
                    dup = False
                    for ex, ey in existing_positions:
                        if abs(ex - cx_mm) < 3 and abs(ey - cy_mm) < 3:
                            dup = True
                            break
                    if dup:
                        continue

                    col_h = col_headers[ci] if ci < len(col_headers) else f"col{ci}"
                    if not col_h:
                        col_h = f"col{ci}"
                    new_name = f"{name}_{col_h}"

                    merged.append({
                        "name": new_name,
                        "type": "text",
                        "position": [round(cx_mm, 2), round(cy_mm, 2)],
                        "size": 9.0,
                        "font": "DEFAULT_LIGHT",
                        "align": "left",
                        "auto_generated": True,
                    })
                    existing_positions.append((cx_mm, cy_mm))

            result_pages.append(merged)
    finally:
        doc.close()

    return result_pages if is_page_structured else result_pages[0]


def _generate_table_cell_fields(field_mappings, pdf_path: str | None) -> list:
    """PDF의 감지된 표 셀 중 팀이 아직 좌표를 안 찍은 셀에 대해 자동 좌표·명명 생성.

    이제 두 접근을 순차 적용:
    1) 팀 앵커 기반 행 확장 (PyMuPDF) — 정확도 높음, 앵커 있는 행만
    2) pdfplumber 표 전체 감지 — 앵커 없는 표도 커버, 정확도 살짝 낮음

    반환: 기존 field_mappings + 자동 생성 셀 병합된 페이지 배열.
    이름 규칙: {row_label}_{col_header} (헤더 없으면 표 인덱스·행열 번호로 fallback)

    중복 방지:
    - PDF에 이미 값이 인쇄된 셀 (표 헤더·라벨 등) → 스킵
    - 기존 팀 좌표가 셀 안(±3mm)에 있으면 → 스킵
    - LLM이 auto_generated 플래그로 자동 생성 필드 구분 가능
    """
    # 1단계: PyMuPDF 앵커 기반 확장 (팀이 안 찍은 세부 셀들)
    field_mappings = _expand_table_rows_from_anchors(field_mappings, pdf_path)

    if not field_mappings or not pdf_path:
        return field_mappings
    layout = _load_pdf_layout(pdf_path)
    if not layout:
        return field_mappings

    # 페이지 배열 구조로 정규화
    is_page_structured = (
        isinstance(field_mappings, list) and field_mappings
        and isinstance(field_mappings[0], list)
    )
    pages = field_mappings if is_page_structured else [field_mappings]

    result_pages = []
    for pi, page in enumerate(pages):
        merged = list(page)
        if pi >= len(layout):
            result_pages.append(merged)
            continue
        page_layout = layout[pi]
        h_pt = page_layout.get("height", 842)
        tables = page_layout.get("tables") or []

        # 기존 필드 위치를 mm(bottom-origin)로 수집
        existing_positions = []
        for f in page:
            pos = f.get("position") or []
            if isinstance(pos, list) and len(pos) >= 2:
                existing_positions.append((float(pos[0]), float(pos[1])))

        for ti, table in enumerate(tables):
            rows = table.get("rows") or []
            if len(rows) < 2:
                continue  # 헤더 + 데이터 최소 2행 필요

            # 열 헤더 (첫 행의 텍스트)
            col_headers = []
            for cell in rows[0]:
                text = (cell.get("text") or "").strip()
                col_headers.append(text)

            for ri, row in enumerate(rows):
                if ri == 0:
                    continue  # 헤더 행 스킵

                # 행 라벨 (같은 행 최좌측 텍스트 셀)
                row_label = ""
                for cell in row:
                    t = (cell.get("text") or "").strip()
                    if t:
                        row_label = t
                        break

                for ci, cell in enumerate(row):
                    bbox = cell.get("bbox")
                    if not bbox:
                        continue
                    cx0, ctop, cx1, cbottom = bbox
                    cell_text = (cell.get("text") or "").strip()
                    if cell_text:
                        continue  # PDF에 이미 텍스트가 있는 셀 (헤더·라벨·기본값) 스킵

                    # 셀 중앙 좌표 → mm (bottom-origin)
                    cx_pt = (cx0 + cx1) / 2
                    cy_pt = (ctop + cbottom) / 2
                    cx_mm = cx_pt * _MM_PER_PT
                    cy_mm = (h_pt - cy_pt) * _MM_PER_PT

                    # 기존 팀 좌표가 셀 안(±3mm)에 있으면 스킵 (중복 방지)
                    dup = False
                    for ex, ey in existing_positions:
                        if abs(ex - cx_mm) < 3 and abs(ey - cy_mm) < 3:
                            dup = True
                            break
                    if dup:
                        continue

                    # 이름 생성
                    col_header = col_headers[ci].strip() if ci < len(col_headers) else ""

                    def _clean_label(s: str) -> str:
                        """개행·자간 공백 정리. 한글 단문자 열거는 붙여씀 (예: '세 액 감 면' → '세액감면')."""
                        parts = s.split()
                        if not parts:
                            return ""
                        # 모두 1글자 조각이면 붙여씀 (PDF 자간 공백 케이스)
                        if all(len(p) == 1 for p in parts):
                            return "".join(parts)
                        return " ".join(parts)

                    row_label_clean = _clean_label(row_label)
                    col_header_clean = _clean_label(col_header)
                    if row_label_clean and col_header_clean:
                        name = f"{row_label_clean}_{col_header_clean}"
                    elif row_label_clean:
                        name = f"{row_label_clean}_col{ci}"
                    elif col_header_clean:
                        name = f"r{ri}_{col_header_clean}"
                    else:
                        name = f"표{ti}_r{ri}_c{ci}"

                    # 자동 생성 필드 추가
                    merged.append({
                        "name": name,
                        "type": "text",
                        "position": [round(cx_mm, 2), round(cy_mm, 2)],
                        "size": 9.0,
                        "font": "DEFAULT_LIGHT",
                        "align": "left",
                        "auto_generated": True,
                    })
                    existing_positions.append((cx_mm, cy_mm))
        result_pages.append(merged)

    return result_pages if is_page_structured else result_pages[0]


def _is_checkbox_field(name: str) -> bool:
    """필드명이 체크박스 형태인지 판정.

    한 필드 안에 이미 옵션이 2개 이상 포함된 경우(예: `□ 포함 □ 제외`)는
    체크박스가 아닌 텍스트 값 필드로 취급 (배타 그룹 감지에서 제외).
    - `[]`, `[ ]`, `[  ]` 등 대괄호 안 공백 개수 무관하게 인식.
    """
    if not name:
        return False
    import re as _re
    # □ 또는 [<공백>*] 패턴을 체크박스 마커로 간주
    marker_count = name.count("□") + len(_re.findall(r"\[\s*\]", name))
    if marker_count >= 2:
        return False
    if marker_count == 1:
        return True
    return False


def _detect_exclusive_groups(fields: list[dict]) -> list[list[str]]:
    """필드들 중 배타 그룹(하나만 V) 자동 감지.

    감지 기준:
    1) 같은 페이지 + y ±3pt (같은 행) 내 체크박스 여러 개 → 배타 후보
    2) 이름 패턴 유사 (`GROUP □ VALUE_A`, `GROUP □ VALUE_B`) → 배타
    3) 알려진 배타 쌍 (`여`/`부`, `포함`/`제외`, `해당`/`해당 없음`)
    """
    groups: list[list[str]] = []
    seen_keys: set[str] = set()

    # 1) 같은 y ±3pt 클러스터 내 체크박스
    # 페이지별로 정렬
    by_page: dict[int, list[dict]] = {}
    for f in fields:
        if f.get("type") == "image":
            continue
        name = f.get("key", "")
        if not _is_checkbox_field(name):
            continue
        page = f.get("page", 0)
        by_page.setdefault(page, []).append(f)

    def _shared_prefix(name: str) -> str:
        """이름에서 접두어(`GROUP □ ...` 형태의 GROUP) 추출. 없으면 빈 문자열."""
        if " □ " in name:
            return name.split(" □ ", 1)[0].strip()
        return ""

    for page, page_fields in by_page.items():
        # y 기준 정렬
        page_fields.sort(key=lambda f: f.get("y", 0))
        used = set()
        for i, f in enumerate(page_fields):
            if f["key"] in used:
                continue
            cluster = [f]
            f_prefix = _shared_prefix(f["key"])
            for g in page_fields[i + 1:]:
                if g["key"] in used:
                    continue
                if abs(g.get("y", 0) - f.get("y", 0)) > 3.0:
                    continue
                g_prefix = _shared_prefix(g["key"])
                # 둘 다 GROUP □ VALUE 패턴이면 접두어가 같아야 배타 그룹
                if f_prefix and g_prefix and f_prefix != g_prefix:
                    continue
                cluster.append(g)
            if len(cluster) >= 2:
                key_list = [c["key"] for c in cluster]
                # 이미 다른 그룹에 포함된 키가 하나라도 있으면 스킵
                if not any(k in seen_keys for k in key_list):
                    groups.append(key_list)
                    seen_keys.update(key_list)
                    for c in cluster:
                        used.add(c["key"])

    # 2) 접두어 공유 (조정대상지역 □ 여 / 조정대상지역 □ 부)
    def _prefix(name: str) -> str | None:
        # `PREFIX □ VALUE` 패턴
        if " □ " in name:
            return name.split(" □ ")[0]
        return None

    by_prefix: dict[str, list[str]] = {}
    for f in fields:
        if f.get("type") == "image":
            continue
        name = f.get("key", "")
        p = _prefix(name)
        if p and name not in seen_keys:
            by_prefix.setdefault(p, []).append(name)
    for p, keys in by_prefix.items():
        if len(keys) >= 2:
            groups.append(keys)
            seen_keys.update(keys)

    # 3) 특수 알려진 쌍 (여/부, 포함/제외, 해당/해당 없음)
    KNOWN_PAIRS = [
        (["□ 포함", "□ 제외"], None),
        (["□ 해당 없음", "□ 해당"], None),
    ]
    for pair_keys, _ in KNOWN_PAIRS:
        # 같은 y (±3) 내 있으면 그룹으로
        # 이미 clustering으로 잡혔을 확률 높음. skip.
        pass

    return groups


# 프론트가 폼 초기값으로 넣는 플레이스홀더/테스트 문자열 목록
# 이런 값은 사용자가 실제로 입력한 것이 아니므로 current_fields에서 제거해 LLM 오염 방지
_PLACEHOLDER_VALUES = {"태스터", "테스트", "test", "TEST", "샘플", "sample", "placeholder"}


def _sanitize_current_fields(current_fields: dict | None) -> dict:
    """current_fields에서 명백한 플레이스홀더 값을 제외."""
    if not current_fields:
        return {}
    clean = {}
    for k, v in current_fields.items():
        if isinstance(v, str) and v.strip() in _PLACEHOLDER_VALUES:
            continue
        clean[k] = v
    return clean


async def fill_form_fields(
    template: dict,
    user_message: str | None = None,
    session_messages: Optional[list[dict]] = None,
    current_fields: Optional[dict] = None,
    user_context: Optional[dict] = None,
    pdf_path: str | None = None,
) -> tuple[dict, str]:
    """서식 필드 AI 자동 채우기.

    Args:
        template: {name, description, field_mappings} — field_mappings는 좌표 힌트로만 사용
        user_message: 이 서식 화면에서 사용자가 새로 입력한 텍스트 (없을 수 있음)
        session_messages: 챗봇 상담 세션에서 넘어온 대화 이력 (없을 수 있음)
        current_fields: 이전에 채워진 값 or 사용자가 직접 수정한 값 (반복 갱신용)
        user_context: 사용자 정보 {'name': '...', 'phone': '...'} — LLM이 프롬프트에서 활용,
            그리고 auto_fill_from 지정 필드는 서버가 강제 덮어씀.
        pdf_path: 실제 PDF 파일 경로. 주면 각 필드 좌표 근처 텍스트를 뽑아 LLM 힌트에 포함
            → 라벨 없는 □ 체크박스, 중복 필드명 애매성 해결. 없어도 동작.

    Returns:
        (fields, message):
          - fields: {field_key: value} — LLM이 채운 값. type='image' 필드는 제외.
          - message: 자연어 응답 (뭘 채웠는지 or 뭐가 더 필요한지). 프론트가 대화창에 그대로 표시.

    실패 시 (current_fields, 오류 안내 문구) 반환 (안전).
    """
    import json as _json
    field_mappings = template.get("field_mappings") or []
    fields = _flatten_field_mappings(field_mappings)
    # 프론트가 실수로 넣은 플레이스홀더 값 제거
    current_fields = _sanitize_current_fields(current_fields)
    if not fields:
        return (current_fields or {}, "이 서식은 채울 필드가 없습니다.")

    # PDF 근접 텍스트 로딩 (있으면). 캐싱되어 있어서 재호출 부담 X.
    pdf_layout = _load_pdf_layout(pdf_path) if pdf_path else []

    # 사용자 계정 이름이 플레이스홀더 성격이면 (테스트 계정) auto-fill 방지
    # → 발표·데모 시 "태스터" 같은 계정명이 신청인 필드에 자동 채워지는 것 방지
    if user_context and isinstance(user_context.get("name"), str):
        _name = user_context["name"].strip()
        if _name in _PLACEHOLDER_VALUES:
            user_context = {k: v for k, v in user_context.items() if k != "name"}

    # 자동 생성 필드의 행 라벨 접두어 미리 뽑기 → 원본 필드가 이 라벨과 겹치면
    # 표의 행 라벨 셀임 (PDF에 이미 라벨 인쇄됨) → LLM 프롬프트에서 제외해 혼동 방지.
    auto_label_prefixes = set()
    for f in fields:
        if f.get("auto_generated"):
            k = f.get("key", "")
            if "_" in k:
                auto_label_prefixes.add(k.rsplit("_", 1)[0])

    def _is_row_label(field_key: str, is_auto: bool) -> bool:
        if is_auto:
            return False
        for prefix in auto_label_prefixes:
            if not prefix:
                continue
            if field_key == prefix or field_key in prefix or prefix in field_key:
                return True
        return False

    # 좌표/라벨 정보를 LLM 힌트로 정리 (image type 제외 — 값 안 뱉음)
    hints = []
    auto_fill_map = {}   # {key: user_context 필드명}
    text_keys: list[str] = []
    label_keys: set[str] = set()   # 라벨 성격 필드 (프롬프트에서 제외, 결과는 빈값)
    for f in fields:
        if f.get("type") == "image":
            continue
        key = f.get("key")
        if not key:
            continue
        text_keys.append(key)
        is_auto = bool(f.get("auto_generated"))
        # 원본 필드가 자동 라벨과 이름 겹치면 라벨 성격 → LLM에게 안 보임
        if _is_row_label(key, is_auto):
            label_keys.add(key)
            continue
        parts = [f'"{key}"']
        if is_auto:
            parts.append("[표셀,사용자가 명시한 값만]")
        if f.get("label"):
            parts.append(f'라벨={f["label"]}')
        if f.get("multiline"):
            parts.append("긴 서술문")
        if f.get("width"):
            parts.append(f'가로={f["width"]}')
        if f.get("x") is not None and f.get("y") is not None:
            parts.append(f'p{f.get("page", 0)}(x={f["x"]:.0f},y={f["y"]:.0f})')
        # PDF 컨텍스트 (있으면) — 표 위치(행/열 헤더) + 근처 텍스트
        if pdf_layout and f.get("x") is not None and f.get("y") is not None:
            tc = _field_table_context(
                pdf_layout, f.get("page", 0),
                float(f["x"]), float(f["y"]),
            )
            if tc:
                rh = tc.get("row_header") or ""
                ch = tc.get("col_header") or ""
                parts.append(f'표[행:{rh}, 열:{ch}]')
            near = _nearby_texts(
                pdf_layout, f.get("page", 0),
                float(f["x"]), float(f["y"]),
                radius_pt=25.0, top_k=5,
            )
            if near:
                parts.append("주변=" + "/".join(near))
        hints.append("  - " + ", ".join(parts))
        af = f.get("auto_fill_from")
        if af:
            auto_fill_map[key] = af

    system_prompt = (
        "너는 민원 서식 자동 작성 도우미다. "
        "사용자 대화를 참고해 서식의 각 필드에 어울리는 값을 뽑아 답한다.\n"
        "출력 형식:\n"
        "  반드시 다음 스키마의 JSON 오브젝트 하나로만 답한다.\n"
        "  {\n"
        '    \"fields\": {필드key: 값, ...},\n'
        '    \"message\": \"사용자에게 보여줄 자연어 응답 (짧게, 2~3문장)\"\n'
        "  }\n"
        "message 규칙 (사용자 발화 유형별 응답 스타일):\n"
        "  1) **질문형** (\"무슨 정보 필요해?\", \"뭐 써야 해?\", \"어떤 내용 있어?\", \"안내해줘\") → \n"
        "     필드 목록을 자연스러운 문장으로 설명. 예: \"동물등록 신청서엔 신청인 정보(성명·주민번호·주소·연락처), 반려동물 정보(이름·품종·성별·중성화 여부·특징), 등록 유형을 적어야 해요. 어떤 것부터 알려주시겠어요?\"\n"
        "     - 필드가 많으면 큰 카테고리로 묶어 소개.\n"
        "  2) **정보 제공형** (\"홍길동이야\", \"주소는 서울...\") → \n"
        "     fields에 반영하고 뭘 채웠는지 짧게 확인 + 다음 필요한 정보 안내. 예: \"성함과 주소 반영했어요. 반려동물 이름과 품종도 알려주시겠어요?\"\n"
        "  3) **잡담·의도만** (\"같이 써보자\", \"작성해줘\") → \n"
        "     서식 목적을 간단히 알려주고 시작. 예: \"동물등록 신청서 작성 도와드릴게요. 우선 반려동물 이름부터 알려주시겠어요?\"\n"
        "  4) **불만·항의** (\"왜 마음대로 채워?\", \"이상해\") → \n"
        "     사과 + 상황 재설명. 예: \"죄송해요, 사용자님이 아직 정보를 안 주셨네요. 반영할 내용을 알려주시면 채워드릴게요.\"\n"
        "  5) **애매·확인** (\"이거 맞아?\", \"다 됐어?\") → \n"
        "     현재 채워진 내용 요약 + 남은 필드 안내.\n"
        "일반 규칙:\n"
        "  - message는 항상 존댓말·친절한 한국어. 이모지 X, 마크다운 X.\n"
        "  - **동일 문구 반복 절대 금지**. 사용자 발화에 맞춰 매번 다른 문장 구성.\n"
        "  - 절대 \"서식을 작성했습니다\", \"어떤 정보 알려주실래요?\" 같은 정형 문구만 반복 X. 상황에 맞춰 자연스럽게.\n"
        "  - 사용자가 서식 이름을 언급하면 그 서식의 성격을 알고 있음을 드러내며 답변.\n"
        "\n"
        "규칙:\n"
        "1) 반드시 위 스키마 JSON 오브젝트로만 답한다. 설명·마크다운 금지.\n"
        "2) fields 안 키는 아래 필드 목록의 key와 정확히 일치해야 한다.\n"
        "3) 모르는 값(사용자가 안 준 정보, 이름·번호·금액 등)은 빈 문자열 \"\"로 둔다. 창작 금지.\n"
        "4) 필드 성격(라벨/위치/multiline/가로)에 맞게 값 길이·톤을 조정한다.\n"
        "   - 짧은 필드(성명·전화번호·주소·제목): 한 줄, 간결.\n"
        "   - 긴 필드(내용/상세): 문장 여러 개로 서술.\n"
        "5) 이전에 채워져 있던 값(current_fields)이 있으면 존중한다. "
        "사용자가 명시적으로 바꿔달라 요청한 필드만 갱신하고, 나머지는 그대로 유지.\n"
        "6) 사용자 정보(user_context) 사용 규칙:\n"
        "   - user_context는 **로그인한 신청인 본인 정보**다. 신청인 관련 필드에만 사용.\n"
        "   - 예: `취득자 성명`, `신청인 성명`, `신고인` → user_context.name 사용 가능\n"
        "   - **다음 필드엔 user_context를 절대 사용 금지** (신청인이 아닌 다른 사람·대상):\n"
        "     · 반려동물 관련: `동물 이름`, `반려동물 이름`, `개 이름`, `등록번호`, `품종` 등\n"
        "     · 전 소유자/매도인: `전 소유자 성명`, `매도인 성명`, `양도인` 등\n"
        "     · 대리인·위임자: `대리인 성명`, `위임자 성명` (단, 신청인 본인이 대리 아닐 때)\n"
        "     · 세대원: `세대원 성명` (배우자·자녀 등, 세대주인 본인 정보 아님)\n"
        "     · 담당자/기관: `담당자`, `공무원`, `기관 대표` 등\n"
        "   - 판단 기준: 필드 라벨이 `누구를` 가리키는지 문맥으로 파악. `본인/신청인/신고인/취득자`가 아닌 대상은 user_context 사용 X.\n"
        "7) 좌표 활용:\n"
        "   - 좌표는 렌더링용이 아니라 필드 간 관계 이해용이다. "
        "값에는 좌표를 절대 넣지 마라.\n"
        "   - 같은 y (±10) 근처 필드는 하나의 행/세트로 판단한다. "
        "예: 취득자 성명·주민번호·주소·전화번호가 같은 y 근처면 취득자 한 사람의 정보 세트다.\n"
        "   - y가 아래로 내려가면(값이 작아지면) 다음 행/블록이다.\n"
        "8) 반복 행 표기 (`_2`, `_3` 접미):\n"
        "   - key가 `세대원_1_성명`, `세대원_2_성명` 처럼 접미 번호가 있으면 같은 성격의 반복 행이다. "
        "사용자가 여러 명 언급했으면 순서대로 채우고, 없으면 빈 문자열.\n"
        "   - `취득물건내역`, `취득물건내역_2` 처럼 이름이 중복돼 서버가 접미를 붙인 경우도 동일 원칙: "
        "좌표 y가 다르면 서로 다른 행이므로 각기 다른 값을 채울 수 있다.\n"
        "9) 체크박스 처리:\n"
        "   - 라벨에 `[]` 가 있거나 이름이 `배우자[]`, `직계존비속[]` 처럼 옵션명인 필드는 체크박스다.\n"
        "   - 해당 상태면 정확히 \"V\", 아니면 빈 문자열 \"\" 로 표기한다. 다른 표기 금지.\n"
        "   - **배타 그룹** (하나만 선택): 예: `배우자[]`/`직계존비속[]`/`친족관계[]`, "
        "`[]기한 내`/`[]기한 후`, `포함`/`제외` 등은 하나만 \"V\", 나머지 반드시 \"\".\n"
        "   - **여/부 (yes/no) 짝**: `X □ 여` / `X □ 부` 형식은 X에 해당하면 '여'=V, "
        "해당 안 되면 '부'=V. 사용자가 명시적으로 부정형(\"아니다\", \"아님\", \"없다\")을 쓰면 반드시 '부'=V. "
        "언급 없으면 그룹 전체 \"\".\n"
        "   - `해당`/`해당 없음` 짝도 동일. 사용자가 \"해당 없다/아니다\"라고 하면 '해당 없음'=V.\n"
        "   - **독립 체크박스**: 해당 조건이면 \"V\", 아니면 \"\".\n"
        "   - 사용자가 명시하지 않은 체크박스는 전부 \"\" 로 둔다 (추측 금지).\n"
        "10) 가족 관계 판단 (공공 서식에 자주 나오는 상식):\n"
        "    - 배우자 = 남편/아내/부부.\n"
        "    - 직계존비속 = 부모/자녀/조부모/손자녀 등 직계 혈연 (예: 아버지→저는 '직계존비속').\n"
        "    - 친족관계 = 형제자매/사촌/삼촌/조카/처가·시가·인척 등 (직계 아닌 혈족·인척, 통상 8촌 이내 혈족·4촌 이내 인척).\n"
        "    - 위 세 그룹은 서로 배타. 하나만 \"V\".\n"
        "    - **중요**: 이 관계는 신고인(취득자)과 전 소유자(매도인/증여자) 사이의 관계다. "
        "세대원 정보(배우자·자녀 언급)와는 무관하니 혼동 금지.\n"
        "    - 판단 방법: '전 소유자가 나에게 어떤 사람인가?' 를 본다.\n"
        "      · 전 소유자가 아버지/어머니/자녀/조부모 → 직계존비속\n"
        "      · 전 소유자가 남편/아내 → 배우자\n"
        "      · 전 소유자가 형제/사촌/삼촌/조카/처가 등 → 친족관계\n"
        "      · 전 소유자가 남(회사 대표/타인) → 세 필드 모두 \"\"\n"
        "11) 세대주 vs 세대원 판단:\n"
        "    - 사용자 본인이 세대주라 밝히면, 세대주 행에 사용자 이름/주민번호를 넣고 '세대주와의 관계'는 \"본인\".\n"
        "    - 세대원 정보는 세대원 행에만 채운다. 세대주 셀에 세대원 데이터를 섞지 않는다.\n"
        "    - 사용자가 세대원을 여러 명 언급하면 배우자 → 자녀 → 부모 순으로 세대원 슬롯에 넣는 것이 자연스럽다.\n"
        "12) 특수관계인 3택은 회사 관계 기준이다:\n"
        "    - 임원·사용인 관계 → 경제적 연관관계.\n"
        "    - 주주·출자자 관계 → 경영지배관계.\n"
        "    - 그 외(가족·지인 등)는 '특수관계인이 아닌 경우' 로 표기.\n"
        "    - 가족 간 거래(배우자·직계·친족)는 위 3택과 별도의 카테고리이므로 3택은 '아닌 경우'로 표기한다.\n"
        "13) `[표셀,사용자가 명시한 값만]` 힌트가 붙은 필드:\n"
        "    - 표에서 자동 생성된 셀이다. 이름 형식은 `{행라벨}_{열헤더}` (예: `취득세_과세표준액`, `합계_산출세액`).\n"
        "    - **사용자가 대화에서 그 셀에 해당하는 값을 명시적으로 알려준 경우에만** 채운다.\n"
        "    - 예: 사용자가 '취득세 800만원' 했으면 `취득세_산출세액=\"8000000\"`.\n"
        "    - 언급 없으면 반드시 빈 문자열 \"\". 다른 셀 값 유추·계산·창작 금지.\n"
        "    - **다중 행 표 (`r1_XXX`, `r2_XXX`, `r3_XXX` 같이 행 번호가 붙은 경우)**:\n"
        "      · 사용자가 여러 건을 명시적으로 언급한 경우에만 각 행에 서로 다른 값 채움.\n"
        "      · 1건만 언급했으면 r1만 채우고 r2, r3는 반드시 빈 문자열.\n"
        "      · 절대 같은 값을 여러 행에 복사 금지.\n"
        "      · 사용자가 '임의로 채워줘'라 해도 필요한 최소 건수(보통 1건)만 채우고 나머지 행은 비운다.\n"
        "14) **행 라벨 필드에는 값을 넣지 마라**:\n"
        "    - `취득세`, `지방교육세`, `농어촌특별세 부과분`, `합계` 처럼 표의 행 라벨(세목명)만 딱 있는 필드는 값이 아니라 라벨이다.\n"
        "    - 사용자가 '취득세 800만원'이라 해도 `취득세=\"8000000\"` X. 반드시 `취득세_산출세액=\"8000000\"` 처럼 열 헤더 붙은 셀에 넣어라.\n"
        "    - 라벨 필드 값은 항상 빈 문자열 \"\".\n"
    )

    user_parts = []
    user_parts.append(f'서식 이름: {template.get("name", "")}')
    if template.get("description"):
        user_parts.append(f'서식 설명: {template["description"]}')

    # PDF 페이지 첫 헤더 라인만 짧게 추출 (서식 섹션 파악용, 너무 길면 LLM 주의력 분산)
    if pdf_layout:
        header_parts = []
        import re as _re
        for pi, page in enumerate(pdf_layout):
            ft = (page.get("full_text") or "").strip()
            if not ft:
                continue
            # 첫 3~5줄만 (섹션 헤더/제목 정도)
            lines = [ln.strip() for ln in ft.split("\n") if ln.strip()][:5]
            if lines:
                header_parts.append(f"p{pi}: " + " / ".join(lines)[:200])
        if header_parts:
            user_parts.append("\n서식 페이지 헤더: " + " | ".join(header_parts))

    if user_context:
        user_parts.append("\n사용자 정보 (user_context):")
        user_parts.append(_json.dumps(user_context, ensure_ascii=False))

    user_parts.append("\n필드 목록 (key + 힌트):")
    user_parts.append("\n".join(hints))

    # 배타 그룹 자동 감지 → 프롬프트에 명시적 리스트로 삽입
    exclusive_groups = _detect_exclusive_groups(fields)
    if exclusive_groups:
        group_lines = []
        for i, grp in enumerate(exclusive_groups, 1):
            # 너무 긴 이름 잘라 표시
            names = [k if len(k) < 40 else k[:37] + "..." for k in grp]
            group_lines.append(f"  그룹{i}: {' / '.join(names)}")
        user_parts.append("\n[배타 그룹 - 각 그룹에서 정확히 하나만 \"V\", 나머지 반드시 \"\"]")
        user_parts.append("\n".join(group_lines))
        user_parts.append(
            "위 각 그룹은 하나의 상호배타 선택지다. "
            "사용자 정보가 어느 옵션에도 해당 안 되면 그룹 전체를 \"\"로 둔다."
        )

    if current_fields:
        user_parts.append("\n현재 값 (current_fields):")
        user_parts.append(_json.dumps(current_fields, ensure_ascii=False))

    if session_messages:
        # 최근 6턴만
        recent = []
        for m in session_messages[-6:]:
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                recent.append(f'[{role}] {content}')
        if recent:
            user_parts.append("\n이전 상담 대화 (참고):")
            user_parts.append("\n".join(recent))

    if user_message:
        user_parts.append("\n사용자 새 메시지:")
        user_parts.append(user_message)

    user_parts.append("\n위 정보로 JSON을 채워라.")

    client = _get_openai()
    assistant_message = ""
    parsed_fields: dict = {}
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",   # 필드 추출은 가벼워서 mini로 충분 (속도↑ 비용↓)
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(user_parts)},
            ],
            temperature=0.2,
            max_tokens=4500,   # 200+ 필드 서식일 때 응답 잘림 방지
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
        parsed = _json.loads(raw)
        if isinstance(parsed, dict):
            # 새 스키마: {"fields": {...}, "message": "..."}
            if "fields" in parsed and isinstance(parsed["fields"], dict):
                parsed_fields = parsed["fields"]
                assistant_message = str(parsed.get("message") or "").strip()
            else:
                # 하위 호환: flat dict 인 경우 (이전 프롬프트 스타일)
                parsed_fields = parsed
    except Exception:
        parsed_fields = dict(current_fields or {})
        assistant_message = "죄송해요, 처리 중 오류가 있었어요. 다시 말씀해주시겠어요?"

    # 자동 필드는 user_context로 강제 덮어쓰기 (LLM 창작 방지)
    # 라벨 성격 필드는 무조건 빈 문자열.
    result = {}
    for key in text_keys:
        if key in label_keys:
            result[key] = ""
            continue
        auto_source = auto_fill_map.get(key)
        val = None
        if auto_source and user_context:
            src = auto_source.split(".", 1)[-1] if "." in auto_source else auto_source
            val = user_context.get(src) or None
        if val is None:
            val = parsed_fields.get(key)
        if val is None and current_fields:
            val = current_fields.get(key)
        if val is None:
            val = ""
        result[key] = val

    # 체크박스 필드 강제 정규화: 값이 "V" 또는 "" 만 허용.
    # LLM이 필드명 "휴대전화요금" 같은 걸 보고 전화번호 등을 잘못 넣는 경우 방지.
    # 필드명에 □/[]/[ ] 포함되면 체크박스로 간주.
    for f in fields:
        if f.get("type") == "image":
            continue
        key = f.get("key")
        if not key or key not in result:
            continue
        if _is_checkbox_field(key):
            v = result[key]
            if v != "V":
                result[key] = ""

    # 표 라벨 필드 강제 정규화:
    # 자동 생성 필드가 `{X}_{Y}` 패턴이면 X는 행 라벨. `X`와 매칭되는 원본 필드에 값이 들어있으면
    # 라벨이 값으로 오염된 상태이므로 빈 문자열로 강제.
    # 예: `취득세_과세표준액` 자동 생성됨 → `취득세` 필드는 라벨 → 값 빈문자열.
    # 매칭은 정확 일치 OR 접두어/포함 관계로 유연하게 (라벨명이 PDF마다 미세하게 다를 수 있음).
    label_prefixes = set()
    for f in fields:
        if not f.get("auto_generated"):
            continue
        key = f.get("key", "")
        if "_" in key:
            label_prefixes.add(key.rsplit("_", 1)[0])

    original_keys = [f.get("key", "") for f in fields
                     if not f.get("auto_generated") and f.get("key")]
    for orig_key in original_keys:
        val = result.get(orig_key)
        if not val or val == "V":
            continue
        # orig_key가 어떤 auto label prefix와 유사한지 검사
        is_label = False
        for prefix in label_prefixes:
            if not prefix:
                continue
            # 완전 일치, 접두어 관계, 또는 하나가 다른 하나를 포함
            if (orig_key == prefix
                    or orig_key.startswith(prefix)
                    or prefix.startswith(orig_key)
                    or orig_key in prefix
                    or prefix in orig_key):
                is_label = True
                break
        if is_label:
            result[orig_key] = ""

    # 배타 그룹 위반 후처리: 여러 개 V이면 첫 번째만 남기고 나머지 blank
    for group in exclusive_groups:
        checked = [k for k in group if result.get(k) == "V"]
        if len(checked) > 1:
            for k in checked[1:]:
                result[k] = ""

    # LLM이 message를 안 뱉었을 경우 fallback (사용자 메시지 유무로 판단)
    if not assistant_message:
        if not (user_message and user_message.strip()):
            assistant_message = (
                f"'{template.get('name','서식')}' 작성을 도와드릴게요. "
                "성함·주소·연락처 등 필요한 정보를 편하게 알려주시면 서식에 반영해드립니다."
            )
        else:
            assistant_message = "말씀 반영했어요. 추가로 필요한 정보 있으면 알려주세요."

    return result, assistant_message


async def extract_keywords(text: str, max_keywords: int = 3) -> list[str]:
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


async def answer_chatbot(
    text: str,
    history: Optional[list[dict]] = None,
    create_cluster: bool = False,
) -> dict:
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
                'sub_queries': [],
                'classification': None,
                'urgency': None,
                'cluster': None,
                'keywords': [],
                'laws': [],
                'cases': [],
                'procedures': [],
                'departments': [],
                'similar_depts': [],
            },
        }

    # ─── Query Decomposition: 여러 독립 민원 감지 ───
    sub_queries = await decompose_query(text, history)
    if not sub_queries:
        sub_queries = [text]

    async def _fetch_top_depts(item):
        cid = item.get('category_id')
        if cid:
            d = await asyncio.to_thread(lookup_dept_by_category, cid)
            return {**item, 'departments': d}
        return {**item, 'departments': []}

    async def _process_sub_query(sub_text: str) -> dict:
        """서브 질문 하나에 대해 모든 도구 호출 병렬 실행 → 결과 dict 반환."""
        tool_q = _build_tool_query(sub_text, history)
        keywords_task = asyncio.create_task(extract_keywords(tool_q))
        cls_r, urg_r, laws_r, cases_r, procs_r = await asyncio.gather(
            asyncio.to_thread(classify_complaint, tool_q, 3),
            asyncio.to_thread(check_urgency, tool_q),
            asyncio.to_thread(search_laws, tool_q, None, 5),
            asyncio.to_thread(search_cases, tool_q, None, 5),
            asyncio.to_thread(search_procedures, tool_q, 5),
        )
        kw = await keywords_task
        # 클러스터는 create_cluster=True 일 때만 (예: 정식 민원 접수 시).
        # 챗봇 대화(/chat/ask)에선 잡담/문의도 클러스터화되어 오염되기 때문에 기본 False.
        if create_cluster:
            cluster_r = await asyncio.to_thread(match_or_create_cluster, sub_text, kw)
        else:
            cluster_r = None
        top_k_items = cls_r.get('top_k') or []
        cat_id_r = cls_r.get('category_id')
        dept_search_task = (
            asyncio.to_thread(search_dept, tool_q, cat_id_r, 5)
            if cat_id_r else asyncio.sleep(0, result=[])
        )
        top_k_with_depts, dept_search_r = await asyncio.gather(
            asyncio.gather(*[_fetch_top_depts(it) for it in top_k_items]),
            dept_search_task,
        )
        cls_r['top_k'] = list(top_k_with_depts)
        depts_r = top_k_with_depts[0]['departments'] if top_k_with_depts else []
        return {
            'query': sub_text,
            'classification': cls_r,
            'urgency': urg_r,
            'cluster': cluster_r,
            'keywords': kw,
            'laws': laws_r,
            'cases': cases_r,
            'procedures': procs_r,
            'departments': depts_r,
            'similar_depts': dept_search_r,
        }

    # 서브 질문마다 병렬 처리
    sub_results = await asyncio.gather(*[_process_sub_query(q) for q in sub_queries])

    # 하위 호환: 기존 metadata 스키마의 top-level 필드는 첫 서브 결과 값
    first = sub_results[0]
    metadata = {
        'tool_used': True,
        'sub_queries': sub_results,   # 신규 필드 — 서브 질문별 metadata 리스트
        # 하위 호환 필드 (기존 백엔드 코드가 참조하는 것)
        'classification': first['classification'],
        'urgency': first['urgency'],
        'cluster': first['cluster'],
        'keywords': first['keywords'],
        'laws': first['laws'],
        'cases': first['cases'],
        'procedures': first['procedures'],
        'departments': first['departments'],
        'similar_depts': first['similar_depts'],
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
