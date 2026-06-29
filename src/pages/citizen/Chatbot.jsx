import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { CATEGORY_STYLE } from '../../store/AppContext';

const quickReplies = [
  { icon: 'description',         label: '필요 서류 안내' },
  { icon: 'route',               label: '신청 절차 안내' },
  { icon: 'search',              label: '유사 사례 보기' },
  { icon: 'chat_bubble_outline', label: '상담 종료' },
];

const similarCases = [
  { title: '도로 파손으로 인한 타이어 펑크 보수 문제', result: '보상 승인' },
  { title: '빗길 도로 파손으로 차량 하부 손상 보상',   result: '부분 보상' },
  { title: '맨홀 주변 도로 파손으로 인한 휠 손상',     result: '보상 불가' },
];

const statusConfig = {
  '상담 완료': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '처리 중':   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '민원 접수': { bg: 'bg-blue-50',    text: 'text-blue-600' },
};


const GREETING = {
  role: 'ai',
  time: '오전 10:24',
  text: '안녕하세요, **철수** 님! 👋\n불편하신 사항이나 건의하고 싶은 내용을 편하게 말씀해 주세요.\nAI가 24시간 안내해 드리는 마음이 민원 서비스입니다.',
};

// 상담 내역별 대화 내용
const historyList = [
  {
    id: 1, title: '도로 파손으로 인한 차량 보상 문의', category: '도로/교통',
    date: '2025.05.20', time: '오전 10:24', status: '상담 완료', messages: 6,
    preview: '도로에 생긴 큰 구멍 때문에 차량 훼손이 발생했어요...',
    conversation: [
      { role: 'ai',   time: '오전 10:24', text: '안녕하세요, 철수 님! 👋\n불편하신 사항이나 건의하고 싶은 내용을 편하게 말씀해 주세요.' },
      { role: 'user', time: '오전 10:24', text: '도로에 생긴 큰 구멍 때문에 차량 훼손이 발생했어요. 보상을 받을 수 있을까요?' },
      { role: 'ai',   time: '오전 10:25', text: '도로 파손으로 인한 차량 피해는 「국가배상법」에 따라 보상 신청이 가능합니다.\n\n✅ 보상 요건\n1. 도로 관리청의 관리 소홀로 사고가 발생한 것\n2. 사고와 피해 사이 인과관계가 입증될 것\n3. 피해 발생 사실이 확인될 것' },
      { role: 'user', time: '오전 10:26', text: '필요한 서류가 어떻게 되나요?' },
      { role: 'ai',   time: '오전 10:26', text: '보상 신청 시 필요한 서류입니다.\n\n📄 준비 서류\n• 사고 현장 사진 (파손 도로, 차량 피해 촬영)\n• 차량 수리 견적서 또는 영수증\n• 사고 경위서 (직접 작성)\n• 신분증 사본\n\n담당 부서: 서울시 도로관리과 ☎ 02-123-4567' },
      { role: 'user', time: '오전 10:28', text: '감사합니다. 민원 접수할게요.' },
      { role: 'ai',   time: '오전 10:28', text: '민원 접수를 도와드리겠습니다! 아래 버튼을 눌러 공식 접수를 진행하실 수 있습니다. 빠른 처리를 도와드리겠습니다. 😊' },
    ],
  },
  {
    id: 2, title: '공원 내 가로등 파손 수리 요청', category: '시설/환경',
    date: '2025.05.18', time: '오후 3:12', status: '처리 중', messages: 4,
    preview: '집 앞 공원 가로등이 2주째 꺼져 있습니다. 빨리 수리해 주세요.',
    conversation: [
      { role: 'ai',   time: '오후 3:12', text: '안녕하세요, 철수 님! 어떤 불편을 도와드릴까요?' },
      { role: 'user', time: '오후 3:12', text: '집 앞 공원 가로등이 2주째 꺼져 있습니다. 빨리 수리해 주세요.' },
      { role: 'ai',   time: '오후 3:13', text: '공원 가로등 파손 신고를 접수해 드리겠습니다.\n\n담당 부서는 **공원녹지과**이며, 일반적으로 접수 후 3~5 영업일 내에 현장 점검이 이루어집니다.\n\n📍 신고 시 위치 정보(공원명, 가로등 번호판)를 함께 알려주시면 더 빠른 처리가 가능합니다.' },
      { role: 'user', time: '오후 3:14', text: '○○공원 3번 가로등입니다.' },
      { role: 'ai',   time: '오후 3:14', text: '○○공원 3번 가로등 파손 건으로 민원을 접수했습니다. ✅\n\n접수 번호가 발급되면 알림으로 안내드리겠습니다. 현재 처리 중 상태입니다.' },
    ],
  },
  {
    id: 3, title: '불법 주정차 단속 구역 확대 건의', category: '교통/주차',
    date: '2025.05.15', time: '오전 9:05', status: '민원 접수', messages: 8,
    preview: '저희 아파트 앞 도로에 매일 불법 주차 차량이 많아서...',
    conversation: [
      { role: 'ai',   time: '오전 9:05', text: '안녕하세요! 오늘은 어떤 민원을 도와드릴까요?' },
      { role: 'user', time: '오전 9:05', text: '저희 아파트 앞 도로에 매일 불법 주차 차량이 많아서 출입이 어렵습니다.' },
      { role: 'ai',   time: '오전 9:06', text: '불법 주정차로 인한 불편을 겪고 계시는군요. 단속 구역 확대 건의는 **교통지도과**에 민원으로 신청하실 수 있습니다.\n\n현재 위치의 단속 구역 현황을 확인해 드릴까요?' },
      { role: 'user', time: '오전 9:07', text: '네, 확인 부탁드립니다. 그리고 신청 방법도 알려주세요.' },
      { role: 'ai',   time: '오전 9:07', text: '단속 구역 확대 신청 방법\n\n1️⃣ 민원 접수: 본 AI 채팅에서 바로 접수 가능\n2️⃣ 방문: 교통지도과 직접 방문\n3️⃣ 전화: ☎ 02-345-6789\n\n📝 건의 시 포함할 내용\n• 위치 (도로명 주소)\n• 불법 주차 빈도 및 시간대\n• 피해 현황' },
      { role: 'user', time: '오전 9:09', text: '한빛아파트 앞 ○○로 123번길입니다. 출퇴근 시간대에 항상 막혀있어요.' },
      { role: 'ai',   time: '오전 9:09', text: '입력하신 내용으로 민원을 접수했습니다. ✅\n\n📌 접수 내용\n• 위치: ○○로 123번길 (한빛아파트 앞)\n• 유형: 불법 주정차 단속 구역 확대 건의\n• 담당: 교통지도과\n\n처리 결과는 등록된 연락처로 안내드립니다.' },
      { role: 'user', time: '오전 9:10', text: '감사합니다!' },
      { role: 'ai',   time: '오전 9:10', text: '민원이 정상적으로 접수되었습니다. 담당 부서 검토 후 연락드리겠습니다. 😊\n더 궁금한 사항이 있으시면 언제든지 문의해 주세요!' },
    ],
  },
  {
    id: 4, title: '쓰레기 무단 투기 단속 요청', category: '환경/위생',
    date: '2025.05.10', time: '오후 7:48', status: '상담 완료', messages: 5,
    preview: '골목 입구에 음식물 쓰레기가 계속 버려지고 있습니다.',
    conversation: [
      { role: 'ai',   time: '오후 7:48', text: '안녕하세요! 민원 내용을 말씀해 주세요.' },
      { role: 'user', time: '오후 7:48', text: '골목 입구에 음식물 쓰레기가 계속 버려지고 있습니다. 단속을 강화해 주세요.' },
      { role: 'ai',   time: '오후 7:49', text: '무단 투기 신고 감사합니다. **청소행정과**에서 담당하고 있으며, 신고 접수 시 현장 조사 후 CCTV 설치, 경고문 부착, 과태료 부과 등 조치가 이루어질 수 있습니다.' },
      { role: 'user', time: '오후 7:50', text: '○○골목 입구입니다. 사진도 찍어뒀어요.' },
      { role: 'ai',   time: '오후 7:50', text: '신고 접수 완료되었습니다. ✅\n\n사진 증거가 있으시면 민원 접수 시 첨부해 주시면 처리에 큰 도움이 됩니다.\n담당팀이 현장 확인 후 조치하겠습니다.' },
      { role: 'user', time: '오후 7:51', text: '빠른 조치 부탁드립니다.' },
      { role: 'ai',   time: '오후 7:51', text: '네, 신속히 처리될 수 있도록 긴급 처리 요청으로 접수했습니다. 불편을 드려 죄송하며 빠른 조치를 약속드립니다!' },
    ],
  },
  {
    id: 5, title: '어린이 보호구역 속도 위반 민원', category: '교통/안전',
    date: '2025.05.07', time: '오전 11:30', status: '상담 완료', messages: 7,
    preview: '학교 앞 스쿨존인데 차량들이 너무 빠르게 달려서...',
    conversation: [
      { role: 'ai',   time: '오전 11:30', text: '안녕하세요! 어떤 도움이 필요하신가요?' },
      { role: 'user', time: '오전 11:30', text: '학교 앞 스쿨존인데 차량들이 너무 빠르게 달려서 아이들이 위험합니다.' },
      { role: 'ai',   time: '오전 11:31', text: '스쿨존 속도 위반은 매우 중요한 안전 문제입니다. **교통행정과**와 **경찰서 교통과**에 동시에 신고하시면 더 빠른 조치가 가능합니다.\n\n🚸 스쿨존 관련 조치 가능 사항\n• 무인 단속 카메라 설치 건의\n• 과속 방지턱 추가 설치\n• 집중 단속 구간 지정' },
      { role: 'user', time: '오전 11:32', text: '○○초등학교 앞입니다. 무인카메라 설치를 요청하고 싶어요.' },
      { role: 'ai',   time: '오전 11:32', text: '무인 단속 카메라 설치 건의를 접수해 드리겠습니다.\n\n현장 조사 후 설치 여부가 결정되며, 일반적으로 3~6개월 내 처리됩니다.' },
      { role: 'user', time: '오전 11:33', text: '그렇군요. 접수해주세요.' },
      { role: 'ai',   time: '오전 11:33', text: '✅ 민원 접수 완료!\n\n• 위치: ○○초등학교 앞 스쿨존\n• 요청: 무인 단속 카메라 설치\n• 담당: 교통행정과\n\n처리 진행 상황은 마음이 앱 알림으로 안내드립니다.' },
      { role: 'user', time: '오전 11:34', text: '감사합니다. 빠른 설치 부탁드려요.' },
      { role: 'ai',   time: '오전 11:34', text: '아이들의 안전을 위한 소중한 건의 감사합니다. 최대한 빠른 처리가 이루어질 수 있도록 하겠습니다! 😊' },
    ],
  },
];

