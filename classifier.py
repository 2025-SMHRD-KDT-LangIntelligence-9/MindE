"""민원 분류 추론 wrapper

v5 BERT 모델(11 클래스) 로드 + 단일/배치 추론 + confidence 반환.
MCP 서버, API, 노트북 어디서나 import해서 쓰는 단일 진입점.

사용 예:
    from classifier import ComplaintClassifier

    clf = ComplaintClassifier()
    result = clf.predict("우리 동네에 쓰레기 무단투기가 너무 많아요")
    # {
    #     'category': '환경',
    #     'confidence': 0.94,
    #     'top3': [('환경', 0.94), ('보건위생', 0.03), ('교통', 0.01)],
    #     'all_scores': {...}
    # }

    results = clf.predict_batch(["민원1", "민원2", "민원3"])
"""
import re
import json
from pathlib import Path
from typing import Union

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# 학습 시 사용한 라벨/마스킹 매핑 동일하게 유지
LABELS = ['교통', '건축', '행정', '보건위생', '환경', '문화_여가',
          '농축산', '복지', '세무', '상하수도', '경제']

MASK_REPLACEMENTS = [
    (re.compile(r'#@주소@?\s?#'),          '[ADDR]'),
    (re.compile(r'#@번호@?#'),             '[NUM]'),
    (re.compile(r'#@이름#'),               '[NAME]'),
    (re.compile(r'#@소속#'),               '[ORG]'),
    (re.compile(r'#@전번#'),               '[TEL]'),
    (re.compile(r'#@계정#'),               '[ACCT]'),
    (re.compile(r'#@상호명?#'),            '[BIZ]'),
    (re.compile(r'#@(?:장소|주차|위치)#'),  '[LOC]'),
    (re.compile(r'#@신원#'),               '[PERSON]'),
    (re.compile(r'#@[^#]+#'),              '[UNK]'),  # 정의 외 마스킹
]


def normalize_text(text: str) -> str:
    """학습 시와 동일한 마스킹 토큰 정규화."""
    for pat, repl in MASK_REPLACEMENTS:
        text = pat.sub(repl, text)
    return text


