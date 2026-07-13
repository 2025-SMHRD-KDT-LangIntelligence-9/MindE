"""긴급 분류 모델 학습 (이진, klue/bert-base)

데이터: labeled_dataset_with_urgency.jsonl (is_urgent 라벨 룰베이스 자동 생성)
불균형: 긴급 약 0.8%, 일반 99.2%
대응: 언더샘플링 (긴급 전부 + 일반 5배수) 또는 class_weight

분할:
  - group_id 단위 8:1:1
  - 일반은 train에서 긴급의 N배만 샘플링 (기본 N=5)
  - val/test는 전체 비율 유지 (실제 환경 평가)

평가: precision/recall/F1 (긴급 클래스 중심), ROC AUC
"""
import json, os, re, sys, random
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, EarlyStoppingCallback, set_seed,
)
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    classification_report, confusion_matrix, roc_auc_score,
)
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding='utf-8')
SEED = 42
set_seed(SEED)
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

DATA_DIR = r'C:/Users/smhrd/Desktop/데이터'
SRC = os.path.join(DATA_DIR, 'labeled_dataset_with_urgency.jsonl')
MODEL_NAME = 'klue/bert-base'
OUT_DIR = os.path.join(DATA_DIR, 'urgency-bert')
REPORT = os.path.join(DATA_DIR, 'urgency_training_report.json')

MAX_LEN = 128
BATCH_SIZE = 32
EPOCHS = 3
LR = 2e-5
NEG_RATIO = 5  # train에서 일반:긴급 비율 (5배)

# 마스킹 토큰 정규화 (분류기와 동일)
SPECIAL_TOKENS = ['[ADDR]', '[NAME]', '[ORG]', '[NUM]', '[TEL]', '[ACCT]', '[BIZ]', '[LOC]', '[PERSON]']
MASK_REPLACEMENTS = [
    (re.compile(r'#@주소@?\s?#'), '[ADDR]'),
    (re.compile(r'#@번호@?#'), '[NUM]'),
    (re.compile(r'#@이름#'), '[NAME]'),
    (re.compile(r'#@소속#'), '[ORG]'),
    (re.compile(r'#@전번#'), '[TEL]'),
    (re.compile(r'#@계정#'), '[ACCT]'),
    (re.compile(r'#@상호명?#'), '[BIZ]'),
    (re.compile(r'#@(?:장소|주차|위치)#'), '[LOC]'),
    (re.compile(r'#@신원#'), '[PERSON]'),
    (re.compile(r'#@[^#]+#'), '[UNK]'),
]


def normalize_text(text):
    for pat, repl in MASK_REPLACEMENTS:
        text = pat.sub(repl, text)
    return text


class UrgencyDataset(Dataset):
    def __init__(self, records, tokenizer, max_len):
        self.records = records
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.records)

    def __getitem__(self, i):
        r = self.records[i]
        text = normalize_text(r['text'])
        enc = self.tokenizer(
            text, truncation=True, max_length=self.max_len,
            padding='max_length', return_tensors='pt',
        )
        return {
            'input_ids': enc['input_ids'].squeeze(0),
            'attention_mask': enc['attention_mask'].squeeze(0),
            'token_type_ids': enc.get('token_type_ids', torch.zeros_like(enc['input_ids'])).squeeze(0),
            'labels': torch.tensor(int(r['is_urgent']), dtype=torch.long),
        }


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=1)
    probs = torch.softmax(torch.tensor(logits), dim=1).numpy()[:, 1]
    p, r, f1, _ = precision_recall_fscore_support(labels, preds, average='binary', zero_division=0)
    acc = accuracy_score(labels, preds)
    try:
        auc = roc_auc_score(labels, probs)
    except Exception:
        auc = 0.0
    return {
        'accuracy': acc,
        'precision_urgent': p,
        'recall_urgent': r,
        'f1_urgent': f1,
        'auc': auc,
    }


def load_and_split():
    """group_id 단위 8:1:1 분할 + train 언더샘플링."""
    print(f'로딩: {SRC}')
    by_label = defaultdict(lambda: defaultdict(list))  # is_urgent -> group_id -> [doc]
    n_total = 0
    with open(SRC, 'r', encoding='utf-8') as f:
        for line in f:
            r = json.loads(line)
            label = bool(r.get('is_urgent', False))
            gid = r.get('group_id', '')
            by_label[label][gid].append(r)
            n_total += 1
    print(f'총 {n_total:,}건')
    print(f'  긴급: {sum(len(v) for v in by_label[True].values()):,}건 / {len(by_label[True]):,} 그룹')
    print(f'  일반: {sum(len(v) for v in by_label[False].values()):,}건 / {len(by_label[False]):,} 그룹')

    train_pos, val_pos, test_pos = split_groups(by_label[True])
    train_neg, val_neg, test_neg = split_groups(by_label[False])

    # train 언더샘플링: 일반은 긴급의 NEG_RATIO 배만
    n_train_pos = len(train_pos)
    cap_neg = n_train_pos * NEG_RATIO
    if len(train_neg) > cap_neg:
        random.shuffle(train_neg)
        train_neg = train_neg[:cap_neg]
    print(f'\n언더샘플링 후 train: 긴급 {n_train_pos:,} / 일반 {len(train_neg):,} (비율 1:{len(train_neg)/n_train_pos:.1f})')

    # val/test는 전체 비율 유지 (실제 환경 평가)
    print(f'val: 긴급 {len(val_pos):,} / 일반 {len(val_neg):,}')
    print(f'test: 긴급 {len(test_pos):,} / 일반 {len(test_neg):,}')

    train = train_pos + train_neg
    val = val_pos + val_neg
    test = test_pos + test_neg

    random.shuffle(train)
    random.shuffle(val)
    random.shuffle(test)
    return train, val, test


