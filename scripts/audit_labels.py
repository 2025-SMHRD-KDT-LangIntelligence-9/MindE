"""라벨링 노이즈 종합 감사

세 가지 각도로 노이즈 추정:
1. department-based: 부서가 명확하게 X 도메인인데 라벨이 다른 경우
2. subcategory-based: subcategory가 명확한데 라벨이 안 맞는 경우
3. keyword-based: 텍스트 키워드가 강하게 다른 라벨을 시사하는 경우

출력:
- 카테고리별 노이즈율 추정
- 명백한 노이즈 후보 샘플 (텍스트 + 라벨 + 부서)
- noise_candidates.jsonl 파일 저장 (검토용)
"""
import sys, json, re
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding='utf-8')

SRC = r'C:/Users/smhrd/Desktop/데이터/labeled_dataset.jsonl'
OUT = r'C:/Users/smhrd/Desktop/데이터/noise_candidates.jsonl'

# === 도메인 룰 ===
# 부서명 → 예상 라벨 (가장 명확한 케이스만)
DEPT_TO_LABEL = {
    '축산과': '농축산',
    '농업기술과': '농축산',
    '농업정책과': '농축산',
    '창원기술지원과': '농축산',
    '마산기술지원과': '농축산',
    '환경미화과': '환경',
    '환경정책과': '환경',
    '환경수질과': '환경',
    '청소행정과': '환경',
    '자원순환과': '환경',
    '보건소': '보건위생',
    '보건정책과': '보건위생',
    '보건행정과': '보건위생',
    '식품위생과': '보건위생',
    '문화위생과': '보건위생',
    '복지정책과': '복지',
    '여성가족과': '복지',
    '아동복지과': '복지',
    '노인장애인복지과': '복지',
    '청년정책과': '복지',
    '가정복지과': '복지',
    '세무과': '세무',
    '세정과': '세무',
    '재산세과': '세무',
    '징수과': '세무',
    '상하수도사업소': '상하수도',
    '수도과': '상하수도',
    '하수과': '상하수도',
    '하천과': '상하수도',
    '건축허가과': '건축',
    '건축과': '건축',
    '주택정책과': '건축',
    '안전건설과': '건축',
    '도로과': '교통',
    '교통정책과': '교통',
    '대중교통과': '교통',
    '경제교통과': '교통',
    '주차행정과': '교통',
    '경제정책과': '경제',
    '경제기업사랑과': '경제',
    '일자리창출과': '경제',
    '소상공인과': '경제',
    '관광과': '문화_여가',
    '문화예술과': '문화_여가',
    '체육진흥과': '문화_여가',
    '관광진흥과': '문화_여가',
    '산림농정과': '문화_여가',
    '산림녹지과': '문화_여가',
    '수산산림과': '문화_여가',
}

# subcategory → 예상 라벨 (강한 신호만)
SUB_TO_LABEL = {
    '여권': '행정',
    '주민등록등초본': '행정',
    '인감증명': '행정',
    '가족관계증명서': '행정',
    '도로명주소': '행정',
    '상세주소 신청': '행정',
    '동물등록 관련 신고': '농축산',
    '가축사육업': '농축산',
    '농약판매원': '농축산',
    '축산물 영업(생산업,가공업,유통업)': '농축산',
    '동물관련 영업': '농축산',
    '동물병원/약국': '농축산',
    '양봉농가': '농축산',
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
    '불법주정차': '교통',
    '자동차등록': '교통',
    '운수업': '교통',
    '주차장': '교통',
}

# 키워드 → 강하게 시사하는 라벨 (단독 키워드 1개로 결정 안 됨, 텍스트에서 등장 빈도/위치도 봄)
KEYWORD_TO_LABEL = {
    # 여권/주민등록 등은 압도적으로 행정
    '여권 발급': '행정',
    '여권 재발급': '행정',
    '주민등록증': '행정',
    '인감증명': '행정',
    '혼인신고': '행정',
    '가족관계증명서': '행정',
    '출생신고': '행정',
    '사망신고': '행정',
    # 축산
    '동물등록': '농축산',
    '가축': '농축산',
    '축산물': '농축산',
    '양봉': '농축산',
    '농약': '농축산',
    '농가': '농축산',
    # 보건위생
    '식중독': '보건위생',
    '코로나': '보건위생',
    '백신': '보건위생',
    '예방접종': '보건위생',
    # 교통
    '운전면허': '교통',
    '자동차세': '세무',  # 자동차 + 세금
    # 세무
    '재산세': '세무',
    '취득세': '세무',
    '지방세': '세무',
    # 환경
    '쓰레기 무단투기': '환경',
    '재활용품': '환경',
    '분리수거': '환경',
    # 상하수도
    '하수도 요금': '상하수도',
    '수도 요금': '상하수도',
    '단수': '상하수도',
}

print('로딩 중...')
records = []
with open(SRC, 'r', encoding='utf-8') as f:
    for line in f:
        records.append(json.loads(line))
print(f'총 {len(records):,}건')

# === 분석 ===
total_per_label = Counter(r['label'] for r in records)

noise_dept = []     # 부서 기반 의심
noise_sub  = []     # subcategory 기반 의심
noise_kw   = []     # 키워드 기반 의심
all_noise = set()   # doc_id 중복 제거용

# 카테고리별 카운터
noise_by_label = defaultdict(lambda: {'dept': 0, 'sub': 0, 'kw': 0, 'any': set()})

