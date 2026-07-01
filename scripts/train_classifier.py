"""KLUE BERT 11-class 민원 분류기 파인튜닝 (v2: 공통 제외)"""
import json, os, sys, re, random
import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, EarlyStoppingCallback,
    set_seed,
)
from sklearn.metrics import (
    accuracy_score, f1_score, precision_recall_fscore_support,
    classification_report, confusion_matrix,
)

sys.stdout.reconfigure(encoding='utf-8')
SEED = 42
set_seed(SEED)
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

# ===== 설정 =====
DATA_DIR   = r'C:/Users/smhrd/Desktop/데이터'
MODEL_NAME = 'klue/bert-base'   # v10: 안전건설 분기 + 옥외광고물/도로 sub override
OUT_DIR    = os.path.join(DATA_DIR, 'bert-v10')
REPORT_NAME = 'training_report_v10.json'
MAX_LEN    = 128
BATCH_SIZE = 32
EPOCHS     = 3
LR         = 2e-5

# 11 카테고리 (교육 제외) - v9: v5 매핑 복원 + 노이즈 보정
LABELS = ['교통','건축','행정','보건위생','환경','문화_여가','농축산','복지','세무','상하수도','경제']
LABEL2ID = {l:i for i,l in enumerate(LABELS)}
ID2LABEL = {i:l for l,i in LABEL2ID.items()}

# Special token 매핑 (마스킹 → 의미 토큰)
SPECIAL_TOKENS = ['[ADDR]','[NAME]','[ORG]','[NUM]','[TEL]','[ACCT]','[BIZ]','[LOC]','[PERSON]']
MASK_REPLACEMENTS = [
    (re.compile(r'#@주소@?\s?#'),  '[ADDR]'),
    (re.compile(r'#@번호@?#'),     '[NUM]'),
    (re.compile(r'#@이름#'),       '[NAME]'),
    (re.compile(r'#@소속#'),       '[ORG]'),
    (re.compile(r'#@전번#'),       '[TEL]'),
    (re.compile(r'#@계정#'),       '[ACCT]'),
    (re.compile(r'#@상호명?#'),    '[BIZ]'),
    (re.compile(r'#@(?:장소|주차|위치)#'), '[LOC]'),
    (re.compile(r'#@신원#'),       '[PERSON]'),
    # 미정의 마스킹 토큰은 [UNK]로 대체
    (re.compile(r'#@[^#]+#'),     '[UNK]'),
]

def normalize_text(text: str) -> str:
    for pat, repl in MASK_REPLACEMENTS:
        text = pat.sub(repl, text)
    return text

# ===== Dataset =====
class ComplaintDataset(Dataset):
    def __init__(self, path, tokenizer, max_len=128):
        self.records = []
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                r = json.loads(line)
                self.records.append({
                    'text': normalize_text(r['text']),
                    'label': LABEL2ID[r['label']],
                })
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self): return len(self.records)

    def __getitem__(self, i):
        r = self.records[i]
        enc = self.tokenizer(
            r['text'], truncation=True, max_length=self.max_len,
            padding='max_length', return_tensors='pt'
        )
        return {
            'input_ids':      enc['input_ids'].squeeze(0),
            'attention_mask': enc['attention_mask'].squeeze(0),
            'token_type_ids': enc.get('token_type_ids', torch.zeros_like(enc['input_ids'])).squeeze(0),
            'labels':         torch.tensor(r['label'], dtype=torch.long),
        }

# ===== 평가 지표 =====
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=1)
    acc = accuracy_score(labels, preds)
    f1_macro = f1_score(labels, preds, average='macro')
    f1_weighted = f1_score(labels, preds, average='weighted')
    return {
        'accuracy':    acc,
        'f1_macro':    f1_macro,
        'f1_weighted': f1_weighted,
    }

