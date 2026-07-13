"""18 카테고리 → 11 카테고리 매핑 후 labeled_dataset.jsonl 생성

입력:
  _work_143/train/<원본카테고리>_<count>.json (18개)
  _work_143/val/<원본카테고리>_<count>.json (18개)

출력:
  labeled_dataset.jsonl       (분류 모델용, 교육 제외 11 카테고리)
  edu_dataset.jsonl           (교육부 FAQ 별도, RAG/룰 라우팅용)
"""
import json, os, re, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

WORK = r'C:/Users/smhrd/Desktop/데이터/_work_143'
OUT_DIR = r'C:/Users/smhrd/Desktop/데이터'
MOE = r'C:/Users/smhrd/Desktop/데이터/moe_faq.json'

# 18 → 11 매핑 (교육 제외) — v10: '안전건설' 분기 + subcategory 보정 강화
# 공통/정보통신 제외, 토지는 건축으로.
# '안전건설'은 도로/시설 민원이 70%+라 직접 매핑 없이 라우팅 함수로 처리.
MAP_18_TO_11 = {
    '자동차': '교통',
    '교통': '교통',
    '건축허가': '건축',
    # '안전건설': route_안전건설()로 분기 (도로/시설→교통, 광고→환경, 등)
    '토지': '건축',
    '행정': '행정',
    '보건소': '보건위생',
    '위생': '보건위생',
    '환경미화': '환경',
    '산림': '문화_여가',
    '문화_체육_관광': '문화_여가',
    '농업_축산': '농축산',
    '복지': '복지',
    '세무': '세무',
    '상하수도': '상하수도',
    '경제': '경제',
    # '공통': 제외 (잡탕 노이즈)
    # '정보통신': 제외 (도메인 다름, 너무 작음)
}

# ===== '안전건설' 라우팅 (105,465건, v9 건축 노이즈의 핵심) =====
# 부서 강한 시그널 → 텍스트 키워드 → 기본 행정
DEPT_ROUTE_안전건설 = {
    '도로관리과': '교통', '도로과': '교통', '교통행정과': '교통',
    '교통정책과': '교통', '대중교통과': '교통', '주차행정과': '교통',
    '시민안전과': '교통',
    '옥외광고과': '환경',
    '산림녹지과': '문화_여가', '도시림과': '문화_여가', '도시녹지과': '문화_여가',
    '공원녹지과': '문화_여가', '공원관리과': '문화_여가',
    '건축허가과': '건축', '건축과': '건축', '주택정책과': '건축',
    '도시건축과': '건축', '도시계획과': '건축', '건축경관과': '건축',
    '도시재생과': '건축',
    '하수과': '상하수도', '하천과': '상하수도', '수도시설과': '상하수도',
    '하수시설과': '상하수도', '상하수과': '상하수도',
}
SUB_ROUTE_안전건설 = {
    '옥외광고물관리': '환경',
    '소하천공사 허가신청': '건축',
    '하천공사 허가신청': '상하수도',
    '개발행위 허가신청': '건축',
    '점용/사용허가': '건축',
    '주택건설 허가신청': '건축',
    '도로점용/사용허가': '교통',
}
PAT_광고 = re.compile(r'(불법\s*)?(광고물|현수막|전단지|입간판|네온\s*간판|애드벌룬)')
PAT_상하수도 = re.compile(
    r'하수도|상수도|수도\s*요금|상수도\s*요금|단수|배수관|'
    r'맨홀\s*(뚜껑|덮개|파손|소음|막힘|단차)|역류|침수|배수|우수관|오수관'
)
PAT_산림공원 = re.compile(
    r'산림|벌채|임야|숲|등산로|약수터|등산\s*안내|'
    r'공원\s*(시설|관리|환경|벤치|놀이|보수|정비|쓰레기)|체육공원|어린이공원|근린공원|소공원'
)
PAT_교통 = re.compile(
    r'도로|포트홀|노면|보도\s*블록|보도\s*블럭|보도블록|보도블럭|인도|'
    r'횡단보도|신호등|신호기|가로등|보안등|반사경|차선|중앙선|중앙분리대|'
    r'표지판|이정표|볼라드|탄력봉|시선유도봉|충격흡수대|방지턱|과속\s*방지턱|'
    r'가드레일|난간\s*(도로|차도)|무단횡단\s*(방지|시설|휀스)|'
    r'(불법|장애인|소화전|어린이보호구역)\s*주(정)?차|주정차\s*(신고|단속|위반)|'
    r'주차장|야외\s*주차장|'
    r'버스\s*정류장|버스정류장|버스\s*승강장|대중교통|'
    r'육교|싱크홀|보도\s*턱|점자\s*블록|'
    r'다리\s*(기둥|받침대|난간|파손|보수|미끄러|제설|복구|건너)|교량|'
    r'적치물.{0,15}(인도|도로|보행|통행)|(인도|도로|보행|통행).{0,15}적치물|'
    r'교통사고\s*(잔해|처리|복구)|통학로'
)
PAT_건축 = re.compile(
    r'건축물|불법건축|건축\s*허가|증축|개축|신축|'
    r'공사장\s*(소음|먼지|분진|진동|안전|위험)|'
    r'옹벽|석축|축대|법면|절토|성토|토목|'
    r'재개발|재건축|주거환경개선|뉴타운|'
    r'아파트\s*(균열|누수|하자)|건물\s*(균열|기울|위험)'
)

