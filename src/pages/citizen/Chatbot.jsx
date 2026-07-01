import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { CATEGORY_STYLE, useApp } from '../../store/AppContext';
import { chatAskApi, chatImageApi, getChatSessionApi } from '../../api/chat';

const quickReplies = [
  { icon: 'description',         label: '필요 서류 안내' },
  { icon: 'route',               label: '신청 절차 안내' },
  { icon: 'search',              label: '유사 사례 보기' },
  { icon: 'chat_bubble_outline', label: '상담 종료' },
];


const statusConfig = {
  '상담 완료': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '처리 중':   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '민원 접수': { bg: 'bg-blue-50',    text: 'text-blue-600' },
};


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
    <div className={`flex gap-2 md:gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isAI ? 'bg-primary' : 'bg-primary/15'}`}>
        <span className={`material-symbols-outlined text-sm md:text-base ${isAI ? 'text-white' : 'text-primary'}`}>{isAI ? 'smart_toy' : 'person'}</span>
      </div>
      <div className="max-w-[80%] md:max-w-[72%]">
        <p className={`text-[10px] md:text-[11px] text-on-surface-variant mb-1 ${isAI ? 'ml-1' : 'mr-1 text-right'}`}>
          {isAI ? `마음이 · ${msg.time}` : msg.time}
        </p>
        <div className={`px-3 py-2.5 md:px-4 md:py-3.5 rounded-2xl shadow-sm text-xs md:text-sm leading-relaxed ${
          isAI
            ? 'bg-white border border-outline-variant/40 rounded-tl-sm text-on-surface'
            : 'bg-primary text-white rounded-tr-sm'
        }`}>
          {msg.files && msg.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.files.map((f, i) => (
                f.isImage ? (
                  <img key={i} src={f.url} alt={f.name} className="max-w-[120px] md:max-w-[160px] max-h-[100px] md:max-h-[120px] rounded-xl object-cover border border-white/30" />
                ) : (
                  <div key={i} className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 text-xs">
                    <span className="material-symbols-outlined text-base">attach_file</span>
                    <span className="max-w-[100px] truncate">{f.name}</span>
                  </div>
                )
              ))}
            </div>
          )}
          {lines.map((line, i) => (
            <p key={i} className={line === '' ? 'h-1.5' : ''}>
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
              className="mt-1.5 flex items-center gap-1 text-[10px] md:text-[11px] text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-xs md:text-sm">{isSpeaking ? 'volume_off' : 'volume_up'}</span>
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
  const { chatSessions, currentUser, saveChatSession, deleteChatSession, addComplaint } = useApp();

  const makeGreeting = () => {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes();
    const time = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    return {
      role: 'ai',
      time,
      text: `안녕하세요${currentUser?.name ? `, **${currentUser.name}** 님` : ''}! 👋\n불편하신 사항이나 건의하고 싶은 내용을 편하게 말씀해 주세요.\nAI가 24시간 안내해 드리는 마음이 민원 서비스입니다.`,
    };
  };

  const [view, setView]                   = useState('chat');
  const [messages, setMessages]           = useState(() => [makeGreeting()]);
  const [summary, setSummary]             = useState({ category: null, dept: null, urgency: null });
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ── 민원 접수 모달 ── */
  const [submitModal, setSubmitModal] = useState({ open: false, title: '', content: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [submitDone, setSubmitDone]   = useState(null); // { title, category, dept } | null
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
    if (!window.speechSynthesis) { alert('이 브라우저는 음성 출력을 지원하지 않습니다.'); return; }
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const doSpeak = () => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      const koVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
      if (koVoice) utter.voice = koVoice;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend   = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
    } else {
      doSpeak();
    }
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
      file: f,
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

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isTyping || viewingHistory) return;

    const sentFiles = attachedFiles;
    const userMsg = { role: 'user', time: now(), text, files: sentFiles };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const imageFile = sentFiles.find(f => f.isImage);
      const result = imageFile
        ? await chatImageApi(imageFile.file, text, currentSessionId)
        : await chatAskApi(text, currentSessionId);

      if (result.session_id) setCurrentSessionId(result.session_id);

      const md = result.metadata;
      if (md?.tool_used) {
        setSummary({
          category: md.classification?.category ?? md.classification?.category_id ?? null,
          dept:     md.departments?.[0]?.name ?? md.departments?.[0]?.department_id ?? null,
          urgency:  md.urgency?.probability_urgent >= 0.7 ? '긴급'
                  : md.urgency?.probability_urgent >= 0.4 ? '보통' : '낮음',
        });
      }

      setMessages(prev => [...prev, { role: 'ai', time: now(), text: result.answer }]);
    } catch {
      // 백엔드 연결 실패 시 로컬 응답으로 폴백
      setMessages(prev => [...prev, { role: 'ai', time: now(), text: getAIReply(text) }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openHistory = async (h) => {
    if (!h.conversation && h.session_id) {
      try {
        const full = await getChatSessionApi(h.session_id);
        const conv = Array.isArray(full.messages) ? full.messages : [];
        const enriched = { ...h, conversation: conv };
        setViewingHistory(enriched);
        setMessages(conv.length ? conv : [makeGreeting()]);
        setView('chat');
        return;
      } catch {}
    }
    setViewingHistory(h);
    setMessages(h.conversation ?? [makeGreeting()]);
    setView('chat');
  };

  const buildSession = (status) => {
    const userMsgs = messages.filter(m => m.role === 'user' && m.text?.trim());
    if (userMsgs.length === 0) return null;
    const firstText = userMsgs[0].text.replace(/\n/g, ' ').trim();
    const lastMsg   = messages[messages.length - 1];
    const d = new Date();
    return {
      id:           `session-${Date.now()}`,
      title:        firstText.length > 30 ? firstText.slice(0, 30) + '…' : firstText,
      preview:      (lastMsg?.text ?? '').replace(/\n/g, ' ').slice(0, 50),
      date:         `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`,
      time:         `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2,'0')}`,
      status:       status,
      category:     summary.category ?? '기타',
      messages:     userMsgs.length,
      conversation: messages,
    };
  };

  const startNewChat = () => {
    if (!viewingHistory) {
      const session = buildSession('상담 완료');
      if (session) saveChatSession(session);
    }
    setCurrentSessionId(null);
    setViewingHistory(null);
    setMessages([makeGreeting()]);
    setSummary({ category: null, dept: null, urgency: null });
    setView('chat');
  };

  const openSubmitModal = () => {
    const userMsgs = messages.filter(m => m.role === 'user' && m.text?.trim());
    if (userMsgs.length === 0) return;
    const firstText = userMsgs[0].text.replace(/\n/g, ' ').trim();
    const title = firstText.length > 30 ? firstText.slice(0, 30) + '…' : firstText;
    const content = userMsgs.map(m => m.text).join('\n\n');
    setSubmitModal({ open: true, title, content });
  };

  const handleComplaintSubmit = async () => {
    if (!submitModal.title.trim() || !submitModal.content.trim()) return;
    setSubmitting(true);
    try {
      await addComplaint({
        title: submitModal.title.trim(),
        content: submitModal.content.trim(),
        category: summary.category ?? '기타',
      });
      setSubmitModal({ open: false, title: '', content: '' });
      const doneInfo = {
        title: submitModal.title.trim(),
        category: summary.category ?? '기타',
        dept: summary.dept ?? null,
      };
      setSubmitDone(doneInfo);
      const session = buildSession('민원 접수');
      if (session) saveChatSession({ ...session, title: doneInfo.title, category: doneInfo.category });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!submitDone) return;
    const handler = (e) => { if (e.key === 'Escape') setSubmitDone(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitDone]);

  const filteredHistory = chatSessions.filter(h => {
    const matchSearch = h.title.includes(historySearch) || h.preview.includes(historySearch);
    const matchStatus = filterStatus === '전체' || h.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <CitizenLayout pageTitle="AI 민원 상담" activeMenu="chatbot">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5" style={{ height: 'calc(100vh - 8rem)' }}>

        {/* ── 채팅 / 상담 내역 영역 ── */}
        <section className="col-span-1 md:col-span-9 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-outline-variant bg-white">

          {/* 헤더 */}
          <div className="shrink-0 bg-gradient-to-r from-primary to-[#3a7fd4] px-2 py-2 md:px-6 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative">
                <div className="w-7 h-7 md:w-11 md:h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-base md:text-2xl">smart_toy</span>
                </div>
                {view === 'chat' && <span className="absolute bottom-0 right-0 w-2 h-2 md:w-3 md:h-3 bg-emerald-400 border-2 border-primary rounded-full" />}
              </div>
              <div>
                <p className="font-bold text-white text-xs md:text-sm leading-tight">
                  {viewingHistory ? viewingHistory.title : '마음이 AI 민원 상담'}
                </p>
                <p className="text-[10px] md:text-xs text-white/70 mt-0.5 hidden md:block">
                  {viewingHistory ? `${viewingHistory.date} ${viewingHistory.time}` : '온라인 · 24시간 응답 가능'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex bg-white/15 rounded-xl p-0.5 md:p-1 gap-0.5 md:gap-1">
                <button
                  onClick={startNewChat}
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 md:px-3.5 md:py-2 rounded-lg transition-colors ${
                    view === 'chat' && !viewingHistory ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm md:text-base">add_comment</span>
                  <span className="hidden sm:inline">새 상담 시작</span>
                </button>
                <button
                  onClick={() => { setView('history'); setViewingHistory(null); }}
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 md:px-3.5 md:py-2 rounded-lg transition-colors ${
                    view === 'history' || viewingHistory ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm md:text-base">history</span>
                  <span className="hidden sm:inline">상담 내역</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${view === 'history' || viewingHistory ? 'bg-primary/10 text-primary' : 'bg-white/20 text-white'}`}>
                    {chatSessions.length}
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
                </div>
              )}

              {/* 날짜 구분선 */}
              <div className="flex items-center gap-3 px-3 py-1.5 md:px-6 md:py-3 bg-surface-container-low/40 shrink-0">
                <div className="flex-1 h-px bg-outline-variant/50" />
                <span className="text-[11px] text-on-surface-variant font-medium">
                  {viewingHistory ? viewingHistory.date : '오늘'}
                </span>
                <div className="flex-1 h-px bg-outline-variant/50" />
              </div>

              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4 space-y-3 md:space-y-6" style={{ background: 'linear-gradient(180deg,#f8faff 0%,#ffffff 100%)' }}>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} isSpeaking={isSpeaking} onSpeak={speak} />
                ))}

                {/* AI 타이핑 인디케이터 */}
                {isTyping && (
                  <div className="flex gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <span className="material-symbols-outlined text-white text-sm md:text-base">smart_toy</span>
                    </div>
                    <div className="bg-white border border-outline-variant/40 rounded-2xl rounded-tl-sm px-3 py-2.5 md:px-4 md:py-3.5 shadow-sm flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 빠른 답변 버튼 (새 채팅 + 마지막 메시지가 AI일 때) */}
                {!viewingHistory && messages.length >= 1 && messages[messages.length - 1]?.role === 'ai' && !isTyping && (
                  <div className="flex flex-wrap gap-1.5 md:gap-2 pl-8 md:pl-11">
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

              {/* 모바일 전용 민원 접수 버튼 */}
              {!viewingHistory && (
                <div className="md:hidden shrink-0 px-4 pt-2 bg-white">
                  <button
                    onClick={openSubmitModal}
                    disabled={messages.filter(m => m.role === 'user').length === 0}
                    className="w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">edit_document</span>
                    민원 접수하기
                  </button>
                </div>
              )}

              {/* 입력 영역 */}
              <div className="shrink-0 p-2 md:p-4 border-t border-outline-variant/60 bg-white">
                {viewingHistory ? (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">lock</span>
                    <p className="text-sm text-on-surface-variant">과거 상담 내역입니다.</p>
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
                      placeholder="불편하신 내용을 입력해주세요..."
                      rows={1}
                      className="w-full px-3 pt-2.5 pb-1.5 md:px-4 md:pt-3.5 md:pb-2 bg-transparent outline-none resize-none text-sm text-on-surface placeholder:text-on-surface-variant/50"
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
                  <p className="hidden md:block text-[10px] text-on-surface-variant/40 text-center px-4 pb-2 leading-relaxed">
                    마음이 AI는 참고용 정보만 제공하며, 법적 효력이 없습니다. 중요한 사항은 담당 기관에 직접 확인하세요.
                  </p>
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
                    <div
                      key={h.id}
                      className="w-full flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/50 transition-colors group"
                    >
                      <button onClick={() => openHistory(h)} className="flex items-start gap-4 flex-1 min-w-0 text-left">
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
                      </button>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          onClick={() => deleteChatSession(h.session_id, h.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg hover:bg-error/10 flex items-center justify-center"
                          title="삭제"
                        >
                          <span className="material-symbols-outlined text-sm text-on-surface-variant hover:text-error">delete</span>
                        </button>
                        <span className="text-[11px] text-on-surface-variant">{h.date}</span>
                        <span className="text-[11px] text-on-surface-variant">{h.time}</span>
                        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-xs">forum</span>
                          {h.messages}개
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── 오른쪽 사이드 ── */}
        <aside className="hidden md:flex md:col-span-3 flex-col gap-4 overflow-y-auto">
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
                {(viewingHistory?.category ?? summary.category) ? (
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">
                    {viewingHistory?.category ?? summary.category}
                  </span>
                ) : (
                  <span className="text-xs text-on-surface-variant/50">-</span>
                )}
              </div>
              <div className="bg-surface-container-low/60 rounded-xl p-3">
                <p className="text-[11px] text-on-surface-variant mb-1">담당 부서</p>
                {summary.dept ? (
                  <p className="text-xs font-bold text-on-surface">{summary.dept}</p>
                ) : (
                  <p className="text-xs text-on-surface-variant/50">상담 내용 분석 후 표시됩니다.</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-on-surface-variant font-medium">AI 분석 위험도</p>
                {summary.urgency ? (
                  <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">{summary.urgency}</span>
                ) : (
                  <span className="text-xs text-on-surface-variant/50">-</span>
                )}
              </div>
              <div className="border-t border-outline-variant/50" />
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium mb-2.5">유사 민원 사례</p>
                <p className="text-xs text-on-surface-variant/50 text-center py-2">상담 내용 분석 후 표시됩니다.</p>
              </div>
              <div className="border-t border-outline-variant/50" />
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium mb-2.5">추천 조치</p>
                <p className="text-xs text-on-surface-variant/50 text-center py-2">상담 내용 분석 후 표시됩니다.</p>
              </div>
              <button
                onClick={openSubmitModal}
                disabled={messages.filter(m => m.role === 'user').length === 0}
                className="w-full mt-1 bg-primary text-white text-sm font-bold py-3 rounded-xl hover:brightness-95 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* 민원 접수 모달 */}
      {submitModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setSubmitModal(p => ({ ...p, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg">edit_document</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">민원 접수</h3>
                  <p className="text-xs text-on-surface-variant">상담 내용을 바탕으로 자동 작성되었습니다.</p>
                </div>
              </div>
              <button onClick={() => setSubmitModal(p => ({ ...p, open: false }))} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">민원 제목</label>
                <input
                  type="text"
                  value={submitModal.title}
                  onChange={e => setSubmitModal(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-11 px-3.5 border-2 border-outline-variant rounded-xl focus:border-primary outline-none text-sm text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">민원 내용</label>
                <textarea
                  value={submitModal.content}
                  onChange={e => setSubmitModal(p => ({ ...p, content: e.target.value }))}
                  rows={6}
                  className="w-full px-3.5 py-3 border-2 border-outline-variant rounded-xl focus:border-primary outline-none text-sm text-on-surface resize-none"
                />
              </div>
              {summary.category && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-low/60 px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-base text-primary">category</span>
                  분류: <span className="font-bold text-primary">{summary.category}</span>
                  {summary.dept && <> · 담당: <span className="font-bold text-on-surface">{summary.dept}</span></>}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSubmitModal(p => ({ ...p, open: false }))}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  onClick={handleComplaintSubmit}
                  disabled={submitting || !submitModal.title.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 shadow-md shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '접수 중...' : '접수하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 민원 접수 완료 팝업 */}
      {submitDone && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setSubmitDone(null)}>
          <div className="flex flex-col items-center gap-4 bg-white border border-outline-variant px-10 py-8 rounded-3xl shadow-2xl w-[360px]" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-on-surface mb-1">민원 접수 완료!</p>
              <p className="text-sm text-on-surface-variant">담당 부서에서 검토 후 안내드리겠습니다.</p>
            </div>
            <div className="w-full bg-surface-container-low/60 rounded-2xl px-5 py-4 flex flex-col gap-2.5 text-sm">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">edit_document</span>
                <div>
                  <p className="text-[11px] text-on-surface-variant font-medium">민원 제목</p>
                  <p className="font-bold text-on-surface">{submitDone.title}</p>
                </div>
              </div>
              {submitDone.category && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary shrink-0">category</span>
                  <div>
                    <p className="text-[11px] text-on-surface-variant font-medium">민원 유형</p>
                    <p className="font-bold text-on-surface">{submitDone.category}</p>
                  </div>
                </div>
              )}
              {submitDone.dept && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary shrink-0">business</span>
                  <div>
                    <p className="text-[11px] text-on-surface-variant font-medium">담당 부서</p>
                    <p className="font-bold text-on-surface">{submitDone.dept}</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setSubmitDone(null)}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-105 shadow-md shadow-primary/25"
            >
              확인
            </button>
            <p className="text-xs text-on-surface-variant/50">ESC 또는 확인을 눌러 닫기</p>
          </div>
        </div>
      )}
    </CitizenLayout>
  );
}

export default Chatbot;
