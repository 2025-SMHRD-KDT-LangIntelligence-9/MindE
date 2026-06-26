import CitizenLayout from '../../layouts/CitizenLayout';

// 자주 묻는 질문 화면 - 디자인만 옮긴 정적 화면 (검색/아코디언 접기는 다음 단계 기능)
function Faq() {
  const faqs = [
    { q: '민원 신청 후 처리 기간은 얼마나 걸리나요?', a: '일반적인 민원은 접수 후 영업일 기준 7일 이내에 처리가 완료됩니다.' },
    { q: 'AI 챗봇이 민원을 대신 작성해주나요?', a: '네, 사용자의 설명을 바탕으로 AI가 행정 용어에 맞춰 내용을 정리해 드립니다.' },
    { q: '접수한 민원의 진행 상황은 어떻게 확인하나요?', a: "'내 민원 내역' 페이지에서 실시간 상태를 확인하실 수 있습니다." },
  ];

  return (
    <CitizenLayout pageTitle="자주 묻는 질문" activeMenu="faq">
      <div className="max-w-3xl mx-auto">
        <div className="relative mb-8">
          <input
            placeholder="질문이나 키워드를 입력하세요"
            className="w-full h-14 pl-12 pr-4 rounded-xl border border-outline-variant"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">
            search
          </span>
        </div>

        <div className="space-y-4">
          {faqs.map((item) => (
            <div key={item.q} className="bg-white rounded-xl border border-outline-variant p-6">
              <div className="flex items-center gap-4 mb-3">
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container text-primary font-bold">
                  Q
                </span>
                <h3 className="font-bold text-on-surface">{item.q}</h3>
              </div>
              <div className="pl-12 flex gap-4">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-container text-secondary font-bold">
                  A
                </span>
                <p className="text-on-surface-variant text-sm pt-1">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CitizenLayout>
  );
}

export default Faq;