// 간단한 AI 자동 응답
const getAIReply = (text) => {
  if (/도로|파손|포트홀|구멍/.test(text))   return '도로 파손 관련 민원을 접수해 드리겠습니다.\n\n담당 부서는 **도로교통과**이며, 사진과 위치 정보를 함께 첨부하시면 더 빠른 처리가 가능합니다.\n\n민원 접수를 진행할까요?';
  if (/쓰레기|투기|환경|위생/.test(text))   return '환경/위생 관련 민원으로 분류되었습니다.\n\n**청소행정과**에서 담당하며, 현장 사진이 있으시면 첨부해 주시면 도움이 됩니다.\n\n민원을 접수해 드릴까요?';
  if (/주차|주정차|단속/.test(text))        return '불법 주정차 관련 민원입니다.\n\n**교통지도과** 담당이며 ☎ 02-345-6789로 신고하시거나 바로 민원 접수가 가능합니다.';
  if (/가로등|조명|불빛/.test(text))        return '시설물 관련 민원을 접수해 드리겠습니다.\n\n**공원녹지과** 또는 **도시시설과**에서 담당하며 접수 후 3~5 영업일 내 현장 점검이 이루어집니다.';
  if (/보상|배상|피해/.test(text))          return '피해 보상 신청은 **「국가배상법」**에 따라 진행됩니다.\n\n준비 서류: 현장 사진, 피해 견적서, 사고 경위서, 신분증 사본\n\n민원 접수 후 담당자가 검토하여 안내드립니다.';
  if (/스쿨존|어린이|학교|속도/.test(text)) return '어린이 보호구역 관련 민원입니다.\n\n**교통행정과**와 경찰서 교통과에 동시 접수를 권장합니다.\n\n무인 단속 카메라 설치, 과속 방지턱 추가 등 조치를 요청하실 수 있습니다.';
  return '말씀하신 내용을 확인했습니다.\n\n담당 부서를 분석 중입니다. 더 자세한 내용(위치, 발생 시간 등)을 알려주시면 빠른 안내가 가능합니다.\n\n민원 접수를 도와드릴까요?';
};