# ===== 메인 =====
def main():
    print(f'CUDA 사용 가능: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'GPU: {torch.cuda.get_device_name(0)}')
        print(f'CUDA: {torch.version.cuda}')

    print(f'\n모델 로딩: {MODEL_NAME}')
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    # Special token 추가
    n_added = tokenizer.add_special_tokens({'additional_special_tokens': SPECIAL_TOKENS})
    print(f'추가된 special tokens: {n_added}개 → {SPECIAL_TOKENS}')

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )
    # vocab 확장 후 embedding 크기 맞추기
    model.resize_token_embeddings(len(tokenizer))
    print(f'vocab size: {len(tokenizer)}')

    print('\n데이터 로딩...')
    train_ds = ComplaintDataset(os.path.join(DATA_DIR,'train.jsonl'), tokenizer, MAX_LEN)
    val_ds   = ComplaintDataset(os.path.join(DATA_DIR,'val.jsonl'),   tokenizer, MAX_LEN)
    test_ds  = ComplaintDataset(os.path.join(DATA_DIR,'test.jsonl'),  tokenizer, MAX_LEN)
    print(f'  train: {len(train_ds):,}')
    print(f'  val:   {len(val_ds):,}')
    print(f'  test:  {len(test_ds):,}')

    args = TrainingArguments(
        output_dir=OUT_DIR,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE*2,
        learning_rate=LR,
        warmup_ratio=0.1,
        weight_decay=0.01,
        eval_strategy='epoch',
        save_strategy='epoch',
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model='f1_macro',
        greater_is_better=True,
        logging_steps=100,
        logging_dir=os.path.join(OUT_DIR, 'logs'),
        fp16=True,  # mixed precision: 메모리 절약 + 속도 ↑
        report_to='none',
        seed=SEED,
        dataloader_num_workers=2,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    print('\n=== 학습 시작 ===')
    trainer.train()

    print('\n=== 테스트 셋 평가 ===')
    test_result = trainer.predict(test_ds)
    preds = np.argmax(test_result.predictions, axis=1)
    labels_true = test_result.label_ids

    report = classification_report(
        labels_true, preds, target_names=LABELS, digits=4, output_dict=False, zero_division=0
    )
    print(report)

    # 저장용 메트릭
    f1_per_class = f1_score(labels_true, preds, average=None, zero_division=0)
    prec, rec, f1, supp = precision_recall_fscore_support(
        labels_true, preds, zero_division=0
    )
    cm = confusion_matrix(labels_true, preds).tolist()

    out = {
        'model_name': MODEL_NAME,
        'labels': LABELS,
        'test_accuracy': float(accuracy_score(labels_true, preds)),
        'test_f1_macro': float(f1_score(labels_true, preds, average='macro')),
        'test_f1_weighted': float(f1_score(labels_true, preds, average='weighted')),
        'per_class': {
            l: {'precision':float(prec[i]),'recall':float(rec[i]),'f1':float(f1[i]),'support':int(supp[i])}
            for i, l in enumerate(LABELS)
        },
        'confusion_matrix': cm,
        'config': {
            'max_len': MAX_LEN, 'batch_size': BATCH_SIZE, 'epochs': EPOCHS, 'lr': LR,
            'train_size': len(train_ds), 'val_size': len(val_ds), 'test_size': len(test_ds),
            'special_tokens': SPECIAL_TOKENS,
        },
    }
    with open(os.path.join(DATA_DIR, REPORT_NAME),'w',encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # 최종 모델 저장
    trainer.save_model(os.path.join(OUT_DIR,'final'))
    tokenizer.save_pretrained(os.path.join(OUT_DIR,'final'))

    print(f'\n저장 완료:')
    print(f'  모델: {OUT_DIR}/final/')
    print(f'  리포트: {DATA_DIR}/{REPORT_NAME}')
    print(f'\n테스트 macro F1: {out["test_f1_macro"]:.4f}')
    print(f'테스트 accuracy:  {out["test_accuracy"]:.4f}')

if __name__ == '__main__':
    main()
