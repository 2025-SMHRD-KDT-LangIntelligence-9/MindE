import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';
import { CATEGORY_STYLE, useApp } from '../../store/AppContext';
import { chatAskApi, chatImageApi, chatFileApi, getChatSessionApi, chatVoiceReplyApi, getChatFileBlobUrlApi, createComplaintDraftApi, updateChatSessionApi } from '../../api/chat';
import { uploadAttachmentApi } from '../../api/complaints';

const quickReplies = [
  { icon: 'description',         label: '필요 서류 안내' },
  { icon: 'route',               label: '신청 절차 안내' },
  { icon: 'search',              label: '유사 사례 보기' },
  { icon: 'chat_bubble_outline', label: '상담 종료' },
];

// 민원 내용 최소 길이 (백엔드 게이트: 10자 미만이면 400)
const MIN_COMPLAINT_LEN = 10;
// 진행 중 상담을 다른 탭 이동/새로고침 후에도 유지하기 위한 저장 키
const LIVE_CHAT_KEY = 'minde_live_chat';
// quick-reply 버튼 텍스트는 민원 내용에 포함하지 않음 (백엔드 안내사항)
const QUICK_LABELS = quickReplies.map((r) => r.label);


const statusConfig = {
  '상담 완료': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '처리 중':   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '민원 접수': { bg: 'bg-blue-50',    text: 'text-blue-600' },
};

// 정부24 절차 안내(metadata.procedures) 필드명 → 한글 라벨 (영/한 키 모두 대응)
const PROC_LABELS = {
  method: '신청 방법', how: '신청 방법', apply: '신청 방법', application: '신청 방법', how_to_apply: '신청 방법',
  document: '구비 서류', documents: '구비 서류', required_documents: '구비 서류', docs: '구비 서류',
  period: '처리 기간', processing_time: '처리 기간', duration: '처리 기간', time: '처리 기간',
  fee: '수수료', cost: '수수료', charge: '수수료', price: '수수료',
  url: '바로가기', link: '바로가기', title: '항목', name: '항목',
  '신청방법': '신청 방법', '구비서류': '구비 서류', '처리기간': '처리 기간', '수수료': '수수료',
  '용도': '서비스 설명', '소관기관': '소관 기관', '절차': '처리 절차', '근거법령': '근거 법령', '출처': '출처',
};

