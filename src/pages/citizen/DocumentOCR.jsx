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
  const [centerPage, setCenterPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [fullscreenPage, setFullscreenPage] = useState(null);

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
                <div
                  key={s.num}
                  className={`flex items-start gap-3 p-3 rounded-xl text-left ${
                    active ? 'bg-primary/10' : done ? '' : 'opacity-50'
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
                </div>
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

          {/* Step 2: OCR 추출 결과 (읽기 전용) */}
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
                <div className="px-5 py-3 border-t border-outline-variant/50 flex items-center gap-2 overflow-x-auto shrink-0">
                  {[1,2,3,4,5,6].map((n) => (
                    <div key={n} className={`w-12 h-14 rounded border-2 shrink-0 flex items-center justify-center cursor-pointer ${n === 4 ? 'border-primary' : 'border-outline-variant'} bg-surface-container-low`}>
                      <span className="text-[10px] font-bold text-on-surface-variant">{n}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-on-surface-variant shrink-0 ml-1">4/6</p>
                </div>
              </div>

              {/* OCR 추출 결과 (읽기 전용) */}
              <div className="col-span-7 bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant shrink-0">
                  <p className="text-sm font-bold text-on-surface">OCR 추출 결과</p>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline shrink-0">
                    <span className="material-symbols-outlined text-base">refresh</span>
                    재추출
                  </button>
                </div>
                <div className="mx-5 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                  <p className="text-xs font-bold text-emerald-700">문서에서 18개의 항목을 인식했습니다.</p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {ocrFields.map((section) => (
                    <div key={section.section}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="material-symbols-outlined text-primary text-base">{section.icon}</span>
                        <h4 className="text-xs font-bold text-primary">{section.section}</h4>
                      </div>
                      <div className="space-y-1">
                        {section.fields.map((f) => (
                          <div key={f.key} className="flex items-center gap-2 py-2 px-3 rounded-xl bg-surface-container-low/40">
                            <span className="w-28 shrink-0 text-xs text-on-surface-variant">{f.label}</span>
                            <span className="flex-1 text-xs font-medium text-on-surface">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-on-surface-variant/70 pb-2">
                    * OCR(광학 문자 인식)으로 자동 추출된 결과입니다. 다음 단계에서 내용을 확인하고 수정할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 내용 확인 및 수정 */}
          {currentStep === 3 && (
            <div className="bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0">
                <p className="text-sm font-bold text-on-surface">내용 확인 및 수정</p>
                <p className="text-xs text-on-surface-variant">항목을 클릭하여 수정할 수 있습니다.</p>
              </div>
              <div className="overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-5">
                  {ocrFields.map((section) => (
                    <div key={section.section} className="bg-surface-container-low/50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="material-symbols-outlined text-primary text-base">{section.icon}</span>
                        <h4 className="text-xs font-bold text-primary">{section.section}</h4>
                      </div>
                      <div className="space-y-2">
                        {section.fields.map((f) => (
                          <div key={f.key} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-container transition-colors">
                            <span className="text-xs text-on-surface-variant shrink-0 w-24">{f.label}</span>
                            {editingKey === f.key ? (
                              <input
                                autoFocus
                                value={fieldValues[f.key]}
                                onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                onBlur={() => setEditingKey(null)}
                                className="flex-1 text-xs border border-primary rounded-lg px-2 py-1 outline-none"
                              />
                            ) : (
                              <span className="flex-1 text-xs font-medium text-on-surface text-right truncate">{fieldValues[f.key]}</span>
                            )}
                            <button
                              onClick={() => setEditingKey(editingKey === f.key ? null : f.key)}
                              className="w-6 h-6 rounded-lg hover:bg-primary/10 flex items-center justify-center shrink-0"
                            >
                              <span className="material-symbols-outlined text-primary text-sm">edit</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: PDF 생성 및 접수 연계 */}
          {currentStep === 4 && (
            <div className="bg-white rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden flex-1">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-lg">picture_as_pdf</span>
                  <p className="text-sm font-bold text-on-surface">PDF 미리보기</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg">교통사고_사실확인서_작성완료.pdf</span>
                  <span className="text-xs text-on-surface-variant">총 3페이지</span>
                </div>
              </div>

              {/* PDF 캐러셀 — 클릭/화살표로 이동 */}
              {(() => {
                const b = '1px solid #000';
                const th = (s, extra={}) => ({ border:b, background:'#f0f0f0', padding: s?'3px 6px':'2px 4px', fontWeight:700, textAlign:'center', fontSize:s?9:7, verticalAlign:'middle', whiteSpace:'nowrap', ...extra });
                const td = (s, extra={}) => ({ border:b, padding: s?'3px 6px':'2px 4px', fontSize:s?9:7, verticalAlign:'middle', ...extra });

                const pages = [
                  {
                    content: (s) => (
                      <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
                        {/* 최상단 안내 */}
                        <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>
                          □ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식]
                        </p>
                        {/* 제목 + 접수번호 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4 }}>
                          <tbody>
                            <tr>
                              <td style={{ border:b, padding: s?'6px 10px':'4px 6px', width:'65%' }}>
                                <p style={{ fontSize:s?18:13, fontWeight:900, letterSpacing:'2px', textAlign:'center', margin:0 }}>교통사고사실확인원</p>
                              </td>
                              <td style={{ border:b, padding: s?'4px 6px':'2px 4px', verticalAlign:'top' }}>
                                <p style={{ fontSize:s?7:5, fontWeight:700, marginBottom:s?10:6 }}>교통사고</p>
                                <p style={{ fontSize:s?7:5, fontWeight:700 }}>접수번호</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 신청인 기본정보 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4, fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td style={th(s,{width:'12%'})}>명</td>
                              <td style={td(s,{width:'38%'})}>{fieldValues.name}</td>
                              <td style={th(s,{width:'20%'})}>주민등록번호</td>
                              <td style={td(s)}>{fieldValues.rrn}</td>
                            </tr>
                            <tr>
                              <td style={th(s)}>주&nbsp;&nbsp;소</td>
                              <td colSpan={2} style={td(s)}>{fieldValues.address}</td>
                              <td style={th(s, {fontSize:s?7:5})}>[교통사고란]</td>
                            </tr>
                            <tr>
                              <td style={th(s)}>운전면허</td>
                              <td style={td(s)}><span style={{marginRight:s?8:4}}>종별</span><span style={{borderBottom:'1px solid #000', display:'inline-block', width:s?30:20}}></span></td>
                              <td style={td(s)}><span style={{marginRight:s?8:4}}>번호</span><span style={{borderBottom:'1px solid #000', display:'inline-block', width:s?30:20}}></span></td>
                              <td style={td(s,{fontSize:s?7:5, color:'#555'})}>(소유자)</td>
                            </tr>
                            <tr>
                              <td style={th(s)}>사고차량</td>
                              <td style={td(s)}><span style={{marginRight:s?8:4}}>종별</span><span style={{borderBottom:'1px solid #000', display:'inline-block', width:s?30:20}}></span></td>
                              <td style={td(s)}>번호&nbsp;{fieldValues.docname?.split('_')[0] ?? '12가3456'}</td>
                              <td style={td(s,{fontSize:s?7:5, color:'#555'})}>(소유자)</td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 사고 상세 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:s?9:7 }}>
                          <tbody>
                            {[
                              ['발생일시', fieldValues.date],
                              ['발생장소', fieldValues.location],
                              ['사고유형', fieldValues.type],
                              ['사고원인', '신호위반 차량 직진 중 측면 충돌'],
                              ['피해내용', '차량 전면부 파손 / 탑승자 경상 2주'],
                            ].map(([label, val]) => (
                              <tr key={label}>
                                <td style={th(s,{width:'18%'})}>{label}</td>
                                <td style={td(s)}>{val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ),
                  },
                  {
                    content: (s) => (
                      <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
                        <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>
                          □ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식] — 사고개요
                        </p>
                        {/* 사고개요 큰 박스 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4, fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td rowSpan={2} style={th(s,{width:'14%', fontSize:s?10:8, letterSpacing:'1px'})}>사<br/>고<br/>개<br/>요</td>
                              <td style={th(s)}>사고일시</td>
                              <td style={td(s,{width:'60%'})}>{fieldValues.date}</td>
                            </tr>
                            <tr>
                              <td style={th(s)}>발생장소</td>
                              <td style={td(s)}>{fieldValues.location}</td>
                            </tr>
                            <tr>
                              <td style={th(s,{fontSize:s?10:8})}></td>
                              <td colSpan={2} style={{ border:b, height:s?70:45, padding:s?'4px 6px':'2px 4px', verticalAlign:'top', fontSize:s?9:7 }}>
                                <p style={{margin:0, lineHeight:1.7}}>
                                  {fieldValues.summary}<br/>
                                  차량은 서울 12가 3456호 승용차이며, 신호 대기 중<br/>
                                  후방 차량의 추돌로 전면부 파손 및 탑승자 경상 발생.
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 사고 내용 (큰 텍스트박스) */}
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4, fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td style={th(s,{width:'14%', fontSize:s?10:8})}>사<br/>고<br/>내<br/>용</td>
                              <td style={{ border:b, height:s?80:55, padding:s?'4px 6px':'2px 4px', verticalAlign:'top', fontSize:s?9:7 }}>
                                <p style={{ margin:0, lineHeight:1.7 }}>
                                  2024년 5월 20일 오후 2시 30분경, 서울특별시 강남구<br/>
                                  테헤란로 1길 12 교차로에서 직진 신호에 따라 진행 중<br/>
                                  신호위반 차량과 충돌하여 사고가 발생하였음.<br/>
                                  현장 출동 경찰관에 의해 사실 확인 후 접수 처리됨.
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 용도 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td style={th(s,{width:'14%'})}>용&nbsp;&nbsp;&nbsp;도</td>
                              <td style={td(s)}>보험회사 제출용</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ),
                  },
                  {
                    content: (s) => (
                      <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
                        <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>
                          □ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식] — 확인 및 서명
                        </p>
                        {/* 보당자 */}
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4, fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td style={th(s,{width:'14%'})}>보&nbsp;당&nbsp;자</td>
                              <td style={td(s,{height:s?32:22})}></td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 확인 문구 */}
                        <div style={{ border:b, padding:s?'8px 10px':'5px 6px', marginBottom:s?10:7, fontSize:s?9:7, lineHeight:1.8 }}>
                          위와 같이 교통사고를 확인한 사실이 있음을 확인합니다.
                        </div>
                        {/* 날짜 + 서명 */}
                        <div style={{ fontSize:s?9:7, marginBottom:s?10:7, textAlign:'right' }}>
                          2024년 &nbsp; 05월 &nbsp; 20일
                        </div>
                        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?10:7, fontSize:s?9:7 }}>
                          <tbody>
                            <tr>
                              <td style={th(s,{width:'20%'})}>신 청 인</td>
                              <td style={td(s)}>{fieldValues.name}</td>
                              <td style={{ border:b, width:s?50:34, height:s?50:34, textAlign:'center', fontSize:s?7:5, color:'#aaa', verticalAlign:'middle' }}>서명<br/>날인</td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 경찰서장 / 접수인 */}
                        <div style={{ display:'flex', justifyContent:'flex-end', gap:s?16:10, marginTop:s?8:5 }}>
                          <div style={{ textAlign:'center' }}>
                            <p style={{ fontSize:s?8:6, marginBottom:s?4:3 }}>서울강남경찰서장</p>
                            <div style={{ width:s?54:38, height:s?54:38, border:'2px solid #c00', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                              <p style={{ fontSize:s?7:5, color:'#c00', fontWeight:700, textAlign:'center', lineHeight:1.4, margin:0 }}>강남서<br/>직인</p>
                            </div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <p style={{ fontSize:s?8:6, marginBottom:s?4:3 }}>접 수 인</p>
                            <div style={{ width:s?54:38, height:s?54:38, border:'2px solid #c00', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                              <p style={{ fontSize:s?7:5, color:'#c00', fontWeight:700, textAlign:'center', lineHeight:1.4, margin:0 }}>접수<br/>확인</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ];

                const total = pages.length;
                const prev = (centerPage - 1 + total) % total;
                const next = (centerPage + 1) % total;

                const pageOrder = [prev, centerPage, next];

                return (
                  <div className="flex-1 bg-slate-100 flex items-center justify-center gap-5 px-6 py-6 overflow-hidden relative">

                    {/* 왼쪽 화살표 */}
                    <button
                      onClick={() => setCenterPage(prev)}
                      className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white hover:border-primary transition-all z-20"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>

                    {pageOrder.map((pageIdx, slotIdx) => {
                      const isCenter = slotIdx === 1;
                      const page = pages[pageIdx];
                      return (
                        <div
                          key={pageIdx}
                          onClick={() => !isCenter && setCenterPage(pageIdx)}
                          style={{
                            transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                            width: isCenter ? '320px' : '200px',
                            opacity: isCenter ? 1 : 0.55,
                            transform: isCenter ? 'scale(1)' : 'scale(0.93)',
                            cursor: isCenter ? 'default' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <p
                            className="text-center mb-2 font-bold"
                            style={{ fontSize: isCenter ? '12px' : '10px', color: isCenter ? '#64748b' : '#94a3b8' }}
                          >
                            {pageIdx + 1} / {total}
                          </p>
                          <div
                            className="bg-white rounded border border-slate-200"
                            style={{
                              padding: isCenter ? '24px' : '14px',
                              boxShadow: isCenter ? '0 20px 40px -8px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.08)',
                              transform: isCenter ? `scale(${zoom / 100})` : 'none',
                              transformOrigin: 'top center',
                            }}
                          >
                            {page.content(isCenter)}
                          </div>
                        </div>
                      );
                    })}

                    {/* 오른쪽 화살표 */}
                    <button
                      onClick={() => setCenterPage(next)}
                      className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white hover:border-primary transition-all z-20"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>

                    {/* 페이지 닷 인디케이터 */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {pages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCenterPage(i)}
                          style={{
                            width: i === centerPage ? '20px' : '6px',
                            height: '6px',
                            borderRadius: '3px',
                            background: i === centerPage ? '#3b82f6' : '#cbd5e1',
                            transition: 'all 0.3s ease',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>

                  </div>
                );
              })()}

              {/* 줌 컨트롤 */}
              <div className="px-5 py-3 border-t border-outline-variant/50 flex items-center justify-center gap-4 shrink-0">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors disabled:opacity-30"
                  disabled={zoom <= 50}
                >
                  <span className="material-symbols-outlined text-base text-on-surface-variant">zoom_out</span>
                </button>
                <span className="text-xs text-on-surface-variant font-medium w-10 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors disabled:opacity-30"
                  disabled={zoom >= 200}
                >
                  <span className="material-symbols-outlined text-base text-on-surface-variant">zoom_in</span>
                </button>
                <button
                  onClick={() => setFullscreenPage(centerPage)}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors ml-2"
                >
                  <span className="material-symbols-outlined text-base text-on-surface-variant">fullscreen</span>
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
              {currentStep === 4 ? (
                <>
                  <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-base text-red-500">picture_as_pdf</span>
                    PDF 생성
                  </button>
                  <button
                    onClick={() => navigate('/my-complaints')}
                    className="flex items-center gap-1.5 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    민원 접수
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                  className="flex items-center gap-1.5 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-sm"
                >
                  다음 단계<span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 전체보기 모달 */}
      {fullscreenPage !== null && (() => {
        const b = '1px solid #000';
        const th = (s, extra={}) => ({ border:b, background:'#f0f0f0', padding: s?'3px 6px':'2px 4px', fontWeight:700, textAlign:'center', fontSize:s?9:7, verticalAlign:'middle', whiteSpace:'nowrap', ...extra });
        const td = (s, extra={}) => ({ border:b, padding: s?'3px 6px':'2px 4px', fontSize:s?9:7, verticalAlign:'middle', ...extra });
        const pages = [
          { content: (s) => (
            <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
              <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>□ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식]</p>
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:s?6:4 }}><tbody><tr>
                <td style={{ border:b, padding: s?'6px 10px':'4px 6px', width:'65%' }}><p style={{ fontSize:s?18:13, fontWeight:900, letterSpacing:'2px', textAlign:'center', margin:0 }}>교통사고사실확인원</p></td>
                <td style={{ border:b, padding: s?'4px 6px':'2px 4px', verticalAlign:'top' }}><p style={{ fontSize:s?7:5, fontWeight:700, marginBottom:s?10:6 }}>교통사고</p><p style={{ fontSize:s?7:5, fontWeight:700 }}>접수번호</p></td>
              </tr></tbody></table>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:s?9:7 }}><tbody>
                <tr><td style={th(s,{width:'12%'})}>명</td><td style={td(s,{width:'38%'})}>{fieldValues.name}</td><td style={th(s,{width:'20%'})}>주민등록번호</td><td style={td(s)}>{fieldValues.rrn}</td></tr>
                <tr><td style={th(s)}>발생일시</td><td colSpan={3} style={td(s)}>{fieldValues.date}</td></tr>
                <tr><td style={th(s)}>발생장소</td><td colSpan={3} style={td(s)}>{fieldValues.location}</td></tr>
                <tr><td style={th(s)}>사고개요</td><td colSpan={3} style={td(s)}>{fieldValues.summary}</td></tr>
              </tbody></table>
            </div>
          )},
          { content: (s) => (
            <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
              <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>□ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식] — 사고개요</p>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:s?9:7 }}><tbody>
                <tr><td style={th(s,{width:'14%'})}>사고일시</td><td style={td(s)}>{fieldValues.date}</td></tr>
                <tr><td style={th(s)}>발생장소</td><td style={td(s)}>{fieldValues.location}</td></tr>
                <tr><td style={th(s)}>사고내용</td><td style={{ border:b, height:s?80:55, padding:s?'4px 6px':'2px 4px', verticalAlign:'top', fontSize:s?9:7 }}><p style={{ margin:0, lineHeight:1.7 }}>{fieldValues.summary}</p></td></tr>
              </tbody></table>
            </div>
          )},
          { content: (s) => (
            <div style={{ fontFamily:"'Malgun Gothic','Noto Sans KR',sans-serif", color:'#000' }}>
              <p style={{ fontSize:s?7:5, color:'#555', marginBottom:s?4:2, borderBottom:'1px solid #ccc', paddingBottom:s?3:2 }}>□ 서울교통법원 사용고지 &nbsp;[별지 제44호 서식] — 확인 및 서명</p>
              <div style={{ border:b, padding:s?'8px 10px':'5px 6px', marginBottom:s?10:7, fontSize:s?9:7, lineHeight:1.8 }}>위와 같이 교통사고를 확인한 사실이 있음을 확인합니다.</div>
              <div style={{ fontSize:s?9:7, marginBottom:s?10:7, textAlign:'right' }}>2024년 &nbsp; 05월 &nbsp; 20일</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:s?9:7 }}><tbody>
                <tr><td style={th(s,{width:'20%'})}>신 청 인</td><td style={td(s)}>{fieldValues.name}</td><td style={{ border:b, width:s?50:34, height:s?50:34, textAlign:'center', fontSize:s?7:5, color:'#aaa', verticalAlign:'middle' }}>서명<br/>날인</td></tr>
              </tbody></table>
            </div>
          )},
        ];
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center" onClick={() => setFullscreenPage(null)}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: '600px', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant shrink-0">
                <p className="text-sm font-bold text-on-surface">페이지 {fullscreenPage + 1} / {pages.length}</p>
                <button onClick={() => setFullscreenPage(null)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant">close</span>
                </button>
              </div>
              <div className="overflow-y-auto p-8">
                <div className="bg-white border border-slate-200 rounded p-8 shadow-md">
                  {pages[fullscreenPage]?.content(true)}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-outline-variant shrink-0">
                <button onClick={() => setFullscreenPage((p) => Math.max(0, p - 1))} disabled={fullscreenPage === 0} className="px-4 py-1.5 text-xs font-bold border border-outline-variant rounded-lg hover:bg-surface-container disabled:opacity-30 transition-colors">이전</button>
                {pages.map((_, i) => (
                  <button key={i} onClick={() => setFullscreenPage(i)} className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${i === fullscreenPage ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}>{i + 1}</button>
                ))}
                <button onClick={() => setFullscreenPage((p) => Math.min(pages.length - 1, p + 1))} disabled={fullscreenPage === pages.length - 1} className="px-4 py-1.5 text-xs font-bold border border-outline-variant rounded-lg hover:bg-surface-container disabled:opacity-30 transition-colors">다음</button>
              </div>
            </div>
          </div>
        );
      })()}
    </CitizenLayout>
  );
}

export default DocumentOCR;
