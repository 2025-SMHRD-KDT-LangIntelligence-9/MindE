import { createContext, useContext, useState } from 'react';

/* 긴급도 공통 색상 */
export const URGENCY_STYLE = {
  '긴급': { bg: 'bg-red-50',     text: 'text-red-600',     icon: 'priority_high' },
  '보통': { bg: 'bg-orange-50',  text: 'text-orange-600',  icon: 'remove' },
  '낮음': { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'arrow_downward' },
};

/* 카테고리 공통 색상 */
export const CATEGORY_STYLE = {
  '도로/교통': { bg: 'bg-blue-50',    text: 'text-blue-600' },
  '시설/안전': { bg: 'bg-amber-50',   text: 'text-amber-600' },
  '환경/위생': { bg: 'bg-teal-50',    text: 'text-teal-600' },
  '시설/환경': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  '교통/주차': { bg: 'bg-purple-50',  text: 'text-purple-600' },
  '교통/안전': { bg: 'bg-orange-50',  text: 'text-orange-600' },
  '기타':      { bg: 'bg-slate-100',  text: 'text-slate-500' },
};

/* 부서 목록 (AdminUsers에서 권한 부여 시 사용) */
export const DEPT_OPTIONS = [
  { dept: '도로교통과', deptGroup: ['도로교통과', '교통행정과', '교통지도과'] },
  { dept: '환경위생과', deptGroup: ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'] },
  { dept: '도시시설과', deptGroup: ['도시시설과', '공원녹지과', '상수도과'] },
];

/* 담당자 계정 목록 (Login에서도 import해서 사용) */
export const STAFF_ACCOUNTS = [
  { email: 'road@test.com',  password: 'staff1', name: '김도로', dept: '도로교통과',
    deptGroup: ['도로교통과', '교통행정과', '교통지도과'] },
  { email: 'env@test.com',   password: 'staff2', name: '이환경', dept: '환경위생과',
    deptGroup: ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'] },
  { email: 'infra@test.com', password: 'staff3', name: '박시설', dept: '도시시설과',
    deptGroup: ['도시시설과', '공원녹지과', '상수도과', '도시시설과'] },
];

const AppContext = createContext(null);

/* ──────────────────────────────────────────────
   초기 민원 데이터 (모든 페이지가 공유)
────────────────────────────────────────────── */
const INITIAL_COMPLAINTS = [
  {
    id: 'C-2025-0042',
    title: '도로 파손으로 인한 차량 손상 보상 신청',
    content: '○○로 50번지 앞 도로 파손으로 차량 타이어가 손상되었습니다. 보상 절차 안내를 부탁드립니다.',
    category: '도로/교통',
    dept: '도로교통과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '처리 중',
    urgency: '긴급',
    receivedAt: '2025-05-20 10:24',
    updatedAt: '2025-05-20 10:30',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '도로파손_현장사진1.jpg', size: 2340000, type: 'image' },
      { name: '차량손상_견적서.pdf',    size: 580000,  type: 'pdf' },
    ],
  },
  {
    id: 'C-2025-0041',
    title: '보도블록 파손 정비 요청',
    content: '주민센터 앞 보도블록이 파손되어 보행 시 위험합니다.',
    category: '시설/안전',
    dept: '도시시설과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '접수',
    urgency: '보통',
    receivedAt: '2025-05-18 09:00',
    updatedAt: '2025-05-18 09:00',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '보도블록_파손현장.jpg', size: 1820000, type: 'image' },
    ],
  },
  {
    id: 'C-2025-0040',
    title: '불법 광고물 단속 요청',
    content: '건물 외벽에 허가되지 않은 광고물이 부착되어 있습니다.',
    category: '환경/위생',
    dept: '도시환경과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '완료',
    urgency: '낮음',
    receivedAt: '2025-05-16 14:00',
    updatedAt: '2025-05-17 11:00',
    memo: '현장 확인 후 철거 조치 완료.',
    reply: '해당 광고물에 대해 현장 확인 후 불법 광고물로 판정하여 즉시 철거 조치하였습니다. 향후 동일 장소에 재부착 시 과태료가 부과될 수 있음을 안내 드립니다.',
    replyDate: '2025-05-17',
    citizenFiles: [
      { name: '불법광고물_사진.jpg', size: 1450000, type: 'image' },
    ],
  },
  {
    id: 'C-2025-0039',
    title: '어린이 보호구역 안전시설 설치 요청',
    content: '초등학교 앞 횡단보도에 안전 펜스 설치가 필요합니다.',
    category: '도로/교통',
    dept: '교통행정과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '처리 중',
    urgency: '긴급',
    receivedAt: '2025-05-15 09:05',
    updatedAt: '2025-05-16 10:00',
    memo: '현장 사진 추가 제출 요청함.',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '횡단보도_현장.jpg',      size: 2100000, type: 'image' },
      { name: '안전시설_설치요청서.docx', size: 320000,  type: 'doc' },
    ],
  },
  {
    id: 'C-2025-0038',
    title: '쓰레기 무단 투기 신고',
    content: '○○골목 입구에 매일 밤 쓰레기 무단 투기가 발생합니다.',
    category: '환경/위생',
    dept: '청소행정과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '완료',
    urgency: '보통',
    receivedAt: '2025-05-13 19:48',
    updatedAt: '2025-05-14 13:00',
    memo: '',
    reply: '신고 접수 후 현장을 확인하여 CCTV 설치 및 경고문 부착 조치를 완료하였습니다. 지속적인 모니터링을 통해 재발 방지에 노력하겠습니다.',
    replyDate: '2025-05-14',
    citizenFiles: [
      { name: '무단투기_현장사진.jpg', size: 1760000, type: 'image' },
    ],
  },
  {
    id: 'C-2025-0037',
    title: '공원 내 가로등 고장 수리 요청',
    content: '○○공원 산책로 가로등이 일주일째 고장나 있습니다.',
    category: '시설/환경',
    dept: '공원녹지과',
    citizen: '홍길동',
    citizenId: 'citizen',
    status: '완료',
    urgency: '보통',
    receivedAt: '2025-05-11 11:30',
    updatedAt: '2025-05-12 16:00',
    memo: '',
    reply: '가로등 점검 결과 전구 및 안정기 불량으로 확인되어 2025-05-12 교체 완료하였습니다. 불편을 드려 죄송합니다.',
    replyDate: '2025-05-12',
    citizenFiles: [],
  },
  // 타 시민 민원 (staff/admin 화면에 표시)
  {
    id: 'C-2025-0036',
    title: '강남역 사거리 인근 도로 파손',
    content: '강남역 사거리 차도 파손으로 차량 사고 위험이 있습니다.',
    category: '도로/교통',
    dept: '도로교통과',
    citizen: '김마음',
    citizenId: 'other',
    status: '접수',
    urgency: '긴급',
    receivedAt: '2025-05-20 09:00',
    updatedAt: '2025-05-20 09:00',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '도로파손_현장.jpg', size: 2050000, type: 'image' },
    ],
  },
  {
    id: 'C-2025-0035',
    title: '공원 내 가로등 점등 불량 보수 요청',
    content: '공원 조명이 켜지지 않아 야간 안전 문제가 우려됩니다.',
    category: '시설/환경',
    dept: '도시녹지과',
    citizen: '이결',
    citizenId: 'other',
    status: '처리 중',
    urgency: '보통',
    receivedAt: '2025-05-20 08:30',
    updatedAt: '2025-05-20 10:00',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [],
  },
  {
    id: 'C-2025-0034',
    title: '불법 주정차 단속 구역 확대 건의',
    content: '저희 아파트 앞 도로에 매일 불법 주차 차량이 많습니다.',
    category: '교통/주차',
    dept: '교통지도과',
    citizen: '박행정',
    citizenId: 'other',
    status: '완료',
    urgency: '낮음',
    receivedAt: '2025-05-19 14:30',
    updatedAt: '2025-05-19 17:00',
    memo: '관할 교통과에 전달 완료.',
    reply: '단속 구역 확대를 검토 후 다음 달부터 시행 예정입니다.',
    replyDate: '2025-05-19',
    citizenFiles: [],
  },
  {
    id: 'C-2025-0033',
    title: '수도 누수 신고 및 긴급 수리 요청',
    content: '남산동 일대 갑작스러운 단수가 발생하였습니다.',
    category: '시설/안전',
    dept: '상수도과',
    citizen: '최민원',
    citizenId: 'other',
    status: '처리 중',
    urgency: '긴급',
    receivedAt: '2025-05-19 13:45',
    updatedAt: '2025-05-19 14:00',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '수도누수_현장영상.mp4', size: 8400000, type: 'video' },
    ],
  },
  {
    id: 'C-2025-0032',
    title: '보도블록 파손으로 인한 보행 불편 신고',
    content: '보도블록이 파손되어 보행자 안전사고 위험이 있습니다.',
    category: '시설/안전',
    dept: '도로교통과',
    citizen: '정시민',
    citizenId: 'other',
    status: '접수',
    urgency: '보통',
    receivedAt: '2025-05-18 11:20',
    updatedAt: '2025-05-18 11:20',
    memo: '',
    reply: null,
    replyDate: null,
    citizenFiles: [
      { name: '보도블록파손_사진.jpg', size: 1320000, type: 'image' },
    ],
  },
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 'N001',
    complaintId: 'C-2025-0042',
    title: '상태 변경',
    desc: '"도로 파손으로 인한 차량 손상 보상 신청" 민원이 처리 중으로 변경되었습니다.',
    icon: 'swap_horiz',
    color: 'text-amber-500',
    tag: '처리 중',
    time: '2시간 전',
    read: false,
  },
  {
    id: 'N002',
    complaintId: 'C-2025-0038',
    title: '처리 완료',
    desc: '"쓰레기 무단 투기 신고" 민원이 처리 완료되었습니다.',
    icon: 'check_circle',
    color: 'text-emerald-500',
    tag: '처리 완료',
    time: '1일 전',
    read: false,
  },
  {
    id: 'N003',
    complaintId: 'C-2025-0041',
    title: '접수 완료',
    desc: '"보도블록 파손 정비 요청" 민원이 접수되었습니다.',
    icon: 'inbox',
    color: 'text-primary',
    tag: '접수',
    time: '2일 전',
    read: true,
  },
];

