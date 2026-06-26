import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';

const steps = [
  { key: 'upload',  label: '업로드', icon: 'upload_file' },
  { key: 'ocr',     label: '인식',   icon: 'document_scanner' },
  { key: 'confirm', label: '확인',   icon: 'fact_check' },
  { key: 'done',    label: '완료',   icon: 'task_alt' },
];

const ocrFields = [
  { section: '신청인 정보', icon: 'person', fields: [
    { label: '성명',         value: '홍길동',                    key: 'name' },
    { label: '주민등록번호', value: '900101-1******',             key: 'rrn' },
    { label: '연락처',       value: '010-1234-5678',             key: 'phone' },
  ]},
  { section: '민원 종류', icon: 'category', fields: [
    { label: '민원 유형',  value: '교통사고 사실 확인',           key: 'type' },
    { label: '발생 일시',  value: '2024-05-20 14:30',            key: 'date' },
  ]},
  { section: '발생 내용', icon: 'description', fields: [
    { label: '사고 장소',  value: '서울특별시 강남구 테헤란로 1길 12', key: 'location' },
    { label: '사고 개요',  value: '직진 중 신호위반 차량과 충돌',      key: 'summary' },
  ]},
  { section: '주소 / 위치', icon: 'location_on', fields: [
    { label: '주소', value: '서울특별시 강남구 테헤란로 1길 12', key: 'address' },
  ]},
  { section: '첨부 정보', icon: 'attach_file', fields: [
    { label: '문서명',   value: '교통사고_사실확인서.jpg', key: 'docname' },
    { label: '파일 크기', value: '1.2 MB',               key: 'size' },
  ]},
];

const sideSteps = [
  { num: 1, label: '문서 업로드',        sub: '문서 또는 이미지 업로드' },
  { num: 2, label: 'OCR 인식 및 자동 입력', sub: '정보 추출 및 자동 입력' },
  { num: 3, label: '내용 확인 및 수정',   sub: '자동 입력 내용 검토' },
  { num: 4, label: 'PDF 생성 및 접수 연계', sub: '서류 생성 및 접수하기' },
];