def route_안전건설(text: str, dept: str = '', sub: str = '') -> str:
    if dept in DEPT_ROUTE_안전건설:
        return DEPT_ROUTE_안전건설[dept]
    if sub in SUB_ROUTE_안전건설:
        return SUB_ROUTE_안전건설[sub]
    if PAT_광고.search(text):
        return '환경'
    if PAT_상하수도.search(text):
        return '상하수도'
    if PAT_산림공원.search(text):
        return '문화_여가'
    if PAT_교통.search(text):
        return '교통'
    if PAT_건축.search(text):
        return '건축'
    return '행정'

# v8: 공통/토지 데이터를 부서 기반으로 재분배할 룰
# 매칭 안 되면 '기타' 라벨로
REROUTE_BY_DEPT = {
    # 행정
    '행정과': '행정', '민원지적과': '행정', '자치행정과': '행정',
    '인사조직과': '행정', '시민소통담당관': '행정',
    # 건축
    '건축허가과': '건축', '주택정책과': '건축', '안전건설과': '건축',
    '도시계획과': '건축', '개발사업과': '건축', '재개발과': '건축',
    '건축경관과': '건축',
    # 교통
    '경제교통과': '교통', '대중교통과': '교통', '교통정책과': '교통',
    '교통행정과': '교통', '주차행정과': '교통',
    # 환경
    '환경미화과': '환경', '환경정책과': '환경', '환경위생과': '환경',
    '자원순환과': '환경', '청소행정과': '환경',
    # 복지
    '가정복지과': '복지', '사회복지과': '복지', '노인장애인과': '복지',
    '여성가족과': '복지', '보육청소년과': '복지', '복지정책과': '복지',
    '청년정책과': '복지',
    # 문화_여가
    '문화예술과': '문화_여가', '체육진흥과': '문화_여가', '관광과': '문화_여가',
    '관광진흥과': '문화_여가', '산림농정과': '문화_여가', '산림녹지과': '문화_여가',
    '수산산림과': '문화_여가', '문화위생과': '문화_여가',
    # 농축산
    '축산과': '농축산', '농업정책과': '농축산', '농업기술과': '농축산',
    '창원기술지원과': '농축산', '마산기술지원과': '농축산',
    # 경제
    '경제정책과': '경제', '경제기업사랑과': '경제', '경제살리기과': '경제',
    '일자리창출과': '경제', '소상공인과': '경제', '전략산업과': '경제',
    # 보건위생
    '보건정책과': '보건위생', '보건행정과': '보건위생', '건강관리과': '보건위생',
    '건강증진과': '보건위생', '식품위생과': '보건위생',
    # 상하수도
    '상하수과': '상하수도', '수도시설과': '상하수도', '하수시설과': '상하수도',
    '하천과': '상하수도',
    # 세무
    '세무과': '세무', '세정과': '세무', '재산세과': '세무', '징수과': '세무',
}

GROUP_ID_RE = re.compile(r'^(B\d+)')

def extract_group(doc_id: str) -> str:
    """B669-1 → 143_<원본카테고리>_B669 형식으로 만들 group_id의 base를 리턴.
    여기선 B669 부분만 반환, 호출자가 카테고리와 결합."""
    m = GROUP_ID_RE.match(doc_id or '')
    return m.group(1) if m else (doc_id or 'NA')

