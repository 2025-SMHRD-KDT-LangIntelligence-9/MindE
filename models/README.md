# 모델 weight 다운로드

GitHub 저장소에는 모델 weight를 커밋하지 않음 (각 ~430MB).
**Hugging Face Hub의 private repo**에서 받아 이 폴더에 배치.

## 다운로드 (백엔드 셋업 시 1회)

### 1. Hugging Face 계정 + Read 권한
1. [huggingface.co](https://huggingface.co) 가입
2. 본인 HF 계정을 `atti433`에게 알려주면 두 repo에 read 권한 부여
   - https://huggingface.co/atti433/minde-classifier (분류기)
   - https://huggingface.co/atti433/minde-urgency (긴급 분류)

### 2. Read 토큰 생성
- HF Settings → Access Tokens → New token → **Read 권한**

### 3. CLI 로그인 + 다운로드
```bash
pip install huggingface_hub
huggingface-cli login
# Read 토큰 붙여넣기

# 분류기
huggingface-cli download atti433/minde-classifier \
  --local-dir models/bert-v9/final

# 긴급 분류기
huggingface-cli download atti433/minde-urgency \
  --local-dir models/urgency-bert/final
```

다운로드 후 폴더 구조:
```
models/
  ├── bert-v9/final/
  │     ├── config.json
  │     ├── model.safetensors   (~443MB)
  │     ├── tokenizer.json
  │     ├── tokenizer_config.json
  │     ├── special_tokens_map.json
  │     ├── added_tokens.json
  │     ├── vocab.txt
  │     └── training_args.bin
  │
  └── urgency-bert/final/
        └── (동일 구조)
```

## 모델 사양

| 모델 | 베이스 | 클래스 | test 성능 |
|---|---|---:|---:|
| `minde-classifier` (bert-v9) | klue/bert-base | 11 | acc 0.871 / macro F1 0.873 |
| `minde-urgency` (urgency-bert) | klue/bert-base | 2 (이진) | acc 0.999 / F1(긴급) 0.929 |

## 경로 오버라이드

기본 경로는 `./models/bert-v9/final/`, `./models/urgency-bert/final/`.
다른 위치에 두려면 환경변수:
```
CLASSIFIER_DIR=/path/to/bert-v9/final
URGENCY_DIR=/path/to/urgency-bert/final
```

## 직접 학습하려면

scripts/ 폴더의 `train_classifier.py`, `train_urgency.py` 참조.
필요 데이터: AI Hub 143번 데이터 (build_labels.py + split_and_sample.py로 전처리).
RTX 4060 Ti 기준 분류기 약 45분, 긴급 분류기 약 15분.