// procedures = 정부24 카탈로그 검색 결과 [{ title, content(라벨 형식), similarity, ... }]
// 같은 title(동일 민원)의 청크가 여러 개 올 수 있어 title로 묶고 content 라인을 합쳐 표시
function ProceduresView({ data }) {
  const label = (k) => PROC_LABELS[String(k).toLowerCase()] ?? PROC_LABELS[k] ?? k;
  const raw = (Array.isArray(data) ? data : [data]).filter((x) => x != null && x !== '');
  if (raw.length === 0) return null;

  // 문자열 형태로 오면 그대로 표시
  if (raw.every((x) => typeof x !== 'object')) {
    return (
      <div className="space-y-1">
        {raw.map((x, i) => (
          <p key={i} className="text-xs text-on-surface leading-relaxed">{String(x)}</p>
        ))}
      </div>
    );
  }

  // title 기준 그룹핑 + content(청크) 합치기(중복 제거)
  const groups = [];
  const byTitle = {};
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const title = it.title ?? it.name ?? '민원 절차';
    if (!byTitle[title]) { byTitle[title] = { title, contents: [] }; groups.push(byTitle[title]); }
    const c = String(it.content ?? '').trim();
    if (c && !byTitle[title].contents.includes(c)) byTitle[title].contents.push(c);
  }

  // "[라벨] 값 [라벨2] 값2 …" 형식 파싱. 앞부분 비라벨 텍스트는 서비스 설명으로.
  const parseFields = (text) => {
    const str = String(text).replace(/\s*\.\.\.$/, '').trim();
    const fields = [];
    const re = /\[([^\]]+)\]/g;
    let m, lastIdx = 0, lastLabel = null;
    while ((m = re.exec(str)) !== null) {
      const seg = str.slice(lastIdx, m.index).trim();
      if (lastLabel === null) { if (seg) fields.push({ label: null, value: seg }); }
      else fields.push({ label: lastLabel, value: seg });
      lastLabel = m[1].trim();
      lastIdx = re.lastIndex;
    }
    const tail = str.slice(lastIdx).trim();
    if (lastLabel === null) { if (tail) fields.push({ label: null, value: tail }); }
    else fields.push({ label: lastLabel, value: tail });
    return fields.filter((f) => f.value && f.label !== '출처');
  };

  return (
    <div className="space-y-2.5">
      {groups.slice(0, 2).map((g, i) => {
        const fields = parseFields(g.contents.join('\n'));
        return (
          <div key={i} className="bg-surface-container-low/60 rounded-lg p-2.5">
            <p className="text-xs font-bold text-on-surface mb-1.5">{g.title}</p>
            <div className="space-y-1">
              {fields.map((f, j) =>
                f.label === null ? (
                  <p key={j} className="text-[11px] text-on-surface leading-relaxed">{f.value}</p>
                ) : (
                  <div key={j} className="flex gap-1.5 text-[11px] leading-relaxed">
                    <span className="text-on-surface-variant font-medium shrink-0">{label(f.label)}</span>
                    <span className="text-on-surface break-words min-w-0 flex-1">{f.value}</span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}



// 이미지 파일을 적당히 축소해 data URL로 변환.
// 상담 내역(백엔드에 JSON 저장)에 이미지가 함께 남아 다시 열어도 보이도록 함.
function fileToDataUrl(file, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(e.target.result); // 캔버스 실패 시 원본 data URL
        }
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// data URL(base64 이미지)을 File 객체로 복원 (탭 이동 후에도 첨부 업로드 가능하도록).
function dataUrlToFile(dataUrl, name) {
  try {
    const [meta, b64] = String(dataUrl).split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name || 'image.jpg', { type: mime });
  } catch {
    return null;
  }
}

// ISO timestamp → "오후 4:47" 형식
function isoToTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const h = d.getHours(), m = d.getMinutes();
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  } catch { return ''; }
}

// 세션 첨부파일(백엔드 저장분)을 JWT로 blob 로드해 표시. filename 기반.
function ChatAttachment({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let created = null;
    getChatFileBlobUrlApi(file.filename)
      .then((u) => { if (alive) { created = u; setUrl(u); } else URL.revokeObjectURL(u); })
      .catch(() => {});
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [file.filename]);

  if (file.isImage) {
    return url ? (
      <img src={url} alt={file.name} className="max-w-[120px] md:max-w-[160px] max-h-[100px] md:max-h-[120px] rounded-xl object-cover border border-white/30" />
    ) : (
      <div className="w-24 h-20 rounded-xl bg-white/20 flex items-center justify-center">
        <span className="material-symbols-outlined text-base animate-pulse">image</span>
      </div>
    );
  }
  return (
    <a
      href={url || undefined}
      download={file.name}
      className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 text-xs hover:bg-white/30 transition-colors"
    >
      <span className="material-symbols-outlined text-base">attach_file</span>
      <span className="max-w-[100px] truncate">{file.name}</span>
    </a>
  );
}

// 저장된 상담 메시지를 화면 형식({ role:'ai'|'user', text })으로 정규화.
// 프론트 저장본({role:'ai'|'user', text})과 백엔드/시드본({role:'assistant', content}) 모두 대응.
function normalizeHistoryMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    if (typeof m === 'string') return { role: 'ai', time: '', text: m };
    if (!m || typeof m !== 'object') return { role: 'ai', time: '', text: '' };
    const raw = String(m.role ?? '').toLowerCase();
    const role = raw === 'user' || raw === 'human' ? 'user' : 'ai';
    const atts = Array.isArray(m.attachments) ? m.attachments : null;

    let text = m.text ?? m.content ?? m.message ?? '';
    // 이미지 첨부 메시지의 시스템 프리픽스([첨부 이미지 분석]…[사용자 메시지]) 제거
    if (atts?.length && typeof text === 'string' && text.includes('[사용자 메시지]')) {
      text = (text.split('[사용자 메시지]\n').pop() || '').trim();
      if (text === '(이미지만 첨부)') text = '';
    }

    // 백엔드 attachments → 화면 files 형식 (filename은 /chat/files 로 토큰 로드)
    const files = atts
      ? atts.map((a) => ({
          name: a.original_filename ?? a.filename ?? '첨부',
          isImage: a.file_type === 'image',
          filename: a.filename,
        }))
      : m.files;

    return {
      role,
      time: m.time ?? (m.timestamp ? isoToTime(m.timestamp) : ''),
      text,
      files,
    };
  });
}

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
              {msg.files.map((f, i) =>
                f.isImage && f.url ? (
                  <img key={i} src={f.url} alt={f.name} className="max-w-[120px] md:max-w-[160px] max-h-[100px] md:max-h-[120px] rounded-xl object-cover border border-white/30" />
                ) : f.filename ? (
                  <ChatAttachment key={i} file={f} />
                ) : (
                  <div key={i} className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 text-xs">
                    <span className="material-symbols-outlined text-base">attach_file</span>
                    <span className="max-w-[100px] truncate">{f.name}</span>
                  </div>
                )
              )}
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
  const { chatSessions, currentUser, deleteChatSession, addComplaint, refreshChatSessions } = useApp();

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

  // 진행 중 상담을 다른 탭 이동/새로고침 후에도 유지 (sessionStorage에서 1회 복원)
  const restoredRef = useRef(undefined);
  if (restoredRef.current === undefined) {
    try {
      const p = JSON.parse(sessionStorage.getItem(LIVE_CHAT_KEY) || 'null');
      restoredRef.current = p?.messages?.some((m) => m?.role === 'user') ? p : null;
    } catch { restoredRef.current = null; }
  }
  const restored = restoredRef.current;

  const [view, setView]                   = useState('chat');
  const [messages, setMessages]           = useState(() => restored?.messages ?? [makeGreeting()]);
  const [summary, setSummary]             = useState(restored?.summary ?? { category: null, dept: null, urgency: null });
  const [procedures, setProcedures]       = useState(restored?.procedures ?? null);
  const [cases, setCases]                 = useState(restored?.cases ?? []);
  const [imageNotes, setImageNotes]       = useState(restored?.imageNotes ?? []);
  const [liveSnapshot, setLiveSnapshot]   = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(restored?.currentSessionId ?? null);

  /* ── 민원 접수 모달 ── */
  const [submitModal, setSubmitModal] = useState({ open: false, title: '', content: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [submitDone, setSubmitDone]   = useState(null); // { title, category, dept } | null
  const [viewingHistory, setViewingHistory] = useState(null);
  const [input, setInput]                 = useState('');
  const [isTyping, setIsTyping]           = useState(false);
  const [typingStatus, setTypingStatus]   = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [filterStatus, setFilterStatus]   = useState('전체');
  const [isListening, setIsListening]     = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging]       = useState(false);
  const recognitionRef   = useRef(null);
  const isListeningRef   = useRef(false);
  const messagesEndRef   = useRef(null);
  const audioRef         = useRef(null);
  const textareaRef      = useRef(null);
  const imageInputRef    = useRef(null);
  const fileInputRef     = useRef(null);
  const autoSubmitDone   = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // 진행 중 상담 저장 (과거 내역 보는 중엔 보관해둔 스냅샷이 실제 현재 상담)
  useEffect(() => {
    const live = viewingHistory
      ? liveSnapshot
      : { messages, summary, procedures, cases, imageNotes, currentSessionId };
    try {
      if (live) sessionStorage.setItem(LIVE_CHAT_KEY, JSON.stringify(live));
    } catch { /* 용량 초과 등은 무시 */ }
  }, [messages, summary, procedures, cases, imageNotes, currentSessionId, viewingHistory, liveSnapshot]);

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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart  = () => setIsListening(true);
    recognition.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    // 무음 타임아웃으로 onend가 호출돼도 사용자가 중단하기 전까지 재시작
    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsListening(false);
      }
    };
    recognition.onerror = (e) => {
      console.error('[STT] error:', e.error);
      if (e.error !== 'no-speech') {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    isListeningRef.current = true;
    console.log('[STT] starting...');
    recognition.start();
  };
  const stopListening = () => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // 재생 중지 (백엔드 mp3 + 브라우저 음성 모두 정리)
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  // 브라우저 내장 음성 (백엔드 TTS 실패 시 폴백)
  const browserSpeak = (text) => {
    if (!window.speechSynthesis) { setIsSpeaking(false); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    const koVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (koVoice) utter.voice = koVoice;
    utter.onend   = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  // 답변을 마음결 목소리(백엔드 TTS)로 재생. 실패 시 브라우저 음성으로 폴백.
  const speak = async (text) => {
    if (isSpeaking) { stopSpeaking(); return; }
    setIsSpeaking(true);
    try {
      const url = await chatVoiceReplyApi(text);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; browserSpeak(text); };
      await audio.play();
    } catch {
      audioRef.current = null;
      browserSpeak(text);
    }
  };

  // 페이지 이탈 시 재생 중이던 음성 정리
  useEffect(() => () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const now = () => {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    return `${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  };

  const processFiles = async (fileList) => {
    const files = await Promise.all(
      Array.from(fileList).map(async (f) => {
        const isImage = f.type.startsWith('image/');
        // 이미지는 내역에도 남도록 data URL로 저장(자체 포함), 문서는 미리보기 URL 없음
        const url = isImage ? await fileToDataUrl(f) : null;
        return { name: f.name, size: f.size, type: f.type, url, isImage, file: f };
      })
    );
    setAttachedFiles((prev) => [...prev, ...files]);
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
    if (isListeningRef.current) stopListening();

    const sentFiles = attachedFiles;
    const userMsg = { role: 'user', time: now(), text, files: sentFiles };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);
    setTypingStatus('처리 중');

    try {
      const imageFile = sentFiles.find(f => f.isImage);
      // 주 이미지 외 나머지(문서·추가 이미지)는 /chat/file 로 세션에 먼저 저장 → 상담 내역에 표시
      const extraFiles = sentFiles.filter((f) => f !== imageFile && f.file instanceof File);
      let sid = currentSessionId;
      if (extraFiles.length) {
        setTypingStatus('파일 업로드 중');
        for (const f of extraFiles) {
          try { const r = await chatFileApi(f.file, '', sid); if (r?.session_id) sid = r.session_id; } catch { /* ignore */ }
        }
      }

      let result;
      if (imageFile?.file instanceof File) {
        setTypingStatus('이미지 분석 중');
        result = await chatImageApi(imageFile.file, text, sid);
      } else if (text) {
        setTypingStatus('답변 생성 중');
        result = await chatAskApi(text, sid);
      } else {
        // 텍스트 없이 문서만 첨부 → AI 답변 없이 접수 확인만
        result = { session_id: sid, answer: '파일을 첨부했습니다. 추가로 말씀하실 내용이 있으면 입력해 주세요.' };
      }

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
      // 정부24 절차 안내: 유사도 0.5 미만(백엔드 신뢰 기준)은 잡음이라 제외
      if (Array.isArray(md?.procedures)) {
        const relevant = md.procedures.filter((p) => (p?.similarity ?? 0) >= 0.5);
        if (relevant.length > 0) setProcedures(relevant);
      } else if (md?.procedures) {
        setProcedures(md.procedures);
      }
      // 유사 민원 사례 (있을 때만 갱신)
      if (Array.isArray(md?.cases) && md.cases.length > 0) {
        setCases(md.cases);
      }
      // 이미지 첨부 시 AI가 분석한 설명 저장 (민원 접수 내용 자동 채움용)
      if (result.image_description) {
        setImageNotes((prev) => [...prev, result.image_description]);
      }

      setMessages(prev => [...prev, { role: 'ai', time: now(), text: result.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', time: now(), text: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setIsTyping(false);
      setTypingStatus('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openHistory = async (h) => {
    if (!viewingHistory) snapshotLive(); // 진행 중 상담 보관 (덮이기 전에)
    setProcedures(null); // 과거 상담엔 절차 안내 데이터가 없음
    setCases([]);
    setImageNotes([]);
    if (!h.conversation && h.session_id) {
      try {
        const full = await getChatSessionApi(h.session_id);
        const conv = normalizeHistoryMessages(full.messages);
        setViewingHistory({ ...h, conversation: conv });
        setMessages(conv.length ? conv : [makeGreeting()]);
        setView('chat');
        return;
      } catch {}
    }
    setViewingHistory(h);
    const conv = normalizeHistoryMessages(h.conversation);
    setMessages(conv.length ? conv : [makeGreeting()]);
    setView('chat');
  };

  // 진행 중인 상담을 보관(과거 내역 열기 전) / 복원(현재 상담으로 돌아오기)
  const snapshotLive = () => {
    setLiveSnapshot({ messages, summary, procedures, cases, imageNotes, currentSessionId });
  };
  const returnToLive = () => {
    if (view === 'chat' && !viewingHistory) return; // 이미 현재 상담 화면
    if (liveSnapshot) {
      setMessages(liveSnapshot.messages);
      setSummary(liveSnapshot.summary);
      setProcedures(liveSnapshot.procedures);
      setCases(liveSnapshot.cases);
      setImageNotes(liveSnapshot.imageNotes);
      setCurrentSessionId(liveSnapshot.currentSessionId);
    }
    setViewingHistory(null);
    setView('chat');
  };

  const startNewChat = () => {
    // 백엔드가 세션을 자동 저장하므로 별도 저장 없이 현재 상담만 새로 시작.
    setCurrentSessionId(null);
    setViewingHistory(null);
    setMessages([makeGreeting()]);
    setSummary({ category: null, dept: null, urgency: null });
    setProcedures(null);
    setCases([]);
    setImageNotes([]);
    setLiveSnapshot(null);
    setView('chat');
    try { sessionStorage.removeItem(LIVE_CHAT_KEY); } catch { /* ignore */ }
    refreshChatSessions(); // 방금까지의 상담(백엔드 자동 저장분)을 목록에 반영
  };

  const openSubmitModal = async () => {
    // quick-reply 버튼 텍스트만 제외. (사진만 첨부한 메시지도 접수 가능하도록 텍스트 유무는 안 따짐)
    const userMsgs = messages.filter(
      (m) => m.role === 'user' && !(m.text?.trim() && QUICK_LABELS.includes(m.text.trim()))
    );
    if (userMsgs.length === 0) return;
    const textMsgs = userMsgs.filter((m) => m.text?.trim());
    const textContent = textMsgs.map((m) => m.text).join('\n\n').trim();
    const imgContent = imageNotes.join('\n\n').trim();
    // 텍스트가 있으면 텍스트를, 없으면 AI가 분석한 사진 설명을 민원 내용으로 채움
    const content = textContent || imgContent;
    const base = (textMsgs[0]?.text ?? imgContent).replace(/\n/g, ' ').trim();
    const title = base ? (base.length > 30 ? base.slice(0, 30) + '…' : base) : '사진 첨부 민원';

    // 세션 초안(draft-complaint)은 모달 열 때 '딱 한 번' 호출해 폼을 채운다.
    // 이후 유저가 편집하면 로컬 state만 바뀌고 API는 재호출하지 않음.
    if (currentSessionId) {
      setSubmitModal({ open: true, title: '', content: '', loading: true });
      try {
        const d = await createComplaintDraftApi(currentSessionId);
        setSubmitModal({ open: true, title: d?.title || title, content: d?.content || content, loading: false });
      } catch {
        setSubmitModal({ open: true, title, content, loading: false });
      }
    } else {
      setSubmitModal({ open: true, title, content, loading: false });
    }
  };

  const handleComplaintSubmit = async () => {
    if (!submitModal.title.trim() || submitModal.content.trim().length < MIN_COMPLAINT_LEN) return;
    setSubmitting(true);
    try {
      const newId = await addComplaint({
        title: submitModal.title.trim(),
        content: submitModal.content.trim(),
        category: summary.category ?? '기타',
      });
      // 채팅에 첨부한 파일들을 접수된 민원에 업로드 → 담당자에게 전달
      // (탭 이동/복원으로 File 객체가 사라진 이미지는 data URL에서 File을 재생성)
      const files = messages
        .flatMap((m) => m.files ?? [])
        .map((f) => {
          if (f.file instanceof File) return f.file;
          if (f.isImage && typeof f.url === 'string' && f.url.startsWith('data:')) return dataUrlToFile(f.url, f.name);
          return null;
        })
        .filter(Boolean);
      if (newId && files.length) {
        await Promise.all(files.map((f) => uploadAttachmentApi(newId, f).catch(() => {})));
      }
      setSubmitModal({ open: false, title: '', content: '' });
      const doneInfo = {
        title: submitModal.title.trim(),
        category: summary.category ?? '기타',
        dept: summary.dept ?? null,
      };
      setSubmitDone(doneInfo);
      // 세션을 '민원 접수'로 표시 + 목록 갱신 (세션은 백엔드가 관리)
      if (currentSessionId) {
        try { await updateChatSessionApi(currentSessionId, { status: '민원 접수' }); } catch { /* ignore */ }
      }
      refreshChatSessions();
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

  // 접수 모달에서 미리 보여줄 채팅 첨부파일
  const submitFiles = messages.flatMap((m) => m.files ?? []);

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
                  className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 md:px-3.5 md:py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm md:text-base">add_comment</span>
                  <span className="hidden sm:inline">새 상담 시작</span>
                </button>
                <button
                  onClick={returnToLive}
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 md:px-3.5 md:py-2 rounded-lg transition-colors ${
                    view === 'chat' && !viewingHistory ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm md:text-base">chat</span>
                  <span className="hidden sm:inline">현재 상담</span>
                </button>
                <button
                  onClick={() => { if (!viewingHistory) snapshotLive(); refreshChatSessions(); setView('history'); setViewingHistory(null); }}
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
                  <button
                    onClick={() => { setView('history'); setViewingHistory(null); }}
                    className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    상담 목록
                  </button>
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
                    <div className="flex flex-col items-start gap-1">
                      <div className="bg-white border border-outline-variant/40 rounded-2xl rounded-tl-sm px-3 py-2.5 md:px-4 md:py-3.5 shadow-sm flex items-center gap-1.5 w-fit">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      {typingStatus && (
                        <span className="text-[11px] md:text-xs text-primary/70 font-medium ml-1 animate-pulse">
                          {typingStatus}…
                        </span>
                      )}
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
        <aside className="hidden md:flex md:col-span-3 flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="shrink-0 bg-gradient-to-r from-primary/8 to-transparent px-5 py-4 border-b border-outline-variant/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">summarize</span>
                <h3 className="font-bold text-sm text-on-surface">상담 요약</h3>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
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
                <p className="text-[11px] text-on-surface-variant font-medium mb-2.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-primary">assignment</span>
                  행정 절차 안내
                </p>
                {procedures ? (
                  <ProceduresView data={procedures} />
                ) : (
                  <p className="text-xs text-on-surface-variant/50 text-center py-2">상담 내용 분석 후 표시됩니다.</p>
                )}
              </div>
              <div className="border-t border-outline-variant/50" />
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium mb-2.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-primary">history</span>
                  유사 민원 사례
                </p>
                {cases.length > 0 ? (
                  <div className="space-y-1.5">
                    {cases.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5 shrink-0">description</span>
                        <span className="text-on-surface break-words min-w-0 flex-1">{c.title ?? c.content ?? ''}</span>
                        {typeof c.similarity === 'number' && (
                          <span className="text-[10px] font-bold text-primary shrink-0 mt-0.5">{Math.round(c.similarity * 100)}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/50 text-center py-2">상담 내용 분석 후 표시됩니다.</p>
                )}
              </div>
            </div>
            <div className="shrink-0 p-4 border-t border-outline-variant/60">
              <button
                onClick={openSubmitModal}
                disabled={messages.filter(m => m.role === 'user').length === 0}
                className="w-full bg-primary text-white text-sm font-bold py-3 rounded-xl hover:brightness-95 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">edit_document</span>
                민원 접수하기
              </button>
            </div>
          </div>

          <div className="shrink-0 bg-gradient-to-br from-primary/8 to-[#3a7fd4]/5 rounded-2xl border border-primary/15 p-5">
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
              {submitModal.loading && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="material-symbols-outlined text-blue-500 text-base animate-spin">progress_activity</span>
                  <p className="text-xs font-bold text-blue-700">AI가 민원 초안을 작성하고 있습니다...</p>
                </div>
              )}
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
                {!submitModal.loading && submitModal.content.trim().length < MIN_COMPLAINT_LEN && (
                  <p className="text-[11px] text-error mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    민원 내용은 {MIN_COMPLAINT_LEN}자 이상 입력해 주세요. (현재 {submitModal.content.trim().length}자)
                  </p>
                )}
              </div>
              {summary.category && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-low/60 px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-base text-primary">category</span>
                  분류: <span className="font-bold text-primary">{summary.category}</span>
                  {summary.dept && <> · 담당: <span className="font-bold text-on-surface">{summary.dept}</span></>}
                </div>
              )}

              {/* 첨부파일 미리보기 */}
              {submitFiles.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">
                    첨부 파일 ({submitFiles.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {submitFiles.map((f, i) => (
                      f.isImage && f.url ? (
                        <img
                          key={i}
                          src={f.url}
                          alt={f.name}
                          className="w-16 h-16 rounded-lg object-cover border border-outline-variant"
                        />
                      ) : (
                        <div key={i} className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1.5 rounded-lg text-xs text-on-surface border border-outline-variant">
                          <span className="material-symbols-outlined text-sm text-primary">attach_file</span>
                          <span className="max-w-[100px] truncate">{f.name}</span>
                        </div>
                      )
                    ))}
                  </div>
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
                  disabled={submitting || submitModal.loading || !submitModal.title.trim() || submitModal.content.trim().length < MIN_COMPLAINT_LEN}
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