REROUTE_RAW_CATS = set()  # v9: 공통/토지 제외 (재분배 안 함)

# v9: 노이즈 보정 — 매우 강한 시그널만 사용
# subcategory가 명확하면 원본 카테고리와 무관하게 정정
SUBCATEGORY_OVERRIDE = {
    # 행정 (시청 일반 행정업무)
    '여권': '행정',
    '주민등록등초본': '행정',
    '인감증명': '행정',
    '가족관계증명서': '행정',
    '도로명주소': '행정',
    '상세주소 신청': '행정',
    # 농축산
    '동물등록 관련 신고': '농축산',
    '가축사육업': '농축산',
    '농약판매원': '농축산',
    '축산물 영업(생산업,가공업,유통업)': '농축산',
    '동물관련 영업': '농축산',
    '동물병원/약국': '농축산',
    '양봉농가': '농축산',
    # 문화_여가
    '공공체육시설': '문화_여가',
    '체육시설업': '문화_여가',
    '관광 및 숙박업': '문화_여가',
    '여행업': '문화_여가',
    '박물관/미술관': '문화_여가',
    '문화/예술단체': '문화_여가',
    '지역행사': '문화_여가',
    '입목벌채 허가 신고': '문화_여가',
    '산림경영계획': '문화_여가',
    '소나무류 생상 확인': '문화_여가',
    # 교통
    '불법주정차': '교통',
    '자동차등록': '교통',
    '운수업': '교통',
    '주차장': '교통',
    '도로': '교통',         # v10: 건축허가/도로 → 교통
    # 환경
    '옥외광고물': '환경',     # v10: 건축허가/옥외광고물 → 환경 (도시미관)
}

# 부서 단일 도메인만 (다중 도메인 부서 제외, 예: 경제교통과)
DEPT_OVERRIDE = {
    # 세무 (가장 명확)
    '세무과': '세무', '세정과': '세무', '재산세과': '세무', '징수과': '세무',
    # 상하수도
    '상하수과': '상하수도', '수도시설과': '상하수도', '하수시설과': '상하수도',
    # 환경 (명확)
    '환경미화과': '환경', '환경정책과': '환경', '청소행정과': '환경', '자원순환과': '환경',
    # 농축산 (명확)
    '축산과': '농축산', '농업정책과': '농축산', '농업기술과': '농축산',
    # 보건위생
    '보건정책과': '보건위생', '보건행정과': '보건위생', '건강관리과': '보건위생',
    '건강증진과': '보건위생', '식품위생과': '보건위생',
    # 복지
    '가정복지과': '복지', '사회복지과': '복지', '노인장애인과': '복지',
    '여성가족과': '복지', '보육청소년과': '복지',
    # 주의: 경제교통과는 양다리라 제외
    # 주의: 민원지적과는 토지+행정 양다리라 제외
    # 주의: 안전건설과는 건축+토목 다중이라 제외
}