function MessageBubble({ msg, isSpeaking, onSpeak }) {
  const isAI = msg.role === 'ai';
  const lines = (msg.text || '').split('\n');
  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isAI ? 'bg-primary' : 'bg-primary/15'}`}>
        <span className={`material-symbols-outlined text-base ${isAI ? 'text-white' : 'text-primary'}`}>{isAI ? 'smart_toy' : 'person'}</span>
      </div>
      <div className={`max-w-[72%] ${isAI ? '' : ''}`}>
        <p className={`text-[11px] text-on-surface-variant mb-1.5 ${isAI ? 'ml-1' : 'mr-1 text-right'}`}>
          {isAI ? `마음이 · ${msg.time}` : msg.time}
        </p>
        <div className={`px-4 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
          isAI
            ? 'bg-white border border-outline-variant/40 rounded-tl-sm text-on-surface'
            : 'bg-primary text-white rounded-tr-sm'
        }`}>
          {msg.files && msg.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.files.map((f, i) => (
                f.isImage ? (
                  <img key={i} src={f.url} alt={f.name} className="max-w-[160px] max-h-[120px] rounded-xl object-cover border border-white/30" />
                ) : (
                  <div key={i} className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 text-xs">
                    <span className="material-symbols-outlined text-base">attach_file</span>
                    <span className="max-w-[120px] truncate">{f.name}</span>
                  </div>
                )
              ))}
            </div>
          )}
          {lines.map((line, i) => (
            <p key={i} className={line === '' ? 'h-2' : ''}>
              {line.replace(/\*\*(.*?)\*\*/g, '$1').split(/(\*\*.*?\*\*)/).map((part, j) =>
                /^\*\*/.test(part)
                  ? <strong key={j} className={isAI ? 'text-primary' : 'text-white font-bold'}>{part.replace(/\*\*/g, '')}</strong>
                  : part
              )}
            </p>
          ))}
          {isAI && (
            <button
              onClick={() => onSpeak(msg.text.replace(/\*\*/g, '').replace(/\n/g, ' '))}
              className="mt-2 flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">{isSpeaking ? 'volume_off' : 'volume_up'}</span>
              {isSpeaking ? '음성 중지' : '음성으로 듣기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chatbot() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [view, setView]                   = useState('chat');
  const [messages, setMessages]           = useState([GREETING]);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [input, setInput]                 = useState('');
  const [isTyping, setIsTyping]           = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [filterStatus, setFilterStatus]   = useState('전체');
  const [isListening, setIsListening]     = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging]       = useState(false);
  const recognitionRef   = useRef(null);
  const messagesEndRef   = useRef(null);
  const textareaRef      = useRef(null);
  const imageInputRef    = useRef(null);
  const fileInputRef     = useRef(null);
  const autoSubmitDone   = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!location.state?.autoSubmit || autoSubmitDone.current) return;
    autoSubmitDone.current = true;
    const data = location.state.ocrData ?? {};
    const t = () => {
      const d = new Date();
      const h = d.getHours(), m = d.getMinutes();
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    };
    const userMsg = {
      role: 'user', time: t(),
      text: `OCR 문서화로 작성된 서류를 민원 접수 요청합니다.\n\n📄 문서명: ${data.docname ?? '교통사고_사실확인서.jpg'}\n• 성명: ${data.name ?? '홍길동'}\n• 민원 유형: ${data.type ?? '교통사고 사실 확인'}\n• 발생 일시: ${data.date ?? '2024-05-20 14:30'}\n• 발생 장소: ${data.location ?? '서울특별시 강남구 테헤란로 1길 12'}`,
    };
    setTimeout(() => {
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setTimeout(() => {
        const aiMsg = {
          role: 'ai', time: t(),
          text: `OCR 서류 기반 민원 접수 요청을 확인했습니다. ✅\n\n📌 **접수 내용 요약**\n• 민원 유형: ${data.type ?? '교통사고 사실 확인'}\n• 신청인: ${data.name ?? '홍길동'}\n• 발생 장소: ${data.location ?? '서울특별시 강남구 테헤란로 1길 12'}\n• 발생 일시: ${data.date ?? '2024-05-20 14:30'}\n\n담당 부서(**도로교통과**)로 자동 분류하여 접수 처리하였습니다.\n처리 진행 상황은 알림으로 안내드리겠습니다. 😊`,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
      }, 1200);
    }, 600);
    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!location.state?.supplement || autoSubmitDone.current) return;
    autoSubmitDone.current = true;
    const { complaintId, complaintTitle } = location.state;
    const t = () => {
      const d = new Date();
      const h = d.getHours(), m = d.getMinutes();
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    };
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: 'user', time: t(),
        text: `민원 번호 ${complaintId} '${complaintTitle}' 건에 대해 보완 서류를 제출하겠습니다.`,
      }]);
      setIsTyping(true);
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          role: 'ai', time: t(),
          text: `보완 서류 제출 요청을 확인했습니다. ✅\n\n📌 **대상 민원**\n• 민원 번호: ${complaintId}\n• 제목: ${complaintTitle}\n\n보완하실 서류나 추가 내용을 아래에 입력해 주세요.\n담당자에게 전달하여 빠르게 처리될 수 있도록 도와드리겠습니다. 😊`,
        }]);
        setIsTyping(false);
      }, 1200);
    }, 600);
    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 입력을 지원하지 않습니다.\nChrome을 사용해 주세요.'); return; }
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.onstart  = () => setIsListening(true);
    recognition.onresult = (e) => { const t = Array.from(e.results).map(r => r[0].transcript).join(''); setInput(t); };
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang    = 'ko-KR';
    utter.onstart = () => setIsSpeaking(true);
    utter.onend   = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const now = () => {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    return `${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  };

  const processFiles = (fileList) => {
    const files = Array.from(fileList).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
      isImage: f.type.startsWith('image/'),
    }));
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleFileSelect = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const removeFile = (idx) => {
    setAttachedFiles(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isTyping || viewingHistory) return;
    const userMsg = { role: 'user', time: now(), text, files: attachedFiles };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);
    setTimeout(() => {
      const aiMsg = { role: 'ai', time: now(), text: getAIReply(text) };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 900);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openHistory = (h) => {
    setViewingHistory(h);
    setMessages(h.conversation);
    setView('chat');
  };

  const startNewChat = () => {
    setViewingHistory(null);
    setMessages([GREETING]);
    setView('chat');
  };

  const filteredHistory = historyList.filter(h => {
    const matchSearch = h.title.includes(historySearch) || h.preview.includes(historySearch);
    const matchStatus = filterStatus === '전체' || h.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const resultBadge = (r) => {
    if (r === '보상 승인') return 'bg-emerald-50 text-emerald-600';
    if (r === '부분 보상') return 'bg-amber-50 text-amber-600';
    return 'bg-surface-container text-on-surface-variant';
  };

  return (
    <CitizenLayout pageTitle="AI 민원 상담" activeMenu="chatbot">
      <div className="grid grid-cols-12 gap-5" style={{ height: 'calc(100vh - 8rem)' }}>

        {/* ── 채팅 / 상담 내역 영역 ── */}
        <section className="col-span-9 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-outline-variant bg-white">

          {/* 헤더 */}
          <div className="shrink-0 bg-gradient-to-r from-primary to-[#3a7fd4] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl">smart_toy</span>
                </div>
                {view === 'chat' && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-primary rounded-full" />}
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">
                  {viewingHistory ? viewingHistory.title : '마음이 AI 민원 상담'}
                </p>
                <p className="text-xs text-white/70 mt-0.5">
                  {viewingHistory ? `${viewingHistory.date} ${viewingHistory.time}` : '온라인 · 24시간 응답 가능'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-white/15 rounded-xl p-1 gap-1">
                <button
                  onClick={startNewChat}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors ${
                    view === 'chat' && !viewingHistory ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">add_comment</span>
                  새 상담 시작
                </button>
                <button
                  onClick={() => { setView('history'); setViewingHistory(null); }}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors ${
                    view === 'history' || viewingHistory ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">history</span>
                  상담 내역
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${view === 'history' || viewingHistory ? 'bg-primary/10 text-primary' : 'bg-white/20 text-white'}`}>
                    {historyList.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ── 채팅 뷰 ── */}
          {(view === 'chat') && (
            <>
              {/* 과거 상담 보는 중 안내 배너 */}
              {viewingHistory && (
                <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200">
                  <span className="material-symbols-outlined text-amber-500 text-base">history</span>
                  <p className="text-xs text-amber-700 font-bold flex-1">과거 상담 내역을 보고 있습니다.</p>
                  <button onClick={startNewChat} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">add_comment</span>새 상담 시작
                  </button>
                </div>
              )}

              {/* 날짜 구분선 */}
              <div className="flex items-center gap-3 px-6 py-3 bg-surface-container-low/40 shrink-0">
                <div className="flex-1 h-px bg-outline-variant/50" />
                <span className="text-[11px] text-on-surface-variant font-medium">
                  {viewingHistory ? viewingHistory.date : '오늘'}
                </span>
                <div className="flex-1 h-px bg-outline-variant/50" />
              </div>

              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6" style={{ background: 'linear-gradient(180deg,#f8faff 0%,#ffffff 100%)' }}>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} isSpeaking={isSpeaking} onSpeak={speak} />
                ))}

                {/* AI 타이핑 인디케이터 */}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <span className="material-symbols-outlined text-white text-base">smart_toy</span>
                    </div>
                    <div className="bg-white border border-outline-variant/40 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 빠른 답변 버튼 (새 채팅 + 마지막 메시지가 AI일 때) */}
                {!viewingHistory && messages.length >= 1 && messages[messages.length - 1]?.role === 'ai' && !isTyping && (
                  <div className="flex flex-wrap gap-2 pl-11">
                    {quickReplies.map((r) => (
                      <button
                        key={r.label}
                        onClick={() => { setInput(r.label); textareaRef.current?.focus(); }}
                        className="flex items-center gap-1.5 text-xs bg-white border border-primary/30 text-primary px-3 py-1.5 rounded-full font-bold hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">{r.icon}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 입력 영역 */}
              <div className="shrink-0 p-4 border-t border-outline-variant/60 bg-white">
                {viewingHistory ? (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">lock</span>
                    <p className="text-sm text-on-surface-variant">과거 상담 내역입니다.</p>
                    <button onClick={startNewChat} className="text-sm font-bold text-primary hover:underline">새 상담 시작하기</button>
                  </div>
                ) : (
                  <>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.hwp" multiple className="hidden" onChange={handleFileSelect} />
                  <div
                    className={`border rounded-2xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary/10 ${
                      isDragging ? 'border-primary border-2 bg-primary/5' : 'border-outline-variant focus-within:border-primary'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {isDragging && (
                      <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-primary pointer-events-none">
                        <span className="material-symbols-outlined">upload_file</span>
                        파일을 여기에 놓으세요
                      </div>
                    )}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-4 pt-3">
                        {attachedFiles.map((f, i) => (
                          <div key={i} className="relative group">
                            {f.isImage ? (
                              <img src={f.url} alt={f.name} className="w-14 h-14 rounded-xl object-cover border border-outline-variant" />
                            ) : (
                              <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1.5 rounded-xl text-xs text-on-surface border border-outline-variant">
                                <span className="material-symbols-outlined text-sm text-primary">attach_file</span>
                                <span className="max-w-[100px] truncate">{f.name}</span>
                              </div>
                            )}
                            <button
                              onClick={() => removeFile(i)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-error text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="궁금한 내용을 자유롭게 입력해주세요... (Enter 전송 / Shift+Enter 줄바꿈)"
                      rows={2}
                      className="w-full px-4 pt-3.5 pb-2 bg-transparent outline-none resize-none text-sm text-on-surface placeholder:text-on-surface-variant/50"
                    />
                    <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={isListening ? stopListening : startListening}
                          className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl transition-colors ${
                            isListening ? 'text-error bg-error/10 animate-pulse' : 'text-on-surface-variant hover:text-primary hover:bg-primary/8'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{isListening ? 'mic_off' : 'mic'}</span>
                          <span className="hidden sm:inline">{isListening ? '녹음 중...' : '음성'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary px-2.5 py-1.5 rounded-xl hover:bg-primary/8 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">image</span>
                          <span className="hidden sm:inline">이미지</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary px-2.5 py-1.5 rounded-xl hover:bg-primary/8 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">attach_file</span>
                          <span className="hidden sm:inline">파일</span>
                        </button>
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={(!input.trim() && attachedFiles.length === 0) || isTyping}
                        className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:brightness-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-base">send</span>
                        전송
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── 상담 내역 리스트 뷰 ── */}
          {view === 'history' && (
            <>
              <div className="shrink-0 px-5 py-4 border-b border-outline-variant/60 flex items-center gap-3 bg-surface-container-low/30">
                <div className="relative flex-1">
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="상담 내용 검색..."
                    className="w-full h-9 pl-9 pr-4 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary transition-colors bg-white"
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-outline-variant text-sm text-on-surface bg-white outline-none focus:border-primary transition-colors"
                >
                  {['전체', '상담 완료', '처리 중', '민원 접수'].map(o => <option key={o}>{o}</option>)}
                </select>
                <span className="text-xs text-on-surface-variant shrink-0">총 {filteredHistory.length}건</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40">
                {filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl opacity-30">search_off</span>
                    <p className="text-sm">검색 결과가 없습니다.</p>
                  </div>
                ) : filteredHistory.map((h) => {
                  const st  = statusConfig[h.status] ?? { bg: 'bg-surface-container', text: 'text-on-surface-variant' };
                  const catS = CATEGORY_STYLE[h.category] ?? CATEGORY_STYLE['기타'];
                  return (
                    <button
                      key={h.id}
                      onClick={() => openHistory(h)}
                      className="w-full flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-lg">chat_bubble</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${catS.bg} ${catS.text}`}>{h.category}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.bg} ${st.text}`}>{h.status}</span>
                        </div>
                        <p className="text-sm font-bold text-on-surface truncate">{h.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 truncate">{h.preview}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[11px] text-on-surface-variant">{h.date}</span>
                        <span className="text-[11px] text-on-surface-variant">{h.time}</span>
                        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-xs">forum</span>
                          {h.messages}개
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── 오른쪽 사이드 ── */}
        <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/8 to-transparent px-5 py-4 border-b border-outline-variant/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">summarize</span>
                <h3 className="font-bold text-sm text-on-surface">상담 요약</h3>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-on-surface-variant font-medium">민원 유형</p>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">도로/교통</span>
              </div>
              <div className="bg-surface-container-low/60 rounded-xl p-3">
                <p className="text-[11px] text-on-surface-variant mb-1">담당 부서</p>
                <p className="text-xs font-bold text-on-surface">서울시 도로관리과</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-primary text-xs">call</span>
                  <p className="text-xs text-primary font-medium">02-123-4567</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-on-surface-variant font-medium">AI 분석 위험도</p>
                <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">보통</span>
              </div>
              <div className="border-t border-outline-variant/50" />
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] text-on-surface-variant font-medium">유사 민원 사례</p>
                </div>
                <div className="space-y-2">
                  {similarCases.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low transition-colors cursor-pointer">
                      <span className="text-[11px] font-bold text-primary w-4 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-on-surface leading-snug line-clamp-2">{c.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 inline-block ${resultBadge(c.result)}`}>{c.result}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-outline-variant/50" />
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium mb-2.5">추천 조치</p>
                <div className="space-y-2">
                  {['사고 현장 사진 확보', '차량 피해 내역 준비', '관할 도로 관리청에 신청'].map((a, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-on-surface">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate('/my-complaints')}
                className="w-full mt-1 bg-primary text-white text-sm font-bold py-3 rounded-xl hover:brightness-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">edit_document</span>
                민원 접수하기
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/8 to-[#3a7fd4]/5 rounded-2xl border border-primary/15 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-lg">help_outline</span>
              <h4 className="text-sm font-bold text-primary">도움이 필요하신가요?</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">자주 묻는 질문과 이용 가이드를 확인해 보세요.</p>
            <button
              onClick={() => navigate('/faq')}
              className="w-full text-xs font-bold text-primary border border-primary/40 bg-white py-2.5 rounded-xl hover:bg-primary/5 transition-colors shadow-sm"
            >
              이용 가이드 보기 →
            </button>
          </div>
        </aside>

      </div>
    </CitizenLayout>
  );
}

export default Chatbot;