class ComplaintClassifier:
    """KLUE BERT 기반 민원 분류기 (v5, 11 클래스)."""

    DEFAULT_MODEL_DIR = Path(__file__).parent / 'bert-v5' / 'final'

    def __init__(self, model_dir: Union[str, Path, None] = None,
                 device: str = None, max_length: int = 128):
        # 로컬 경로 또는 HuggingFace model_id (예: "atti433/minde-classifier") 지원.
        # HF model_id면 transformers가 자동 다운로드 (HF_TOKEN env 필요, private일 때).
        _val = model_dir if model_dir else self.DEFAULT_MODEL_DIR
        _val_str = str(_val)
        if Path(_val_str).exists():
            self.model_dir = Path(_val_str)   # 로컬
        elif '/' in _val_str and not _val_str.startswith(('.', '/', '\\')) and ':' not in _val_str[:3]:
            self.model_dir = _val_str          # HF model_id (예: "atti433/minde-classifier")
        else:
            raise FileNotFoundError(f'모델 폴더/저장소 없음: {_val_str}')

        # device 자동 선택 (cuda 가능하면 cuda)
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.device = torch.device(device)
        self.max_length = max_length

        self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_dir))
        self.model.to(self.device)
        self.model.eval()

        # config의 id2label 우선 사용, 없으면 기본 LABELS
        id2label = getattr(self.model.config, 'id2label', None)
        if id2label and len(id2label) == len(LABELS):
            # 정수 키로 정렬
            self.labels = [id2label[i] for i in sorted(id2label.keys(), key=int)]
        else:
            self.labels = LABELS

    @torch.no_grad()
    def predict(self, text: str, top_k: int = 3) -> dict:
        """단일 텍스트 분류."""
        text = normalize_text(text.strip())
        if not text:
            return {'category': None, 'confidence': 0.0, 'top_k': [], 'all_scores': {}}
        enc = self.tokenizer(text,
                             truncation=True, max_length=self.max_length,
                             padding=True, return_tensors='pt')
        enc = {k: v.to(self.device) for k, v in enc.items()}
        logits = self.model(**enc).logits.squeeze(0)
        probs = torch.softmax(logits, dim=-1)
        pred_idx = int(probs.argmax().item())
        # top_k
        top_vals, top_idx = torch.topk(probs, k=min(top_k, len(self.labels)))
        top_list = [(self.labels[int(i)], float(v)) for v, i in zip(top_vals, top_idx)]
        return {
            'category': self.labels[pred_idx],
            'confidence': float(probs[pred_idx]),
            'top_k': top_list,
            'all_scores': {self.labels[i]: float(probs[i]) for i in range(len(self.labels))},
        }

    @torch.no_grad()
    def predict_batch(self, texts: list, top_k: int = 3, batch_size: int = 32) -> list:
        """여러 텍스트 한 번에 분류."""
        if not texts:
            return []
        results = []
        for i in range(0, len(texts), batch_size):
            chunk = [normalize_text(t.strip()) if t else '' for t in texts[i:i+batch_size]]
            enc = self.tokenizer(chunk,
                                 truncation=True, max_length=self.max_length,
                                 padding=True, return_tensors='pt')
            enc = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits
            probs = torch.softmax(logits, dim=-1)
            preds = probs.argmax(dim=-1)
            top_vals, top_idx = torch.topk(probs, k=min(top_k, len(self.labels)), dim=-1)
            for j in range(len(chunk)):
                idx = int(preds[j].item())
                top_list = [(self.labels[int(top_idx[j, k].item())],
                             float(top_vals[j, k].item()))
                            for k in range(top_vals.size(1))]
                results.append({
                    'category': self.labels[idx],
                    'confidence': float(probs[j, idx].item()),
                    'top_k': top_list,
                    'all_scores': {self.labels[k]: float(probs[j, k].item())
                                   for k in range(len(self.labels))},
                })
        return results

    def __repr__(self):
        return (f'ComplaintClassifier(model_dir={self.model_dir}, '
                f'device={self.device}, num_labels={len(self.labels)})')


# CLI: 단일 텍스트 분류 빠른 테스트
if __name__ == '__main__':
    import argparse, sys
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('text', nargs='?', help='분류할 민원 텍스트 (생략 시 데모 케이스 실행)')
    ap.add_argument('--model-dir', default=None)
    ap.add_argument('--top-k', type=int, default=5)
    args = ap.parse_args()

    print('모델 로딩 중...')
    clf = ComplaintClassifier(model_dir=args.model_dir)
    print(f'  로드 완료: {clf}\n')

    if args.text:
        cases = [args.text]
    else:
        # 데모 케이스 (각 카테고리 1개씩)
        cases = [
            '집 앞에 차가 자꾸 불법주차해서 너무 불편합니다. 단속 부탁드려요.',
            '아파트 신축 공사장에서 발생하는 소음이 너무 심합니다.',
            '주민등록등본 발급 관련 문의드립니다.',
            '식당 위생 상태 점검 신청합니다.',
            '쓰레기 무단투기가 너무 많아 신고합니다.',
            '○○공원 산책로 정비가 필요합니다.',
            '동물등록은 어떻게 하나요?',
            '저소득층 생계 지원 신청 방법 알려주세요.',
            '재산세 부과 내역이 이상해서 문의드립니다.',
            '상수도 누수 신고합니다.',
            '소상공인 지원금 신청 자격이 궁금합니다.',
        ]
    for t in cases:
        r = clf.predict(t, top_k=args.top_k)
        print(f'입력: {t}')
        print(f'  → {r["category"]} (conf {r["confidence"]:.3f})')
        if len(cases) <= 3:
            print(f'  top {len(r["top_k"])}: {r["top_k"]}')
        print()
