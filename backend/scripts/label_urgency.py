"""민원 긴급 여부 자동 라벨링 (이진, 룰베이스 v2)

키워드 셋: 우리가 검토한 최종 30개 (행정 우선 처리 등급 = 시설 위험/예방/보호 우선)
출처: 119 소방청, 행정안전부 재난문자 분류 참고

is_urgent: True/False
  True  — 행정상 신속 처리 필요 (붕괴/감전/가스/산사태/학대/화학사고 등)
  False — 그 외 (119/112 직통이거나 단순 문의)

입력: labeled_dataset.jsonl
출력: labeled_dataset_with_urgency.jsonl (기존 + 'is_urgent' + 'urgency_reason')
     urgency_report.txt
"""
import json, re, sys, random
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
random.seed(42)

SRC = Path(r'C:/Users/smhrd/Desktop/데이터/labeled_dataset.jsonl')
OUT = Path(r'C:/Users/smhrd/Desktop/데이터/labeled_dataset_with_urgency.jsonl')
REPORT = Path(r'C:/Users/smhrd/Desktop/데이터/urgency_report.txt')

# ===== 최종 긴급 키워드 (30개) =====
URGENT_PATTERNS = [
    # 붕괴/구조물 위험
    r'붕괴', r'무너지', r'무너졌',
    # 전기 사고
    r'감전', r'전선\s*끊', r'전봇대\s*쓰러',
    # 가스
    r'가스\s*누출', r'가스누출', r'가스\s*냄새', r'가스냄새', r'가스\s*누설',
    # 추락/매몰
    r'추락', r'떨어졌',
    r'매몰', r'깔렸',
    # 화재 관련 (시설 안전)
    r'화재', r'폭발음', r'연기',
    # 사람·물체 쓰러짐
    r'쓰러졌', r'쓰러진',
    # 자연재해
    r'산사태', r'토사\s*무너', r'지진', r'쓰나미',
    # 보호 우선
    r'아동학대', r'노인학대', r'가정폭력',
    # 화학/방사능
    r'화학물질\s*누출', r'방사능',
    r'독성', r'독극물',
]

# 제외 룰 — 긴급 키워드 매칭됐어도 같이 있으면 일반(예방/안내/문의 맥락)
EXCLUDE_PATTERNS = [
    r'예방', r'대비', r'우려가\s*있',
    r'안내', r'안내해', r'방법\s*알려', r'절차',
    r'신고\s*방법', r'신고\s*안내',
    r'문의\s*드', r'어떻게\s*해', r'어떻게\s*하나',
    r'어디로\s*신고', r'어디서',
]

URGENT_RE = [re.compile(p) for p in URGENT_PATTERNS]
EXCLUDE_RE = [re.compile(p) for p in EXCLUDE_PATTERNS]


def is_urgent(text: str) -> tuple[bool, str]:
    text = text or ''
    matched = None
    for p in URGENT_RE:
        m = p.search(text)
        if m:
            matched = m.group(0)
            break
    if not matched:
        return False, ''
    for p in EXCLUDE_RE:
        if p.search(text):
            return False, f'excluded:{matched}'
    return True, matched


def main():
    print(f'로딩: {SRC}')
    records = []
    with SRC.open('r', encoding='utf-8') as f:
        for line in f:
            records.append(json.loads(line))
    print(f'총 {len(records):,}건')

    urgent_count = 0
    excluded_count = 0
    samples_urgent = []
    kw_counts = Counter()
    cat_urgent = Counter()

    with OUT.open('w', encoding='utf-8') as fout:
        for r in records:
            text = r.get('text', '')
            urgent, reason = is_urgent(text)

            r['is_urgent'] = urgent
            r['urgency_reason'] = reason

            if urgent:
                urgent_count += 1
                kw_counts[reason] += 1
                cat_urgent[r.get('label', '')] += 1
                if len(samples_urgent) < 30:
                    samples_urgent.append({
                        'text': text[:200],
                        'reason': reason,
                        'category': r.get('label', ''),
                    })
            elif reason.startswith('excluded'):
                excluded_count += 1

            fout.write(json.dumps(r, ensure_ascii=False) + '\n')

    total = len(records)
    lines = []
    lines.append('=' * 70)
    lines.append('긴급 여부 자동 라벨링 (이진, 최종 30 키워드)')
    lines.append('=' * 70)
    lines.append(f'\n총 {total:,}건')
    lines.append(f'  긴급: {urgent_count:,} ({urgent_count/total*100:.2f}%)')
    lines.append(f'  일반: {total - urgent_count:,} ({(total-urgent_count)/total*100:.2f}%)')
    lines.append(f'  (예외룰로 빠진 건: {excluded_count:,})')

    lines.append('\n=== 매칭 키워드 분포 ===')
    for kw, c in kw_counts.most_common():
        lines.append(f'  {kw:<15}: {c:,}')

    lines.append('\n=== 카테고리별 긴급 ===')
    for cat, c in cat_urgent.most_common():
        lines.append(f'  {cat:<10}: {c:,}')

    lines.append('\n=== 긴급 샘플 (랜덤 20) ===')
    random.shuffle(samples_urgent)
    for s in samples_urgent[:20]:
        lines.append(f'\n  [{s["category"]:<8}] 매칭="{s["reason"]}"')
        lines.append(f'    {s["text"]}')

    report = '\n'.join(lines)
    REPORT.write_text(report, encoding='utf-8')
    print('\n' + report[:2500])
    if len(report) > 2500:
        print(f'... (전체 리포트는 {REPORT})')

    print(f'\n출력: {OUT} ({OUT.stat().st_size/1024/1024:.1f} MB)')


if __name__ == '__main__':
    main()