def process_143(split: str, fout):
    """split = 'train' or 'val'"""
    split_dir = os.path.join(WORK, split)
    counts = Counter()
    skipped = Counter()
    correction_stats = Counter()  # v9: 보정 통계
    for fname in sorted(os.listdir(split_dir)):
        if not fname.endswith('.json'):
            continue
        # 원본 카테고리는 파일명 앞부분
        m = re.match(r'^(.+?)_\d+\.json$', fname)
        if not m:
            continue
        raw_cat = m.group(1)
        # v10: '안전건설'은 분기 함수로 처리 (직접 매핑 없음)
        if raw_cat != '안전건설':
            mapped = MAP_18_TO_11.get(raw_cat)
            if mapped is None:
                skipped[raw_cat] += 1
                continue
        else:
            mapped = None  # 텍스트 보고 결정
        with open(os.path.join(split_dir, fname), 'r', encoding='utf-8') as f:
            data = json.load(f)
        for d in data.get('documents', []):
            text = (d.get('Q_refined') or '').strip()
            if not text:
                skipped[f'{raw_cat}:empty_text'] += 1
                continue
            doc_id = d.get('id', '')
            group_base = extract_group(doc_id)
            group_id = f'143_{raw_cat}_{group_base}'
            lab = d.get('labeling', {})
            intent = lab.get('intent', {}) or {}
            dept = (lab.get('department', '') or '').strip()
            sub = (intent.get('subcategory', '') or '').strip()

            # v10: 안전건설은 라우팅 함수, 그 외는 MAP_18_TO_11
            if raw_cat == '안전건설':
                routed = route_안전건설(text, dept, sub)
                correction_stats[f'안전건설→{routed}'] += 1
                base = routed
            else:
                base = mapped

            # v9: 라벨 결정 — subcategory 강한 시그널 > 부서 단일도메인 > 원본 매핑
            new_label = base
            if sub in SUBCATEGORY_OVERRIDE:
                override = SUBCATEGORY_OVERRIDE[sub]
                if override != base:
                    correction_stats[f'sub:{base}→{override}'] += 1
                    new_label = override
            elif dept in DEPT_OVERRIDE:
                override = DEPT_OVERRIDE[dept]
                if override != base:
                    correction_stats[f'dept:{base}→{override}'] += 1
                    new_label = override

            record = {
                'text': text,
                'label': new_label,
                'raw_category': raw_cat,
                'group_id': group_id,
                'doc_id': doc_id,
                'source': '143',
                'split_origin': split,
                'department': dept,
                'subcategory': intent.get('subcategory', ''),
                'predication': intent.get('predication', ''),
                'keywords': [k.get('form','') for k in (lab.get('keyword') or []) if k.get('form')],
                'entities': [{'form': e.get('form',''), 'label': e.get('label','')} for e in (lab.get('entities') or [])],
                'publish_date': d.get('publish_date', ''),
            }
            fout.write(json.dumps(record, ensure_ascii=False) + '\n')
            counts[new_label] += 1
    return counts, skipped, correction_stats

def process_moe(fout_edu):
    counts = Counter()
    with open(MOE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for i, d in enumerate(data):
        text = (d.get('제목') or '').strip()
        body = (d.get('본문') or '').strip()
        if not text:
            continue
        record = {
            'text': text,
            'label': '교육',
            'raw_category': '교육부_FAQ',
            'group_id': f'moe_{d.get("epUnionSn", i)}',
            'doc_id': f'moe_{d.get("epUnionSn", i)}',
            'source': 'moe',
            'department': d.get('담당부서_상세') or d.get('담당부서', ''),
            'subcategory': d.get('dutySctnNm', ''),
            'predication': '',
            'body': body,
            'related_law': d.get('관련법령', []),
            'publish_date': d.get('등록일', ''),
        }
        fout_edu.write(json.dumps(record, ensure_ascii=False) + '\n')
        counts['교육'] += 1
    return counts

def main():
    out_path = os.path.join(OUT_DIR, 'labeled_dataset.jsonl')
    edu_path = os.path.join(OUT_DIR, 'edu_dataset.jsonl')

    total = Counter()
    skipped_total = Counter()

    correction_total = Counter()
    with open(out_path, 'w', encoding='utf-8') as fout:
        for split in ['train', 'val']:
            c, s, cc = process_143(split, fout)
            print(f'[143/{split}] {sum(c.values())}건')
            for k,v in c.most_common():
                print(f'   {k}: {v}')
            if s:
                print(f'   skipped: {dict(s)}')
            total.update(c)
            skipped_total.update(s)
            correction_total.update(cc)

    if correction_total:
        print('\n=== v9 노이즈 보정 통계 ===')
        for k, v in correction_total.most_common():
            print(f'   {k}: {v:,}')

    with open(edu_path, 'w', encoding='utf-8') as fedu:
        ec = process_moe(fedu)
        print(f'[moe] {sum(ec.values())}건')

    print('\n=== 최종 분류용 데이터 (11 클래스) ===')
    grand = sum(total.values())
    for label, cnt in total.most_common():
        pct = cnt / grand * 100
        print(f'  {label:8s}: {cnt:>7,} ({pct:5.2f}%)')
    print(f'  {"합계":8s}: {grand:>7,}')

    print('\n=== 교육 (별도 파일) ===')
    print(f'  교육 (RAG/룰 라우팅용): edu_dataset.jsonl')

    print(f'\n생성 파일:')
    print(f'  {out_path}  ({os.path.getsize(out_path)/1024/1024:.1f} MB)')
    print(f'  {edu_path}  ({os.path.getsize(edu_path)/1024/1024:.1f} MB)')

if __name__ == '__main__':
    main()
