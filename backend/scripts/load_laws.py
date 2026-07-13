"""법령 26개를 조항 단위로 split해서 rag_documents에 적재

입력: C:/Users/smhrd/Downloads/laws (1).json
출력: rag_documents 테이블 (title, content, category_id)
embedding은 NULL로 두고 이후 별도 단계에서 채움
"""
import json
import re
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch

sys.stdout.reconfigure(encoding='utf-8')

LAWS_PATH = r'C:/Users/smhrd/Downloads/laws (1).json'

DB = dict(
    host='project-db-campus.smhrd.com',
    port=3310,
    user='mp_24k_li9_p3_3',
    password='smhrd3',
    dbname='mp_24k_li9_p3_3',
)

# 법령명 → 카테고리 이름 (None = 일반/교육으로 category_id 미지정)
LAW_CATEGORY = {
    '민원 처리에 관한 법률': '행정',
    '부패방지 및 국민권익위원회의 설치와 운영에 관한 법률': '행정',
    '공공기관의 운영에 관한 법률': '행정',
    '지방공기업법': '행정',
    '초ㆍ중등교육법': None,
    '고등교육법': None,
    '행정절차법': '행정',
    '전자정부법': '행정',
    '개인정보 보호법': '행정',
    '국세기본법': '세무',
    '관세법': '세무',
    '지방세기본법': '세무',
    '가족관계의 등록 등에 관한 법률': '행정',
    '부동산등기법': '행정',
    '주민등록법': '행정',
    '공간정보의 구축 및 관리 등에 관한 법률': '건축',
    '자동차관리법': '교통',
    '건축법': '건축',
    '상업등기법': '경제',
    '도로교통법': '교통',
    '여권법': '행정',
    '지능정보화 기본법': '행정',
    '형법': None,
    '민법': None,
    '행정심판법': '행정',
    '행정소송법': '행정',
}

# 조항 헤더: " 제N조(...)" 또는 " 제N조의M(...)"
ARTICLE_HEADER = re.compile(r'(?m)^[ \t]*(제\d+조(?:의\d+)?)\(([^)\n]*)\)')

# 부칙 시작 마커
APPENDIX_MARKER = re.compile(r'(?m)^[ \t]*부\s+칙\s*<')


def split_articles(text: str, law_name: str):
    """본문에서 조항만 추출. TOC와 부칙 제외."""
    # 1) 부칙 자르기
    m = APPENDIX_MARKER.search(text)
    if m:
        text = text[:m.start()]

    # 2) 조항 헤더 모두 찾기
    matches = list(ARTICLE_HEADER.finditer(text))
    articles = []
    for i, mm in enumerate(matches):
        start = mm.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        body = text[start:end].strip()
        article_no = mm.group(1)
        article_title = mm.group(2).strip()

        # TOC 항목은 본문이 짧음. 본문이 충분히 길어야 진짜 조항.
        # 또한 "삭제" 단독은 제외.
        if len(body) < 80:
            continue
        if re.fullmatch(r'제\d+조(?:의\d+)?\s*삭제', body.replace(' ', '')):
            continue

        articles.append({
            'no': article_no,
            'title': article_title,
            'body': body,
        })
    return articles


def load_category_map(cur):
    cur.execute('SELECT category_id, name FROM categories')
    return {name: cid for cid, name in cur.fetchall()}


def main():
    print('법령 로딩...')
    with open(LAWS_PATH, 'r', encoding='utf-8') as f:
        laws = json.load(f)
    print(f'  {len(laws)}개 법령')

    print('DB 연결...')
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    cat_map = load_category_map(cur)
    print(f'  카테고리 {len(cat_map)}개: {list(cat_map)}')

    rows_to_insert = []
    stats = []

    for law in laws:
        name = law.get('name', '')
        text = law.get('text', '') or ''
        articles = split_articles(text, name)
        cat_name = LAW_CATEGORY.get(name)
        cat_id = cat_map.get(cat_name) if cat_name else None

        for a in articles:
            title = f'{name} {a["no"]}({a["title"]})'
            content = a['body']
            rows_to_insert.append((title, content, cat_id))

        stats.append((name, cat_name or '(미지정)', len(articles)))

    # 통계
    print(f'\n=== 법령별 조항 수 ===')
    total = 0
    for name, cat, n in stats:
        print(f'  [{cat:6}] {name}: {n}조')
        total += n
    print(f'  합계: {total} 조항')
    print(f'\n적재할 행: {len(rows_to_insert):,}')

    if '--dry' in sys.argv:
        print('\n* DRY RUN — DB 적재 안 함')
        cur.close(); conn.close()
        return

    # 기존 source_type=law 데이터가 있으면 정리? title에 법령명 들어가니 LIKE로 안전 삭제 가능
    # 일단 INSERT만, 중복 우려 시 사용자에게 확인 요청
    print('\nINSERT...')
    execute_batch(cur,
        'INSERT INTO rag_documents (title, content, category_id, embedding) VALUES (%s, %s, %s, NULL)',
        rows_to_insert, page_size=500)
    conn.commit()
    cur.execute('SELECT COUNT(*) FROM rag_documents')
    total_after = cur.fetchone()[0]
    print(f'rag_documents 총 행: {total_after:,}')
    cur.close(); conn.close()
    print('완료')


if __name__ == '__main__':
    main()
