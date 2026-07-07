import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';

const FAQ_DATA = [
  {
    category: '민원 접수',
    icon: 'edit_note',
    color: 'bg-blue-50 text-blue-600',
    items: [
      {
        q: '민원 신청 후 처리 기간은 얼마나 걸리나요?',
        a: '일반적인 민원은 접수 후 영업일 기준 7일 이내에 처리가 완료됩니다. 긴급 민원의 경우 우선 처리되며, 복잡한 사안은 최대 14일까지 소요될 수 있습니다. 처리 기간이 초과될 경우 담당자가 별도로 연락드립니다.',
      },
      {
        q: '민원 접수 후 취소나 수정이 가능한가요?',
        a: '접수 상태인 경우에 한해 취소가 가능합니다. \'내 민원 내역\' 페이지에서 해당 민원을 선택한 후 취소 요청을 할 수 있습니다. 단, 이미 \'처리 중\' 상태로 변경된 경우에는 취소가 어려우며, 추가 상담을 통해 문의해 주세요.',
      },
      {
        q: '한 번에 여러 건의 민원을 접수할 수 있나요?',
        a: '네, 각각 별도의 민원으로 접수하시면 됩니다. 민원 유형이 다른 경우 담당 부서가 달라지므로 분리 접수를 권장합니다. AI 챗봇이 각 민원의 유형을 자동으로 분류해 드립니다.',
      },
      {
        q: '첨부파일은 어떤 형식까지 지원하나요?',
        a: 'JPG, PNG, PDF, DOC, DOCX, HWP 형식을 지원하며 파일당 최대 10MB까지 첨부 가능합니다. 사진의 경우 선명하게 촬영할수록 OCR 인식률이 높아집니다.',
      },
      {
        q: '민원 접수 시 꼭 회원가입을 해야 하나요?',
        a: '네, 민원 접수 및 처리 현황 조회를 위해서는 회원가입 후 로그인이 필요합니다. 회원가입은 이름·이메일·전화번호 등 기본 정보만으로 간단하게 완료할 수 있습니다.',
      },
      {
        q: '어떤 종류의 민원을 접수할 수 있나요?',
        a: '교통, 환경, 건축, 상하수도, 농축산, 보건위생, 행정 등 다양한 분야의 민원을 접수할 수 있습니다. AI 챗봇에게 불편 사항을 설명하시면 해당 민원의 유형과 담당 부서를 자동으로 안내해 드립니다.',
      },
      {
        q: '긴급 민원은 어떻게 신청하나요?',
        a: 'AI 챗봇 상담 시 민원 내용의 긴급도를 자동으로 분석합니다. 신체적 위험, 시설 파손, 즉각 조치가 필요한 경우 긴급 민원으로 분류되어 담당 부서에 우선 배정됩니다. 직접 신청 시에는 챗봇 상담 중 긴급 상황임을 명확히 기술해 주세요.',
      },
    ],
  },
  {
    category: 'AI 챗봇',
    icon: 'smart_toy',
    color: 'bg-purple-50 text-purple-600',
    items: [
      {
        q: 'AI 챗봇이 민원을 대신 작성해 주나요?',
        a: '네, 사용자의 설명을 바탕으로 AI가 행정 용어에 맞춰 내용을 정리해 드립니다. 어떤 불편이 있었는지 편하게 말씀해 주시면, AI가 민원 유형 분류부터 담당 부서 안내, 필요 서류 안내까지 도와드립니다.',
      },
      {
        q: 'AI 챗봇은 24시간 이용 가능한가요?',
        a: '네, AI 챗봇은 365일 24시간 운영됩니다. 다만 실제 민원 처리는 담당 부서의 업무 시간에 따라 진행되며, 야간·주말에 접수된 민원은 다음 영업일에 처리가 시작됩니다.',
      },
      {
        q: 'AI가 잘못 분류한 경우 어떻게 하나요?',
        a: '\'내 민원 내역\'에서 해당 민원을 선택한 후 추가 상담 버튼을 눌러 AI 챗봇에게 재분류를 요청하실 수 있습니다. 또는 담당자 배정 후 담당자에게 직접 부서 변경을 요청하실 수도 있습니다.',
      },
      {
        q: '챗봇 상담 중 사진을 첨부할 수 있나요?',
        a: '네, 채팅 입력창 옆 첨부 버튼을 통해 사진이나 파일을 업로드하실 수 있습니다. AI가 이미지를 분석하여 민원 내용을 더 정확하게 파악하고, 관련 내용을 자동으로 민원 초안에 반영합니다.',
      },
      {
        q: '음성으로 민원 내용을 입력할 수 있나요?',
        a: '네, 챗봇 화면의 마이크 버튼을 누르면 음성 인식(STT) 기능이 활성화됩니다. 말씀하신 내용이 텍스트로 변환되어 입력됩니다. Chrome 브라우저를 권장하며, 마이크 접근 권한 허용이 필요합니다.',
      },
      {
        q: '이전 상담 내역은 어디서 확인할 수 있나요?',
        a: 'AI 챗봇 화면 왼쪽 상단의 \'상담 내역\' 탭에서 과거 상담 목록을 확인하고 다시 열어볼 수 있습니다. 상담 내역은 서버에 자동 저장되며, 삭제 전까지 보관됩니다.',
      },
    ],
  },
  {
    category: '처리 현황',
    icon: 'track_changes',
    color: 'bg-amber-50 text-amber-600',
    items: [
      {
        q: '접수한 민원의 진행 상황은 어떻게 확인하나요?',
        a: '\'내 민원 내역\' 페이지에서 실시간 처리 상태를 확인하실 수 있습니다. 상태는 접수 → 검토 → 처리 → 완료 순으로 변경되며, 각 단계 변경 시 알림을 받으실 수 있습니다.',
      },
      {
        q: '처리가 너무 오래 걸리는 것 같습니다. 어떻게 해야 하나요?',
        a: '민원 접수 후 7영업일이 지나도 상태 변경이 없다면, 해당 민원 상세 페이지의 \'추가 상담\' 버튼을 통해 문의하시거나, 담당 부서에 직접 연락하실 수 있습니다. 담당 부서 연락처는 민원 상세 화면에서 확인 가능합니다.',
      },
      {
        q: '민원이 반려되었습니다. 이유는 무엇인가요?',
        a: '반려 사유는 민원 상세 페이지의 담당자 답변란에서 확인하실 수 있습니다. 주요 반려 사유로는 관할 부서 불일치, 서류 미비, 민원 내용 불명확 등이 있습니다. 반려 후에도 보완하여 재접수하실 수 있습니다.',
      },
      {
        q: '처리 완료 후 결과는 어떻게 통보받나요?',
        a: '민원 처리가 완료되면 앱 내 알림과 가입 시 등록한 이메일로 결과를 안내해 드립니다. \'내 민원 내역\' 상세 화면에서 담당 부서의 공식 답변 전문을 확인하실 수 있습니다.',
      },
      {
        q: '\'보완 요청\' 상태란 무엇인가요?',
        a: '담당자가 민원 처리를 위해 추가 서류나 보충 정보가 필요하다고 판단한 경우 \'보완 요청\' 상태로 변경됩니다. 해당 민원 상세 페이지에서 요청 내용을 확인하신 후 추가 상담 또는 서류 보완 제출 기능을 이용해 주세요.',
      },
      {
        q: '동일한 민원을 중복 접수하면 어떻게 되나요?',
        a: '동일한 내용의 민원을 중복 접수하더라도 시스템에서 자동으로 병합되지는 않습니다. 기존 민원의 처리 상황을 먼저 확인하신 후, 필요한 경우 추가 상담 기능을 이용해 보충 내용을 전달해 주세요.',
      },
    ],
  },
  {
    category: '계정 / 개인정보',
    icon: 'manage_accounts',
    color: 'bg-emerald-50 text-emerald-600',
    items: [
      {
        q: '비밀번호를 잊어버렸습니다. 어떻게 하나요?',
        a: '로그인 화면의 \'비밀번호 찾기\' 버튼을 클릭하여 가입 시 등록한 이름과 전화번호로 본인확인 후 재설정할 수 있습니다. 이메일이 오지 않는 경우 스팸 메일함을 확인해 주세요.',
      },
      {
        q: '개인정보는 안전하게 보호되나요?',
        a: '수집된 개인정보는 「개인정보 보호법」에 따라 암호화 처리되며, 민원 처리 목적 외에는 사용되지 않습니다. 민원 처리 완료 후 법령에서 정한 기간이 지나면 안전하게 파기됩니다.',
      },
      {
        q: '담당자 계정은 어떻게 신청하나요?',
        a: '회원가입 화면에서 \'담당자 회원가입\' 탭을 선택하여 소속 부서와 함께 신청하시면 됩니다. 신청 후 관리자 승인이 완료되면 로그인이 가능합니다. 승인까지는 영업일 기준 1~2일이 소요될 수 있습니다.',
      },
      {
        q: '가입한 이메일(아이디)을 잊어버렸습니다.',
        a: '로그인 화면의 \'아이디 찾기\' 버튼을 클릭하시면 가입 시 등록한 이름과 전화번호로 본인확인 후 이메일을 확인하실 수 있습니다.',
      },
      {
        q: '회원 탈퇴는 어떻게 하나요?',
        a: '로그인 후 상단 메뉴의 \'설정\' 페이지로 이동하시면 회원 탈퇴 기능을 이용할 수 있습니다. 탈퇴 시 처리 중인 민원이 있는 경우 처리 완료 후 탈퇴를 권장합니다. 탈퇴 후에는 개인정보가 즉시 삭제됩니다.',
      },
      {
        q: '프로필 정보(전화번호, 이름)를 변경하고 싶습니다.',
        a: '로그인 후 \'설정\' 메뉴에서 이름, 전화번호 등 기본 정보를 수정하실 수 있습니다. 이메일(아이디)은 본인 확인 수단으로 변경이 제한될 수 있습니다.',
      },
    ],
  },
  {
    category: 'OCR / 서류',
    icon: 'document_scanner',
    color: 'bg-rose-50 text-rose-600',
    items: [
      {
        q: 'OCR로 인식되지 않는 문서가 있나요?',
        a: '손글씨가 많거나 이미지 해상도가 낮은 경우 인식률이 저하될 수 있습니다. 선명하게 촬영한 JPG, PNG 또는 PDF 파일을 권장드립니다. 인식이 어려운 경우 수동으로 직접 입력하실 수 있습니다.',
      },
      {
        q: 'OCR로 추출된 내용이 잘못되었습니다.',
        a: '\'내용 확인 및 수정\' 단계(3단계)에서 각 항목을 클릭하여 직접 수정하실 수 있습니다. 수정 후 다음 단계로 진행하시면 수정된 내용이 반영된 서류가 생성됩니다.',
      },
      {
        q: '민원 서류 작성 시 AI가 자동으로 채워주는 내용은 무엇인가요?',
        a: 'AI 챗봇 상담 내용을 기반으로 민원 제목, 내용, 신청인 정보, 민원 유형 등을 자동으로 입력해 드립니다. 챗봇 상담 후 \'민원 서식 작성하기\' 버튼을 이용하면 상담 내용이 서식에 자동으로 연동됩니다.',
      },
      {
        q: '작성한 서류는 어떤 형식으로 저장되나요?',
        a: '작성 완료된 서류는 PDF 형식으로 다운로드하거나 민원 접수 시 자동으로 첨부됩니다. PDF 파일은 공식 민원 양식에 맞춰 생성되므로 별도 출력도 가능합니다.',
      },
      {
        q: '서식 종류는 어떤 것들이 있나요?',
        a: '도로·시설 민원신청서, 환경 민원신청서, 건축 관련 민원신청서 등 주요 행정 서식을 제공하고 있습니다. 서식 목록은 \'민원 서류 작성\' 화면에서 전체 확인 가능하며, 지속적으로 추가될 예정입니다.',
      },
    ],
  },
  {
    category: '알림 / 설정',
    icon: 'notifications',
    color: 'bg-cyan-50 text-cyan-600',
    items: [
      {
        q: '민원 상태 변경 알림은 어떻게 받나요?',
        a: '민원 상태가 변경되면 앱 내 알림 센터에 자동으로 알림이 추가됩니다. 상단 헤더의 알림 아이콘을 통해 확인하실 수 있으며, \'알림\' 메뉴에서 전체 내역을 조회할 수 있습니다.',
      },
      {
        q: '알림을 읽음 처리하고 싶습니다.',
        a: '알림 드롭다운 상단의 \'모두 읽음\' 버튼을 클릭하면 전체 알림이 읽음 처리됩니다. 개별 알림은 클릭하여 해당 민원 상세 페이지로 이동하면 자동으로 읽음 처리됩니다.',
      },
      {
        q: '앱 사용 중 오류가 발생하면 어떻게 하나요?',
        a: '화면 새로고침 후 다시 시도해 보세요. 로그인이 풀린 경우 다시 로그인하시면 됩니다. 지속적인 오류가 발생한다면 AI 챗봇을 통해 문의하시거나 담당 부서에 직접 연락해 주세요.',
      },
      {
        q: '모바일에서도 사용할 수 있나요?',
        a: '네, 마음이 서비스는 모바일 환경에 최적화된 반응형 화면을 제공합니다. 스마트폰 브라우저에서 접속하시면 모바일에 맞는 레이아웃으로 자동 전환되어 편리하게 이용하실 수 있습니다.',
      },
    ],
  },
];

