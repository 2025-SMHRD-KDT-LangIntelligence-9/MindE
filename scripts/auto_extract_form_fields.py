"""PyMuPDF로 PDF에서 필드 좌표 자동 추출.

사용법:
    python scripts/auto_extract_form_fields.py [pdf_path]

기본: 취득세 서식으로 실행.
결과: {name, position(mm), size, align, source} 리스트를 JSON으로 출력.
"""
import fitz
import json
import sys
from pathlib import Path

# pt → mm (팀 표준과 호환 위해)
PT_MM = 25.4 / 72.0

# 필드 라벨로 볼 만한 텍스트 패턴 (한글 명사·형태소 위주)
# 값이 들어갈 것으로 예상되는 위치를 라벨 오른쪽으로 잡음.
LABEL_HINTS = [
    "성명", "주소", "전화번호", "주민등록번호", "생년월일", "관계",
    "취득자", "전 소유자", "매도인", "매수인", "신고인", "대리인", "위임자",
    "소재지", "취득", "취득세", "지방교육세", "농어촌특별세",
    "세율", "세액", "과세표준액", "산출세액", "감면세액", "기납부세액",
    "합계", "기타", "구분", "년", "월", "일", "취득가격", "취득일",
    "시가표준액", "시가인정액", "특수관계인",
    "면적", "층수", "종류", "용도",
    # 체크박스 옵션명
    "기한 내", "기한 후", "배우자", "직계존비속", "친족관계",
    "무상취득", "유상거래", "매매", "분양권",
    "여", "부", "포함", "제외", "해당", "해당 없음", "개인", "법인",
]


def extract_fields_from_pdf(pdf_path: str) -> list:
    """PDF에서 필드 위치 자동 추출.

    반환: [{"name": str, "position": [x_mm, y_mm], "size": float,
             "align": str, "source": "auto_pymupdf"}]
    좌표는 mm bottom-origin (팀 표준과 호환).
    """
    doc = fitz.open(pdf_path)
    fields_per_page = []
    for pi, page in enumerate(doc):
        page_height_pt = page.rect.height
        words = page.get_text("words")   # [(x0, y0, x1, y1, text, ...), ...]

        page_fields = []
        for w in words:
            text = w[4].strip()
            if not text:
                continue
            # 특수문자·괄호 제거 후 라벨 매칭
            clean = text.replace("(", "").replace(")", "").replace("]", "").replace("[", "").strip()
            matched = False
            for hint in LABEL_HINTS:
                if hint == clean or hint in clean:
                    matched = True
                    break
            if not matched:
                continue

            # bbox → 라벨 위치. 값 셀은 라벨 오른쪽 예상 (일단은 라벨 위치 그대로)
            # 실제 셀 위치 = 라벨 오른쪽 끝 + 여백. 팀 좌표와 매칭 위해 라벨 자체 위치 저장.
            x_pt = w[0]      # 라벨 왼쪽 끝
            y_pt = w[1]      # 라벨 상단 (pt top-origin)
            # pt top → mm bottom-origin (팀 좌표 표준과 호환)
            x_mm = x_pt * PT_MM
            y_mm = (page_height_pt - y_pt) * PT_MM

            # 폰트 크기 추정 (bbox 높이 = 폰트 크기)
            size = round((w[3] - w[1]), 1)

            page_fields.append({
                "name": text,
                "position": [round(x_mm, 2), round(y_mm, 2)],
                "size": size,
                "align": "left",
                "type": "text",
                "source": "auto_pymupdf",
            })
        fields_per_page.append(page_fields)
    doc.close()
    return fields_per_page


def main():
    pdf = (sys.argv[1] if len(sys.argv) > 1
           else r"C:\Users\smhrd\Desktop\실전 프로젝트\uploads\forms\acquisition_tax_report.pdf")
    if not Path(pdf).exists():
        print(f"파일 없음: {pdf}")
        sys.exit(1)

    fields = extract_fields_from_pdf(pdf)
    print(f"PDF: {pdf}")
    print(f"페이지 수: {len(fields)}, 페이지별 필드 수: {[len(p) for p in fields]}")
    print()

    # 페이지 0 결과 프린트
    print("=== 페이지 0 자동 감지 필드 (처음 20개) ===")
    for f in fields[0][:20]:
        print(f"  {f['name']!r:<20} @ ({f['position'][0]:.1f}, {f['position'][1]:.1f}) size={f['size']}")

    # JSON 파일로 저장
    out = Path(pdf).stem + "_auto.metadata.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fields, f, ensure_ascii=False, indent=2)
    print(f"\n저장: {out}")


if __name__ == "__main__":
    main()
