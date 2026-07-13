"""학습 기록 JSON을 터미널에 예쁘게 출력.

사용법:
    python scripts/show_training_report.py
    python scripts/show_training_report.py [경로]

기본 경로: C:/Users/smhrd/Desktop/데이터/training_report_v10.json
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DEFAULT_PATH = r'C:/Users/smhrd/Desktop/데이터/training_report_v10.json'


def _bar(width: int, ch: str = '=') -> str:
    return ch * width


def show(report_path: str) -> None:
    if not os.path.exists(report_path):
        print(f'[ERROR] 리포트 파일 없음: {report_path}')
        sys.exit(1)

    with open(report_path, 'r', encoding='utf-8') as f:
        r = json.load(f)

    labels = r['labels']
    per_class = r['per_class']
    cfg = r['config']
    cm = r['confusion_matrix']

    W = 78
    print()
    print(_bar(W))
    print('  KLUE BERT 민원 분류기 학습 완료 (v10-relabel)')
    print(_bar(W))
    print()
    print(f'  모델           : {r["model_name"]}')
    print(f'  카테고리 수    : {len(labels)} (교육 제외)')
    print(f'  학습 셋 크기   : {cfg["train_size"]:,}')
    print(f'  검증 셋 크기   : {cfg["val_size"]:,}')
    print(f'  테스트 셋 크기 : {cfg["test_size"]:,}')
    print()
    print(f'  하이퍼파라미터 : max_len={cfg["max_len"]}, batch={cfg["batch_size"]}, '
          f'epochs={cfg["epochs"]}, lr={cfg["lr"]}')
    print(f'  스페셜 토큰    : {", ".join(cfg["special_tokens"])}')
    print()

    print(_bar(W, '-'))
    print('  카테고리별 성능')
    print(_bar(W, '-'))
    print(f'  {"카테고리":<10}  {"precision":>10}  {"recall":>10}  {"f1":>10}  {"support":>10}')
    print(_bar(W, '-'))
    for lbl in labels:
        m = per_class[lbl]
        print(f'  {lbl:<10}  {m["precision"]:>10.4f}  {m["recall"]:>10.4f}  '
              f'{m["f1"]:>10.4f}  {m["support"]:>10,}')
    print(_bar(W, '-'))
    total_support = sum(per_class[l]['support'] for l in labels)
    print(f'  {"total":<10}  {"":>10}  {"":>10}  {"":>10}  {total_support:>10,}')
    print()

    print(_bar(W, '-'))
    print('  Confusion Matrix (행: 정답, 열: 예측)')
    print(_bar(W, '-'))
    # 헤더 (라벨 축약)
    short = [l[:4] for l in labels]
    header = '  ' + ' ' * 10 + ''.join(f'{s:>6}' for s in short)
    print(header)
    for i, lbl in enumerate(labels):
        row = f'  {lbl:<10}' + ''.join(f'{v:>6,}' for v in cm[i])
        print(row)
    print()

    print(_bar(W))
    print('  요약')
    print(_bar(W))
    print(f'  Test Accuracy      : {r["test_accuracy"]:.4f}')
    print(f'  Test F1 (macro)    : {r["test_f1_macro"]:.4f}')
    print(f'  Test F1 (weighted) : {r["test_f1_weighted"]:.4f}')
    print()
    print(f'  리포트 파일 : {report_path}')
    print(_bar(W))
    print()


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    show(path)