const ALL_CATEGORIES = ['전체', ...FAQ_DATA.map((f) => f.category)];

export default function Faq() {
  const location = useLocation();
  const initCategory = location.state?.category ?? '전체';
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState(initCategory);
  const [openKey, setOpenKey]     = useState(null);

  const filtered = FAQ_DATA
    .filter((group) => category === '전체' || group.category === category)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.q.includes(search) || item.a.includes(search)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const totalCount = filtered.reduce((sum, g) => sum + g.items.length, 0);

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  return (
    <CitizenLayout pageTitle="자주 묻는 질문" activeMenu="faq">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">contact_support</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">자주 묻는 질문</h1>
          <p className="text-sm text-on-surface-variant">궁금한 내용을 검색하거나 카테고리를 선택해 보세요.</p>
        </div>

        {/* 검색창 */}
        <div className="relative mb-5">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenKey(null); }}
            placeholder="질문이나 키워드를 입력하세요"
            className="w-full h-13 pl-12 pr-10 rounded-2xl border-2 border-outline-variant focus:border-primary outline-none transition-all text-sm bg-white shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* 카테고리 탭 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setOpenKey(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
                category === cat
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 검색 결과 수 */}
        {search && (
          <p className="text-xs text-on-surface-variant mb-4 pl-1">
            <span className="font-bold text-primary">"{search}"</span> 검색 결과 {totalCount}건
          </p>
        )}

        {/* FAQ 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-30">search_off</span>
            <p className="text-sm font-bold">검색 결과가 없습니다.</p>
            <p className="text-xs">다른 키워드로 검색하거나 카테고리를 변경해 보세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((group) => (
              <div key={group.category}>
                {/* 카테고리 헤더 */}
                {category === '전체' && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${group.color}`}>
                      <span className="material-symbols-outlined text-sm">{group.icon}</span>
                      {group.category}
                    </span>
                    <div className="flex-1 h-px bg-outline-variant/50" />
                  </div>
                )}

                {/* 아코디언 목록 */}
                <div className="space-y-2">
                  {group.items.map((item, idx) => {
                    const key = `${group.category}-${idx}`;
                    const isOpen = openKey === key;
                    return (
                      <div
                        key={key}
                        className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                          isOpen ? 'border-primary shadow-sm shadow-primary/10' : 'border-outline-variant hover:border-primary/40'
                        }`}
                      >
                        {/* 질문 */}
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center gap-4 px-6 py-4 text-left"
                        >
                          <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-sm font-bold ${
                            isOpen ? 'bg-primary text-white' : 'bg-surface-container text-primary'
                          }`}>
                            Q
                          </span>
                          <span className={`flex-1 text-sm font-bold leading-snug ${isOpen ? 'text-primary' : 'text-on-surface'}`}>
                            {item.q}
                          </span>
                          <span className={`material-symbols-outlined text-xl shrink-0 transition-transform duration-200 ${
                            isOpen ? 'text-primary rotate-180' : 'text-on-surface-variant'
                          }`}>
                            expand_more
                          </span>
                        </button>

                        {/* 답변 */}
                        {isOpen && (
                          <div className="px-6 pb-5 flex gap-4">
                            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                              A
                            </span>
                            <p className="text-sm text-on-surface-variant leading-relaxed pt-0.5">{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 추가 문의 배너 */}
        <div className="mt-10 bg-gradient-to-r from-primary/8 to-blue-50/60 border border-primary/15 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">chat_bubble</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-on-surface text-sm mb-0.5">원하는 답변을 찾지 못하셨나요?</p>
            <p className="text-xs text-on-surface-variant">AI 챗봇에게 직접 질문하시면 더 빠르고 정확한 안내를 받으실 수 있습니다.</p>
          </div>
          <a
            href="/chatbot"
            className="shrink-0 flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            AI 상담하기
          </a>
        </div>

      </div>
    </CitizenLayout>
  );
}