# 부서 기반 룰을 적용할 때 — 너무 일반적인 부서(민원지적과 등)는 룰에서 제외
# (DEPT_TO_LABEL에 이미 포함된 것만 사용)

for r in records:
    label = r['label']
    dept = r.get('department', '')
    sub = r.get('subcategory', '')
    text = r.get('text', '')
    doc_id = r.get('doc_id', '')

    # 1. department
    expected_from_dept = DEPT_TO_LABEL.get(dept)
    if expected_from_dept and expected_from_dept != label:
        noise_by_label[label]['dept'] += 1
        noise_by_label[label]['any'].add(doc_id)
        if len(noise_dept) < 5000:
            noise_dept.append({
                'doc_id': doc_id,
                'rule': 'dept',
                'current_label': label,
                'expected_label': expected_from_dept,
                'department': dept,
                'subcategory': sub,
                'text': text[:200],
            })

    # 2. subcategory
    expected_from_sub = SUB_TO_LABEL.get(sub)
    if expected_from_sub and expected_from_sub != label:
        noise_by_label[label]['sub'] += 1
        noise_by_label[label]['any'].add(doc_id)
        if len(noise_sub) < 5000:
            noise_sub.append({
                'doc_id': doc_id,
                'rule': 'sub',
                'current_label': label,
                'expected_label': expected_from_sub,
                'subcategory': sub,
                'department': dept,
                'text': text[:200],
            })

    # 3. keyword
    for kw, expected_kw_label in KEYWORD_TO_LABEL.items():
        if kw in text and expected_kw_label != label:
            noise_by_label[label]['kw'] += 1
            noise_by_label[label]['any'].add(doc_id)
            if len(noise_kw) < 5000:
                noise_kw.append({
                    'doc_id': doc_id,
                    'rule': 'kw',
                    'matched_keyword': kw,
                    'current_label': label,
                    'expected_label': expected_kw_label,
                    'subcategory': sub,
                    'department': dept,
                    'text': text[:200],
                })
            break  # 한 텍스트당 키워드 1개만

# === 리포트 ===
print('\n' + '='*80)
print('=== 카테고리별 노이즈 추정 (각 룰별, 중복 가능) ===')
print('='*80)
print(f'{"카테고리":<10} {"전체":>8} {"dept룰":>7} {"sub룰":>7} {"kw룰":>7} {"중복제거":>9} {"노이즈율":>8}')
print('-'*70)
totals = {'전체': 0, 'dept': 0, 'sub': 0, 'kw': 0, 'unique': 0}
for label in sorted(total_per_label, key=lambda x: -total_per_label[x]):
    tot = total_per_label[label]
    d = noise_by_label[label]['dept']
    s = noise_by_label[label]['sub']
    k = noise_by_label[label]['kw']
    u = len(noise_by_label[label]['any'])
    rate = u / tot * 100 if tot else 0
    print(f'{label:<10} {tot:>8,} {d:>7,} {s:>7,} {k:>7,} {u:>9,} {rate:>7.1f}%')
    totals['전체'] += tot
    totals['dept'] += d
    totals['sub'] += s
    totals['kw'] += k
    totals['unique'] += u

print('-'*70)
print(f'{"합계":<10} {totals["전체"]:>8,} {totals["dept"]:>7,} {totals["sub"]:>7,} {totals["kw"]:>7,} {totals["unique"]:>9,} {totals["unique"]/totals["전체"]*100:>7.1f}%')

# 카테고리별 → 가야 할 라벨 흐름 분석
print('\n' + '='*80)
print('=== 가장 큰 라벨 누수 흐름 (현재 라벨 → 예상 라벨) ===')
print('='*80)
flow = Counter()
for n in noise_dept + noise_sub + noise_kw:
    flow[(n['current_label'], n['expected_label'])] += 1

print(f'{"현재 라벨":<10} → {"예상 라벨":<10} {"누수":>8}')
print('-'*40)
for (cur, exp), c in flow.most_common(20):
    print(f'{cur:<10} → {exp:<10} {c:>8,}')

# 샘플 (각 룰별 6개)
print('\n' + '='*80)
print('=== Department 룰 노이즈 샘플 ===')
print('='*80)
import random
random.seed(11)
for n in random.sample(noise_dept, min(8, len(noise_dept))):
    print(f"\n  [{n['current_label']}] 부서={n['department']} (예상 {n['expected_label']})")
    print(f"    sub={n['subcategory']}")
    print(f"    {n['text']}")

print('\n' + '='*80)
print('=== Subcategory 룰 노이즈 샘플 ===')
print('='*80)
for n in random.sample(noise_sub, min(8, len(noise_sub))):
    print(f"\n  [{n['current_label']}] sub={n['subcategory']} (예상 {n['expected_label']})")
    print(f"    부서={n['department']}")
    print(f"    {n['text']}")

print('\n' + '='*80)
print('=== Keyword 룰 노이즈 샘플 ===')
print('='*80)
for n in random.sample(noise_kw, min(8, len(noise_kw))):
    print(f"\n  [{n['current_label']}] 매칭='{n['matched_keyword']}' (예상 {n['expected_label']})")
    print(f"    sub={n['subcategory']} | 부서={n['department']}")
    print(f"    {n['text']}")

# 저장
print(f'\n노이즈 후보 저장: {OUT}')
with open(OUT, 'w', encoding='utf-8') as f:
    for n in noise_dept + noise_sub + noise_kw:
        f.write(json.dumps(n, ensure_ascii=False) + '\n')
print(f'총 {len(noise_dept) + len(noise_sub) + len(noise_kw):,}건 (룰별 중복 가능)')