function DocumentOCR() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1-indexed
  const [editingKey, setEditingKey] = useState(null);
  const [fieldValues, setFieldValues] = useState(() => {
    const init = {};
    ocrFields.forEach((s) => s.fields.forEach((f) => { init[f.key] = f.value; }));
    return init;
  });
  const [activeTab, setActiveTab] = useState('ocr');

  return (
    <CitizenLayout pageTitle="민원 서류 작성" activeMenu="document">
      <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 8rem)' }}>

        {/* ── 왼쪽 사이드 ── */}
        <aside className="w-56 shrink-0 flex flex-col gap-4">

          {/* 홈으로 */}
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            홈으로 돌아가기
          </button>

          {/* 단계 타이틀 */}
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">민원 서류 작성</p>

          {/* 스텝 목록 */}
          <div className="flex flex-col gap-1">
            {sideSteps.map((s) => {
              const done   = currentStep > s.num;
              const active = currentStep === s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                    active ? 'bg-primary/10' : done ? 'hover:bg-surface-container-low' : 'hover:bg-surface-container-low opacity-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                    done   ? 'bg-primary text-white' :
                    active ? 'bg-primary text-white' :
                    'bg-surface-container border border-outline-variant text-on-surface-variant'
                  }`}>
                    {done ? <span className="material-symbols-outlined text-sm">check</span> : s.num}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${active ? 'text-primary' : done ? 'text-on-surface' : 'text-on-surface-variant'}`}>{s.label}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{s.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* OCR 도움말 */}
          <div className="mt-auto bg-primary/5 rounded-2xl border border-primary/15 p-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-white">smart_toy</span>
            </div>
            <h4 className="text-sm font-bold text-primary mb-1">OCR 문서화 도움말</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
              문서 이미지의 내용을 인식하여 민원 서식에 자동으로 입력해 드립니다.
            </p>
            <ul className="space-y-1.5 mb-3">
              {['다양한 문서 형식 지원 (PDF, JPG, PNG 등)', '글자 인식 및 정보 구조화', '민원 서식 자동 매핑 및 입력 보조'].map((t) => (
                <li key={t} className="text-xs text-on-surface-variant flex gap-1.5 items-start">
                  <span className="text-primary mt-0.5 shrink-0">•</span>{t}
                </li>
              ))}
            </ul>
            <button className="flex items-center gap-1 text-xs text-primary font-bold hover:underline">
              이용 가이드 보기
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* 상단 헤더 */}
          <div className="bg-white rounded-2xl border border-outline-variant px-6 py-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary">document_scanner</span>
                  <h2 className="text-lg font-bold text-on-surface">OCR 문서화 / 민원 서류 작성 지원</h2>
                </div>
                <p className="text-sm text-on-surface-variant">문서나 이미지를 인식하여 필요한 정보를 추출하고, 민원 서식에 자동으로 입력해 드립니다.</p>
              </div>

              {/* 상단 스텝 인디케이터 */}
              <div className="flex items-center gap-0 shrink-0">
                {steps.map((s, i) => {
                  const stepNum = i + 1;
                  const done    = currentStep > stepNum;
                  const active  = currentStep === stepNum;
                  return (
                    <div key={s.key} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          done   ? 'bg-primary' :
                          active ? 'bg-primary ring-4 ring-primary/20' :
                          'bg-surface-container border border-outline-variant'
                        }`}>
                          {done
                            ? <span className="material-symbols-outlined text-white text-base">check</span>
                            : <span className={`material-symbols-outlined text-base ${active ? 'text-white' : 'text-on-surface-variant'}`}>{s.icon}</span>
                          }
                        </div>
                        <span className={`text-[10px] font-bold ${active ? 'text-primary' : done ? 'text-on-surface-variant' : 'text-on-surface-variant/50'}`}>{s.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`w-12 h-0.5 mb-4 mx-1 ${done ? 'bg-primary' : 'bg-outline-variant'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 1: 업로드 */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm flex flex-col items-center justify-center gap-6" style={{ minHeight: '400px' }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-4xl">upload_file</span>
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-on-surface mb-1">문서 또는 이미지를 업로드하세요</h3>
                <p className="text-sm text-on-surface-variant">PDF, JPG, PNG 형식을 지원합니다 · 최대 10MB</p>
              </div>
              <div className="w-full max-w-md border-2 border-dashed border-primary/30 rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/3 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-primary/50 text-5xl">cloud_upload</span>
                <p className="text-sm text-on-surface-variant">파일을 드래그하거나 클릭하여 선택</p>
                <button className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:brightness-95 transition-all">
                  파일 선택
                </button>
              </div>
              <p className="text-xs text-on-surface-variant">* 인식 품질이 낮은 경우, 문서가 흐릿할 수 있습니다. 재촬영 또는 선명한 이미지 사용을 권장합니다.</p>
            </div>
          )}

          {/* Step 2: OCR 결과 */}
          {currentStep === 2 && (
            <div className="grid grid-cols-12 gap-4 flex-1">
              {/* 문서 미리보기 */}
              <div className="col-span-5 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant shrink-0">
                  <p className="text-sm font-bold text-on-surface">업로드한 문서 미리보기</p>
                  <button className="flex items-center gap-1.5 text-xs text-primary font-bold border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    다른 파일 업로드
                  </button>
                </div>
                <div className="px-5 py-2.5 border-b border-outline-variant/50 shrink-0">
                  <p className="text-xs text-on-surface-variant">교통사고_사실확인서.jpg</p>
                </div>

                {/* 문서 이미지 영역 */}
                <div className="flex-1 bg-surface-container-low/40 flex items-center justify-center p-4 overflow-hidden">
                  <div className="bg-white border border-outline-variant rounded-lg shadow-md w-full max-w-xs aspect-[3/4] flex flex-col items-center justify-center gap-3 p-6">
                    <span className="material-symbols-outlined text-on-surface-variant/30 text-6xl">description</span>
                    <div className="space-y-1.5 w-full">
                      {[80,65,90,55,70,60,75,50].map((w, i) => (
                        <div key={i} className="h-2 bg-surface-container rounded-full" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                    <p className="text-xs text-on-surface-variant text-center mt-2">교통사고 사실확인서</p>
                    <div className="w-16 h-16 border-2 border-outline-variant rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant/30">qr_code_2</span>
                    </div>
                  </div>
                </div>

                {/* 줌 컨트롤 */}
                <div className="px-5 py-3 border-t border-outline-variant/50 flex items-center justify-center gap-4 shrink-0">
                  <button className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-base text-on-surface-variant">zoom_out</span>
                  </button>
                  <span className="text-xs text-on-surface-variant font-medium">100%</span>
                  <button className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-base text-on-surface-variant">zoom_in</span>
                  </button>
                  <button className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors ml-2">
                    <span className="material-symbols-outlined text-base text-on-surface-variant">fullscreen</span>
                  </button>
                </div>

                {/* 썸네일 스트립 */}
                <div className="px-5 py-3 border-t border-outline-variant/50 flex items-center gap-2 overflow-x-auto shrink-0">
                  {[1,2,3,4,5,6].map((n) => (
                    <div key={n} className={`w-12 h-14 rounded border-2 shrink-0 flex items-center justify-center cursor-pointer ${n === 4 ? 'border-primary' : 'border-outline-variant'} bg-surface-container-low`}>
                      <span className="text-[10px] font-bold text-on-surface-variant">{n}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-on-surface-variant shrink-0 ml-1">4/6</p>
                </div>
              </div>

              {/* OCR 결과 */}
              <div className="col-span-7 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
                {/* 탭 + 재추출 */}
                <div className="flex items-center justify-between px-5 border-b border-outline-variant shrink-0">
                  <div className="flex">
                    {[{ key: 'ocr', label: 'OCR 추출 결과' }, { key: 'preview', label: '자동 입력 미리보기' }].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`py-3.5 px-4 text-sm font-bold border-b-2 transition-colors ${
                          activeTab === t.key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline shrink-0">
                    <span className="material-symbols-outlined text-base">refresh</span>
                    재추출
                  </button>
                </div>

                {/* 인식 완료 배너 */}
                <div className="mx-5 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                  <p className="text-xs font-bold text-emerald-700">문서에서 18개의 항목을 인식했습니다.</p>
                </div>

                {/* 필드 목록 */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {ocrFields.map((section) => (
                    <div key={section.section}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="material-symbols-outlined text-primary text-base">{section.icon}</span>
                        <h4 className="text-xs font-bold text-primary">{section.section}</h4>
                      </div>
                      <div className="space-y-1">
                        {section.fields.map((f) => (
                          <div key={f.key} className="grid grid-cols-12 items-center gap-2 py-2 px-3 rounded-xl hover:bg-surface-container-low/60 transition-colors">
                            <span className="col-span-3 text-xs text-on-surface-variant">{f.label}</span>
                            <span className="col-span-4 text-xs text-on-surface-variant/60 truncate">{f.value}</span>
                            <div className="col-span-5 flex items-center gap-1">
                              {editingKey === f.key ? (
                                <input
                                  autoFocus
                                  value={fieldValues[f.key]}
                                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                  onBlur={() => setEditingKey(null)}
                                  className="flex-1 text-xs border border-primary rounded-lg px-2 py-1 outline-none"
                                />
                              ) : (
                                <span className="flex-1 text-xs text-on-surface font-medium truncate">{fieldValues[f.key]}</span>
                              )}
                              <button
                                onClick={() => setEditingKey(editingKey === f.key ? null : f.key)}
                                className="w-6 h-6 rounded-lg hover:bg-primary/10 flex items-center justify-center shrink-0"
                              >
                                <span className="material-symbols-outlined text-primary text-sm">edit</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-on-surface-variant/70 pb-2">
                    * 위 결과는 OCR(광학 문자 인식) 기술을 기반으로 자동 추출된 내용입니다. 정확도가 낮은 항목은 직접 수정하실 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 확인 */}
          {currentStep === 3 && (
            <div className="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm">
              <h3 className="font-bold text-base text-on-surface mb-6">입력 내용을 최종 확인해 주세요</h3>
              <div className="grid grid-cols-2 gap-4">
                {ocrFields.map((section) => (
                  <div key={section.section} className="col-span-1 bg-surface-container-low/50 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="material-symbols-outlined text-primary text-base">{section.icon}</span>
                      <h4 className="text-xs font-bold text-primary">{section.section}</h4>
                    </div>
                    <div className="space-y-2">
                      {section.fields.map((f) => (
                        <div key={f.key} className="flex justify-between gap-3">
                          <span className="text-xs text-on-surface-variant shrink-0">{f.label}</span>
                          <span className="text-xs font-medium text-on-surface text-right">{fieldValues[f.key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: 완료 */}
          {currentStep === 4 && (
            <div className="bg-white rounded-2xl border border-outline-variant p-10 shadow-sm flex flex-col items-center justify-center gap-6" style={{ minHeight: '360px' }}>
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500 text-4xl">task_alt</span>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-on-surface mb-2">서류 작성이 완료되었습니다!</h3>
                <p className="text-sm text-on-surface-variant">PDF를 생성하거나 바로 민원을 접수할 수 있습니다.</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 border border-outline-variant px-6 py-3 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  PDF 생성
                </button>
                <button
                  onClick={() => navigate('/my-complaints')}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">edit_document</span>
                  민원 접수하기
                </button>
              </div>
            </div>
          )}

          {/* 하단 네비게이션 버튼 */}
          <div className="bg-white rounded-2xl border border-outline-variant px-6 py-4 shadow-sm flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              이전 단계
            </button>

            <div className="flex gap-2">
              {currentStep === 2 && (
                <>
                  <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-base">save</span>
                    저장
                  </button>
                  <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    PDF 생성
                  </button>
                </>
              )}
              <button
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                disabled={currentStep === 4}
                className="flex items-center gap-1.5 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-sm disabled:opacity-40"
              >
                {currentStep === 3 ? (
                  <><span className="material-symbols-outlined text-base">link</span>접수 연계</>
                ) : (
                  <>다음 단계<span className="material-symbols-outlined text-base">arrow_forward</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}

export default DocumentOCR;
