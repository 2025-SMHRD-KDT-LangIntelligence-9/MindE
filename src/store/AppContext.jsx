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
  { email: 'road@test.com',  name: '김도로', dept: '도로교통과',
    deptGroup: ['도로교통과', '교통행정과', '교통지도과'] },
  { email: 'env@test.com',   name: '이환경', dept: '환경위생과',
    deptGroup: ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'] },
  { email: 'infra@test.com', name: '박시설', dept: '도시시설과',
    deptGroup: ['도시시설과', '공원녹지과', '상수도과', '도시시설과'] },
];

const AppContext = createContext(null);

/* ──────────────────────────────────────────────
   초기 민원 데이터 (모든 페이지가 공유)
────────────────────────────────────────────── */
const INITIAL_COMPLAINTS = [];

const INITIAL_NOTIFICATIONS = [];

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
  const [staffFiles, setStaffFiles] = useState({});
  const [currentUser, setCurrentUser] = useState({
    role: 'guest', name: '', dept: '', deptGroup: [],
  });

  const login = (role, staffAccount = null) => {
    if (role === 'citizen') setCurrentUser({ role: 'citizen', name: '', dept: '', deptGroup: [] });
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

  // 담당자 공식 답변 등록 (상태 변경 없음 - 상태는 민원처리 버튼으로 별도 변경)
  const saveReply = (id, reply) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              reply,
              replyDate: new Date().toLocaleDateString('ko-KR'),
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
      citizenFiles: [],
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

  // 관리자가 회원 강제 탈퇴
  const deleteUser = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // 담당자 부서 변경
  const updateUserDept = (userId, newDept) => {
    const deptGroupMap = {
      '도로교통과': ['도로교통과', '교통행정과', '교통지도과'],
      '교통행정과': ['도로교통과', '교통행정과', '교통지도과'],
      '교통지도과': ['도로교통과', '교통행정과', '교통지도과'],
      '환경위생과': ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'],
      '도시환경과': ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'],
      '청소행정과': ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'],
      '도시녹지과': ['도시환경과', '청소행정과', '도시녹지과', '환경위생과'],
      '도시시설과': ['도시시설과', '공원녹지과', '상수도과'],
      '공원녹지과': ['도시시설과', '공원녹지과', '상수도과'],
      '상수도과':   ['도시시설과', '공원녹지과', '상수도과'],
    };
    setUsers((prev) => prev.map((u) =>
      u.id === userId
        ? { ...u, dept: newDept, deptGroup: deptGroupMap[newDept] ?? [newDept] }
        : u
    ));
  };

  // 담당자 첨부파일 추가 (objectURL 생성 후 메타데이터 저장)
  const addStaffFile = (complaintId, file) => {
    const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setStaffFiles((prev) => ({
      ...prev,
      [complaintId]: [...(prev[complaintId] ?? []), { name: file.name, size: file.size, type: file.type, url }],
    }));
  };

  // 담당자 첨부파일 삭제
  const removeStaffFile = (complaintId, index) => {
    setStaffFiles((prev) => {
      const files = prev[complaintId] ?? [];
      const target = files[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return { ...prev, [complaintId]: files.filter((_, i) => i !== index) };
    });
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
      staffFiles,
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
      deleteUser,
      updateUserDept,
      addStaffFile,
      removeStaffFile,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
