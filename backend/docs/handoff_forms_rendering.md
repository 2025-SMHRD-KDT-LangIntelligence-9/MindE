# 프론트 인계서 — 서식 렌더링 정렬 규칙

**작성일**: 2026-07-04
**대상**: 프론트엔드 담당자
**긴급도**: 발표 전 반영 권장

---

## 배경

`POST /forms/fill` 응답의 `fields` 값(예: `"V"`, `"홍길동"`)은 정확히 나오는데,
미리보기에 렌더링될 때 다음 문제들이 생기고 있음:

1. **체크박스 V가 필드마다 크기·위치가 다르게 보임** — 팀 좌표 좌하단 기준이라 V가 `[ ]` 왼쪽으로 치우침
2. **폰트 크기가 필드마다 제각각** — metadata의 `size` 값이 필드별로 달라서
3. **좌표 미세 오차가 그대로 반영** — 팀 픽커가 완벽하지 않으니 필드 따라 1~2mm 어긋남

**원인**: 프론트가 metadata의 `position`/`size`/`align`을 필드별로 100% 그대로 반영하는 구조.
필드별 데이터가 완벽해야만 시각도 완벽함.

**해결 방향**: 프론트 렌더 로직에 **필드 성격별 통일 규칙**을 넣어 metadata 미세 오차를 흡수.

---

## 요청 사항

### 1. 체크박스 값 "V" 렌더 규칙 통일

**조건**: `value === "V"` 이고 필드가 체크박스 성격 (name에 `[]`, `□`, `[ ]` 포함)

**적용**:
```javascript
if (value === "V" && isCheckboxField(field)) {
  x = field.position[0] + 1;      // +1mm 오른쪽
  y = field.position[1] + 0.5;    // +0.5mm 위
  fontSize = 11;                  // metadata size 무시하고 통일
  align = "left";                 // metadata align 무시
  font = "sans-serif bold";       // V만큼은 살짝 굵게
}

function isCheckboxField(field) {
  const name = field.name || "";
  return name.includes("□") || name.includes("[]") || name.includes("[ ]");
}
```

**효과**:
- 모든 서식의 모든 체크박스 V가 같은 크기·같은 오프셋으로 그려짐
- `[ ]` 박스 안에 예쁘게 들어감

---

### 2. 일반 텍스트 필드 렌더 규칙

**조건**: `value !== "V"` 이고 값이 있음

**적용**:
```javascript
if (value && value !== "V") {
  x = field.position[0];
  y = field.position[1];
  fontSize = field.size || 9;                  // metadata 존중 (기본 9pt)
  align = field.align || "left";               // metadata 존중
  font = mapFont(field.font);                  // 한글 폰트 embed 필요
}

function mapFont(metaFont) {
  // 팀 metadata의 "DEFAULT_LIGHT" 등을 실제 embed된 폰트로 매핑
  return "NotoSansKR-Regular";  // 예시
}
```

**주의**: `align === "right"` 필드(년/월/일 같은 라벨 앞 값)는 반드시 우측 정렬 적용.
좌표점이 텍스트 오른쪽 끝임.

---

### 3. 렌더 파이프라인 최종 형태

```javascript
function renderForm(template, fillResult) {
  const metadata = template.field_mappings;  // [[page 0 fields], [page 1], ...]

  metadata.forEach((pageFields, pageIdx) => {
    pageFields.forEach(field => {
      const value = fillResult.fields[field.name];
      if (!value) return;   // 빈 값은 그리지 않음

      // type이 image면 별도 처리 (서명란 등)
      if (field.type === "image") {
        return;   // 지금은 스킵 (도장·서명 별도 UI로)
      }

      let x = field.position[0];
      let y = field.position[1];
      let fontSize;
      let align;

      // 체크박스 처리 (규칙 통일)
      if (value === "V" && isCheckboxField(field)) {
        x += 1;
        y += 0.5;
        fontSize = 11;
        align = "left";
      }
      // 일반 텍스트 처리 (metadata 존중)
      else {
        fontSize = field.size || 9;
        align = field.align || "left";
      }

      renderTextAt(pageIdx, x, y, value, fontSize, align);
    });
  });
}
```

---

## 검증 시나리오

렌더 로직 반영 후 확인:

1. **여권발급신청서 (form_template_id=8)**
   - "일반 여권 10년짜리 신규로 발급받으려고 해요" 입력
   - **기대**: `[V]일반`, `[V]10년`, `[V]신규` — V가 각각 다른 위치 `[ ]` 박스 안에 예쁘게 정렬
   - **버그 케이스**: V가 박스 밖으로 튀어나오거나 크기 제각각

2. **취득세 신고서 (form_template_id=2)**
   - 시나리오 있는 대화 후 미리보기 확인
   - 배타 그룹의 V가 균일하게 그려지는지

3. **정보공개 청구서 (form_template_id=4)**
   - 짧은 텍스트 필드(성명, 주소) 정렬 확인
   - 청구 내용 같은 긴 서술문 자동 줄바꿈

---

## 백엔드 관점 참고 (변경 없음)

- `POST /forms/fill` 응답 스키마 그대로 유지
- LLM은 값만 뱉음 (`"V"` 또는 텍스트)
- 좌표·정렬 로직은 100% 프론트 담당

---

## 그 외 참고

- **좌표는 mm 단위**입니다 (팀 픽커 기준). pt로 변환 필요하면 `× 2.8346`
- **PDF pt 좌표계는 좌하단 원점**, mm 좌표는 상단 기준일 수도 있으니 실측 확인 필요
- 렌더 시 PDF 페이지 크기 (A4 = 595 × 842 pt)로 정규화
