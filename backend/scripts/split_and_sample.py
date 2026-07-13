"""group_id 단위 분할 + 카테고리별 다운샘플링

- Train/Val/Test 분할 비율: 8:1:1 (group_id 단위, stratified by label)
- Train: 카테고리당 최대 20,000건
- Val:   카테고리당 최대  2,000건 (balanced eval)
- Test:  카테고리당 최대  2,000건 (balanced eval)

작은 카테고리(상하수도/경제 등)는 cap에 미달하면 그대로 사용.
"""
import json, os, random, sys
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding='utf-8')
random.seed(42)

SRC  = r'C:/Users/smhrd/Desktop/데이터/labeled_dataset.jsonl'
OUT  = r'C:/Users/smhrd/Desktop/데이터'

TRAIN_RATIO = 0.8
VAL_RATIO   = 0.1
# test = 1 - train - val

TRAIN_CAP = 20_000
VAL_CAP   = 2_000
TEST_CAP  = 2_000

# Step 1: load and group
print('로딩 중...')
docs_by_label_group = defaultdict(lambda: defaultdict(list))  # label -> group_id -> [doc]
with open(SRC, 'r', encoding='utf-8') as f:
    for line in f:
        r = json.loads(line)
        docs_by_label_group[r['label']][r['group_id']].append(r)

print('카테고리/그룹 통계:')
for label in sorted(docs_by_label_group, key=lambda x: -sum(len(v) for v in docs_by_label_group[x].values())):
    groups = docs_by_label_group[label]
    n_docs = sum(len(v) for v in groups.values())
    print(f'  {label:10s}: {n_docs:>7,} docs / {len(groups):>7,} groups')

# Step 2: group-level split per label
print('\n그룹 단위 분할 중...')
train_recs, val_recs, test_recs = [], [], []
split_stats = defaultdict(lambda: {'train':0,'val':0,'test':0,'train_groups':0,'val_groups':0,'test_groups':0})

for label, groups_map in docs_by_label_group.items():
    group_ids = list(groups_map.keys())
    random.shuffle(group_ids)
    n = len(group_ids)
    n_train = int(n * TRAIN_RATIO)
    n_val   = int(n * VAL_RATIO)
    g_train = set(group_ids[:n_train])
    g_val   = set(group_ids[n_train:n_train+n_val])
    g_test  = set(group_ids[n_train+n_val:])

    # Collect docs per split
    train_docs = [d for gid in g_train for d in groups_map[gid]]
    val_docs   = [d for gid in g_val   for d in groups_map[gid]]
    test_docs  = [d for gid in g_test  for d in groups_map[gid]]

    # Downsample
    if len(train_docs) > TRAIN_CAP:
        random.shuffle(train_docs)
        train_docs = train_docs[:TRAIN_CAP]
    if len(val_docs) > VAL_CAP:
        random.shuffle(val_docs)
        val_docs = val_docs[:VAL_CAP]
    if len(test_docs) > TEST_CAP:
        random.shuffle(test_docs)
        test_docs = test_docs[:TEST_CAP]

    train_recs.extend(train_docs)
    val_recs.extend(val_docs)
    test_recs.extend(test_docs)

    split_stats[label]['train'] = len(train_docs)
    split_stats[label]['val']   = len(val_docs)
    split_stats[label]['test']  = len(test_docs)
    split_stats[label]['train_groups'] = len(g_train)
    split_stats[label]['val_groups']   = len(g_val)
    split_stats[label]['test_groups']  = len(g_test)

# Step 3: shuffle final splits
random.shuffle(train_recs)
random.shuffle(val_recs)
random.shuffle(test_recs)

# Step 4: write
out_files = {
    'train': os.path.join(OUT, 'train.jsonl'),
    'val':   os.path.join(OUT, 'val.jsonl'),
    'test':  os.path.join(OUT, 'test.jsonl'),
}
for split, recs in [('train',train_recs),('val',val_recs),('test',test_recs)]:
    with open(out_files[split], 'w', encoding='utf-8') as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

# Step 5: report
print('\n=== 최종 분할 결과 ===')
print(f'{"카테고리":<10} {"Train":>8} {"Val":>6} {"Test":>6}  | {"Train그룹":>10} {"Val그룹":>9} {"Test그룹":>9}')
print('-'*78)
labels_sorted = sorted(split_stats, key=lambda x: -split_stats[x]['train'])
for label in labels_sorted:
    s = split_stats[label]
    print(f'{label:<10} {s["train"]:>8,} {s["val"]:>6,} {s["test"]:>6,}  | '
          f'{s["train_groups"]:>10,} {s["val_groups"]:>9,} {s["test_groups"]:>9,}')
print('-'*78)
print(f'{"합계":<10} {len(train_recs):>8,} {len(val_recs):>6,} {len(test_recs):>6,}')

print(f'\n생성 파일:')
for split, path in out_files.items():
    print(f'  {path}  ({os.path.getsize(path)/1024/1024:.1f} MB)')
