# 모델 weight 다운로드

GitHub 저장소에는 모델 weight(`*.safetensors`, `*.bin`)를 **커밋하지 않음**.
용량이 크고 (각 400~500MB) git에 안 맞음. 별도 스토리지에서 받아 이 폴더에 배치.

## 필요한 모델 2개

### 1. 분류기 (`bert-v9/final/`)

KLUE BERT base 파인튜닝, 11 카테고리. F1 0.873.

```
models/bert-v9/final/
  ├── config.json
  ├── model.safetensors          (~430MB)
  ├── tokenizer.json
  ├── tokenizer_config.json
  ├── special_tokens_map.json
  ├── added_tokens.json
  ├── vocab.txt
  └── training_args.bin
```

### 2. 긴급 분류기 (`urgency-bert/final/`)

KLUE BERT base 파인튜닝, 이진. F1(긴급) 0.93.

```
models/urgency-bert/final/
  ├── config.json
  ├── model.safetensors          (~430MB)
  ├── tokenizer.json
  ├── tokenizer_config.json
  ├── special_tokens_map.json
  ├── added_tokens.json
  ├── vocab.txt
  └── training_args.bin
```

## 다운로드 위치

(여기에 실제 스토리지 URL/명령 추가)

옵션:
- **Hugging Face Hub** (private repo) — `huggingface-cli download`
- **Google Drive / 회사 NAS** — 공유 링크
- **S3 / 회사 internal repo** — `aws s3 cp` 등

배포 시점에 결정 후 본 README 갱신.

## 직접 학습하려면

`scripts/train_classifier.py`, `scripts/train_urgency.py` 참조.
필요 데이터:
- AI Hub 143번 데이터 (build_labels.py + split_and_sample.py로 전처리)

RTX 4060 Ti 기준 분류기 약 45분, 긴급 분류기 약 15분.

## 경로 오버라이드

기본 경로 `./models/bert-v9/final/`, `./models/urgency-bert/final/`.
다른 위치에 두려면 환경변수:
```
CLASSIFIER_DIR=/data/models/bert-v9/final
URGENCY_DIR=/data/models/urgency-bert/final
```