/* ──────────────────────────────────────────────
   Provider
────────────────────────────────────────────── */
const INITIAL_USERS = [
  { id: 'u1', name: '홍길동',  email: 'user@test.com',  phone: '010-1234-5678', role: 'citizen', status: 'active',  dept: '',        deptGroup: [],                                                   joinedAt: '2025-01-15' },
  { id: 'u2', name: '김도로',  email: 'road@test.com',  phone: '010-2222-1111', role: 'staff',   status: 'active',  dept: '도로교통과', deptGroup: ['도로교통과', '교통행정과', '교통지도과'],            joinedAt: '2024-11-01' },
  { id: 'u3', name: '이환경',  email: 'env@test.com',   phone: '010-3333-2222', role: 'staff',   status: 'active',  dept: '환경위생과', deptGroup: ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'], joinedAt: '2024-11-01' },
  { id: 'u4', name: '박시설',  email: 'infra@test.com', phone: '010-4444-3333', role: 'staff',   status: 'active',  dept: '도시시설과', deptGroup: ['도시시설과', '공원녹지과', '상수도과'],              joinedAt: '2024-11-01' },
  { id: 'u5', name: '최대기',  email: 'wait@test.com',  phone: '010-5555-4444', role: 'staff',   status: 'pending', dept: '도로교통과', deptGroup: ['도로교통과', '교통행정과', '교통지도과'],            joinedAt: '2025-06-25' },
];

export function AppProvider({ children }) {
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState({
    role: 'guest', name: '', dept: '', deptGroup: [],
  });

  const login = (role, staffAccount = null) => {
    if (role === 'citizen') setCurrentUser({ role: 'citizen', name: '홍길동', dept: '', deptGroup: [] });
    else if (role === 'admin')  setCurrentUser({ role: 'admin',   name: '시스템 관리자', dept: '', deptGroup: [] });
    else if (role === 'staff' && staffAccount) {
      setCurrentUser({ role: 'staff', name: staffAccount.name, dept: staffAccount.dept, deptGroup: staffAccount.deptGroup });
    }
  };

  const logout = () => setCurrentUser({ role: 'guest', name: '', dept: '', deptGroup: [] });

  // 상태 변경 + 알림 생성
  const updateComplaintStatus = (id, newStatus, memo) => {
    const target = complaints.find((c) => c.id === id);
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: newStatus,
              memo: memo !== undefined ? memo : c.memo,
              updatedAt: new Date().toLocaleString('ko-KR'),
              ...(newStatus === '완료' ? {} : {}),
            }
          : c
      )
    );
    if (target) {
      const iconMap = { '완료': 'check_circle', '처리 중': 'swap_horiz', '반려': 'cancel', '보완 요청': 'edit_note' };
      const colorMap = { '완료': 'text-emerald-500', '처리 중': 'text-amber-500', '반려': 'text-red-500', '보완 요청': 'text-purple-500' };
      setNotifications((prev) => [
        {
          id: `N${Date.now()}`,
          complaintId: id,
          title: newStatus === '완료' ? '처리 완료' : '상태 변경',
          desc: `"${target.title}" 민원이 '${newStatus}'(으)로 변경되었습니다.`,
          icon: iconMap[newStatus] ?? 'swap_horiz',
          color: colorMap[newStatus] ?? 'text-primary',
          tag: newStatus,
          time: '방금 전',
          read: false,
        },
        ...prev,
      ]);
    }
  };

  // 담당 부서 변경
  const updateComplaintDept = (id, newDept) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dept: newDept } : c))
    );
  };

  // 메모만 저장 (상태 변경 없이)
  const saveMemo = (id, memo) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, memo } : c))
    );
  };

  // 담당자 공식 답변 등록 → 상태 자동 완료 처리
  const saveReply = (id, reply) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              reply,
              replyDate: new Date().toLocaleDateString('ko-KR'),
              status: '완료',
              updatedAt: new Date().toLocaleString('ko-KR'),
            }
          : c
      )
    );
    const target = complaints.find((c) => c.id === id);
    if (target) {
      setNotifications((prev) => [
        {
          id: `N${Date.now()}`,
          complaintId: id,
          title: '답변 등록',
          desc: `"${target.title}" 민원에 담당 부서 답변이 등록되었습니다.`,
          icon: 'mark_email_read',
          color: 'text-emerald-500',
          tag: '완료',
          time: '방금 전',
          read: false,
        },
        ...prev,
      ]);
    }
  };

  // 새 민원 접수 (시민이 챗봇/OCR로 제출)
  const addComplaint = ({ title, content, category }) => {
    const deptMap = {
      '도로/교통': '도로교통과',
      '시설/안전': '도시시설과',
      '환경/위생': '청소행정과',
      '시설/환경': '공원녹지과',
      '교통/주차': '교통지도과',
      '교통/안전': '교통행정과',
    };
    const newId = `C-2025-${String(Date.now()).slice(-4)}`;
    const newComplaint = {
      id: newId,
      title,
      content,
      category: category || '기타',
      dept: deptMap[category] ?? '민원처리과',
      citizen: '홍길동',
      citizenId: 'citizen',
      status: '접수',
      urgency: '보통',
      receivedAt: new Date().toLocaleString('ko-KR'),
      updatedAt: new Date().toLocaleString('ko-KR'),
      memo: '',
      reply: null,
      replyDate: null,
    };
    setComplaints((prev) => [newComplaint, ...prev]);
    setNotifications((prev) => [
      {
        id: `N${Date.now()}`,
        complaintId: newId,
        title: '접수 완료',
        desc: `"${title}" 민원이 정상적으로 접수되었습니다.`,
        icon: 'inbox',
        color: 'text-primary',
        tag: '접수',
        time: '방금 전',
        read: false,
      },
      ...prev,
    ]);
    return newId;
  };

  // 회원가입 (시민: 즉시 active / 담당자: pending 대기)
  const registerUser = ({ name, email, phone, role = 'citizen', dept = '', deptGroup = [] }) => {
    const newUser = {
      id: `u${Date.now()}`,
      name, email, phone,
      role, dept, deptGroup,
      status: role === 'staff' ? 'pending' : 'active',
      joinedAt: new Date().toLocaleDateString('ko-KR'),
    };
    setUsers((prev) => [...prev, newUser]);
  };

  // 담당자 가입 승인
  const approveUser = (userId) => {
    setUsers((prev) => prev.map((u) =>
      u.id === userId ? { ...u, status: 'active' } : u
    ));
  };

  // 가입 거절 (목록에서 제거)
  const rejectUser = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // 담당자 부서 변경
  const updateUserDept = (userId, newDept) => {
    setUsers((prev) => prev.map((u) =>
      u.id === userId ? { ...u, dept: newDept } : u
    ));
  };

  // 알림 읽음 처리
  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // 담당자 본인 부서 민원 (deptGroup 기반 필터)
  const myDeptComplaints = currentUser.role === 'staff'
    ? complaints.filter((c) => currentUser.deptGroup.includes(c.dept))
    : complaints;

  // 파생 통계 (computed)
  const stats = {
    total:      complaints.length,
    received:   complaints.filter((c) => c.status === '접수').length,
    inProgress: complaints.filter((c) => c.status === '처리 중' || c.status === '보완 요청').length,
    done:       complaints.filter((c) => c.status === '완료').length,
    rejected:   complaints.filter((c) => c.status === '반려').length,
    urgent:     complaints.filter((c) => c.urgency === '긴급').length,
    myComplaints:   complaints.filter((c) => c.citizenId === 'citizen'),
    urgentList:     complaints.filter((c) => c.urgency === '긴급'),
    unreadCount:    notifications.filter((n) => !n.read).length,
  };

  return (
    <AppContext.Provider value={{
      complaints,
      notifications,
      users,
      stats,
      currentUser,
      myDeptComplaints,
      login,
      logout,
      updateComplaintStatus,
      updateComplaintDept,
      saveMemo,
      saveReply,
      addComplaint,
      markAllRead,
      registerUser,
      approveUser,
      rejectUser,
      updateUserDept,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