def split_groups(groups_map, ratios=(0.8, 0.1, 0.1)):
    """group_id 단위 분할 → 각 split의 doc 리스트 반환."""
    gids = list(groups_map.keys())
    random.shuffle(gids)
    n = len(gids)
    n1 = int(n * ratios[0])
    n2 = int(n * (ratios[0] + ratios[1]))
    g_train, g_val, g_test = gids[:n1], gids[n1:n2], gids[n2:]
    train = [d for g in g_train for d in groups_map[g]]
    val = [d for g in g_val for d in groups_map[g]]
    test = [d for g in g_test for d in groups_map[g]]
    return train, val, test


def main():
    print(f'CUDA: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'GPU: {torch.cuda.get_device_name(0)}')

    train_recs, val_recs, test_recs = load_and_split()

    print(f'\n모델 로딩: {MODEL_NAME}')
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    n_added = tokenizer.add_special_tokens({'additional_special_tokens': SPECIAL_TOKENS})
    print(f'special tokens 추가: {n_added}개')

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=2,
        id2label={0: '일반', 1: '긴급'}, label2id={'일반': 0, '긴급': 1},
    )
    model.resize_token_embeddings(len(tokenizer))

    train_ds = UrgencyDataset(train_recs, tokenizer, MAX_LEN)
    val_ds = UrgencyDataset(val_recs, tokenizer, MAX_LEN)
    test_ds = UrgencyDataset(test_recs, tokenizer, MAX_LEN)

    args = TrainingArguments(
        output_dir=OUT_DIR,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE * 2,
        learning_rate=LR,
        warmup_ratio=0.1,
        weight_decay=0.01,
        eval_strategy='epoch',
        save_strategy='epoch',
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model='f1_urgent',
        greater_is_better=True,
        logging_steps=50,
        fp16=True,
        report_to='none',
        seed=SEED,
        dataloader_num_workers=2,
    )

    trainer = Trainer(
        model=model, args=args,
        train_dataset=train_ds, eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    print('\n=== 학습 시작 ===')
    trainer.train()

    print('\n=== 테스트 셋 평가 ===')
    pred = trainer.predict(test_ds)
    preds = np.argmax(pred.predictions, axis=1)
    probs = torch.softmax(torch.tensor(pred.predictions), dim=1).numpy()[:, 1]
    labels_true = pred.label_ids

    print(classification_report(
        labels_true, preds, target_names=['일반', '긴급'], digits=4, zero_division=0,
    ))
    cm = confusion_matrix(labels_true, preds)
    print('Confusion matrix (행=실제, 열=예측):')
    print(f'              예측일반   예측긴급')
    print(f'실제일반    {cm[0,0]:>8} {cm[0,1]:>8}')
    print(f'실제긴급    {cm[1,0]:>8} {cm[1,1]:>8}')

    p, r, f1, _ = precision_recall_fscore_support(labels_true, preds, average='binary', zero_division=0)
    try:
        auc = roc_auc_score(labels_true, probs)
    except Exception:
        auc = 0.0

    report = {
        'model': MODEL_NAME,
        'test_accuracy': float(accuracy_score(labels_true, preds)),
        'test_precision_urgent': float(p),
        'test_recall_urgent': float(r),
        'test_f1_urgent': float(f1),
        'test_auc': float(auc),
        'confusion_matrix': cm.tolist(),
        'config': {
            'max_len': MAX_LEN, 'batch_size': BATCH_SIZE, 'epochs': EPOCHS,
            'lr': LR, 'neg_ratio': NEG_RATIO,
            'train_size': len(train_ds), 'val_size': len(val_ds), 'test_size': len(test_ds),
        },
    }
    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    trainer.save_model(os.path.join(OUT_DIR, 'final'))
    tokenizer.save_pretrained(os.path.join(OUT_DIR, 'final'))

    print(f'\n저장:')
    print(f'  모델: {OUT_DIR}/final/')
    print(f'  리포트: {REPORT}')
    print(f'\n긴급 F1: {f1:.4f}')
    print(f'AUC: {auc:.4f}')


if __name__ == '__main__':
    main()
