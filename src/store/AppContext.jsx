import { createContext, useContext, useState, useEffect } from 'react';
import { getMeApi } from '../api/auth';
import { getComplaintsApi, getAllComplaintsApi, addComplaintApi, updateComplaintStatusApi, saveMemoApi, saveResponseApi, updateComplaintDeptApi } from '../api/complaints';
import { getNotificationsApi, markAllReadApi } from '../api/notifications';
import { getUsersApi, approveStaffApi, rejectStaffApi, updateUserDeptApi, deleteUserApi } from '../api/admin';
import { saveChatSessionApi, getChatSessionsApi, deleteChatSessionApi } from '../api/chat';

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
export const STAFF_ACCOUNTS = [];

const AppContext = createContext(null);

/* ──────────────────────────────────────────────
   초기 민원 데이터 (모든 페이지가 공유)
────────────────────────────────────────────── */
const INITIAL_COMPLAINTS = [];

const INITIAL_NOTIFICATIONS = [];

const INITIAL_CHAT_SESSIONS = [];

/* ──────────────────────────────────────────────
   Provider
────────────────────────────────────────────── */
const INITIAL_USERS = [];

export function AppProvider({ children }) {
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [chatSessions, setChatSessions] = useState(INITIAL_CHAT_SESSIONS);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [staffFiles, setStaffFiles] = useState({});
  const [currentUser, setCurrentUser] = useState({
    role: 'guest', name: '', dept: '', deptGroup: [],
  });

  // 앱 시작 시 토큰 있으면 세션 복원
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    getMeApi()
      .then((me) => {
        const type = me.user_type;
        if (type === 'citizen') {
          setCurrentUser({ role: 'citizen', id: String(me.user_id), name: me.name, email: me.email, phone: me.phone ?? '', dept: '', deptGroup: [] });
        } else if (type === 'admin') {
          setCurrentUser({ role: 'admin', name: me.name, dept: '', deptGroup: [] });
        } else if (type === 'staff') {
          setCurrentUser({ role: 'staff', name: me.name, dept: me.dept ?? '', deptGroup: me.deptGroup ?? [] });
        }
      })
      .catch(() => localStorage.removeItem('token'));
  }, []);

  // 로그인 후 민원·알림 API에서 로드 (staff/admin은 전체 목록, citizen은 본인 목록)
  useEffect(() => {
    if (currentUser.role === 'guest') return;
    const fetchComplaints = currentUser.role === 'citizen'
      ? getComplaintsApi
      : getAllComplaintsApi;
    fetchComplaints().then(setComplaints).catch(() => {});
    getNotificationsApi().then(setNotifications).catch(() => {});
    if (currentUser.role === 'admin') {
      getUsersApi().then(setUsers).catch(() => {});
    }
    if (currentUser.role === 'citizen') {
      getChatSessionsApi().then((data) => {
        setChatSessions(data.map((s) => ({
          id: `session-${s.session_id}`,
          session_id: s.session_id,
          title: s.title,
          preview: '',
          date: new Date(s.created_at).toLocaleDateString('ko-KR'),
          time: '',
          status: s.status,
          category: '기타',
          messages: 0,
          conversation: null,
        })));
      }).catch(() => {});
    }
  }, [currentUser.role]);

  const login = (role, userInfo = null) => {
    if (role === 'citizen') setCurrentUser({ role: 'citizen', id: userInfo?.id || '', name: userInfo?.name || '', email: userInfo?.email || '', phone: userInfo?.phone || '', dept: '', deptGroup: [] });
    else if (role === 'admin')  setCurrentUser({ role: 'admin', name: userInfo?.name || '시스템 관리자', dept: '', deptGroup: [] });
    else if (role === 'staff' && userInfo) {
      setCurrentUser({ role: 'staff', name: userInfo.name, dept: userInfo.dept, deptGroup: userInfo.deptGroup ?? [] });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser({ role: 'guest', name: '', dept: '', deptGroup: [] });
  };

  const updateCurrentUser = (updates) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
  };

  // 상태 변경 + 알림 생성
  const updateComplaintStatus = async (id, newStatus, memo) => {
    try {
      await updateComplaintStatusApi(id, newStatus, memo || null);
    } catch {
      // 백엔드 실패해도 로컬 상태는 업데이트
    }
    const target = complaints.find((c) => c.id === id);
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: newStatus,
              memo: memo !== undefined ? memo : c.memo,
              updatedAt: new Date().toLocaleString('ko-KR'),
            }
          : c
      )
    );
    if (target) {
      const iconMap = { '완료': 'check_circle', '처리 중': 'swap_horiz', '반려': 'cancel', '보완 요청': 'edit_note', '배정': 'person_add', '답변완료': 'mark_email_read' };
      const colorMap = { '완료': 'text-emerald-500', '처리 중': 'text-amber-500', '반려': 'text-red-500', '보완 요청': 'text-purple-500', '배정': 'text-indigo-500', '답변완료': 'text-teal-500' };
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
  const updateComplaintDept = async (id, departmentId, deptName) => {
    try {
      await updateComplaintDeptApi(id, departmentId);
    } catch {}
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dept: deptName } : c))
    );
  };

  // 메모만 저장 (상태 변경 없이)
  const saveMemo = async (id, memo) => {
    try {
      await saveMemoApi(id, memo);
    } catch {}
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, memo } : c))
    );
  };

  // 담당자 공식 답변 등록 (상태 변경 없음 - 상태는 민원처리 버튼으로 별도 변경)
  const saveReply = async (id, reply) => {
    try {
      await saveResponseApi(id, reply);
    } catch {}
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
  const addComplaint = async ({ title, content, category }) => {
    try {
      const result = await addComplaintApi({ title, content, category });
      setComplaints((prev) => [result, ...prev]);
      setNotifications((prev) => [
        {
          id: `N${Date.now()}`,
          complaintId: result.id,
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
      return result.id;
    } catch {
      // 백엔드 연결 실패 시 로컬 폴백
      const deptMap = { '도로/교통': '도로교통과', '시설/안전': '도시시설과', '환경/위생': '청소행정과', '시설/환경': '공원녹지과', '교통/주차': '교통지도과', '교통/안전': '교통행정과' };
      const newId = `C-2025-${String(Date.now()).slice(-4)}`;
      const newComplaint = {
        id: newId, title, content,
        category: category || '기타',
        dept: deptMap[category] ?? '민원처리과',
        citizen: currentUser.name || '익명',
        citizenId: currentUser.id || 'citizen',
        status: '접수', urgency: '보통',
        receivedAt: new Date().toLocaleString('ko-KR'),
        updatedAt: new Date().toLocaleString('ko-KR'),
        memo: '', reply: null, replyDate: null, citizenFiles: [],
      };
      setComplaints((prev) => [newComplaint, ...prev]);
      setNotifications((prev) => [{ id: `N${Date.now()}`, complaintId: newId, title: '접수 완료', desc: `"${title}" 민원이 정상적으로 접수되었습니다.`, icon: 'inbox', color: 'text-primary', tag: '접수', time: '방금 전', read: false }, ...prev]);
      return newId;
    }
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
  const approveUser = async (userId) => {
    try {
      await approveStaffApi(userId);
    } catch {}
    setUsers((prev) => prev.map((u) =>
      u.id === userId ? { ...u, status: 'active' } : u
    ));
  };

  // 가입 거절 (목록에서 제거)
  const rejectUser = async (userId) => {
    try {
      await rejectStaffApi(userId);
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // 관리자가 회원 강제 탈퇴
  const deleteUser = async (userId) => {
    try {
      await deleteUserApi(userId);
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // 담당자 부서 변경
  const updateUserDept = async (userId, departmentId, deptName) => {
    try {
      await updateUserDeptApi(userId, departmentId);
    } catch {}
    setUsers((prev) => prev.map((u) =>
      u.id === userId ? { ...u, dept: deptName, departmentId } : u
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

  // 상담 세션 저장 (챗봇)
  const saveChatSession = async (session) => {
    setChatSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
    try {
      await saveChatSessionApi(session);
    } catch {}
  };

  const deleteChatSession = async (sessionId, id) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    try { await deleteChatSessionApi(sessionId); } catch {}
  };

  // 알림 읽음 처리
  const markAllRead = async () => {
    try {
      await markAllReadApi();
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // 담당자 본인 부서 민원 (deptGroup 기반 필터)
  // deptGroup이 빈 배열이면 백엔드가 부서 정보를 아직 안 내려준 것이므로 전체 표시
  const myDeptComplaints = currentUser.role === 'staff'
    ? (currentUser.deptGroup.length > 0
        ? complaints.filter((c) => currentUser.deptGroup.includes(c.dept))
        : complaints)
    : complaints;

  // 파생 통계 (computed)
  const stats = {
    total:      complaints.length,
    received:   complaints.filter((c) => c.status === '접수').length,
    assigned:   complaints.filter((c) => c.status === '배정').length,
    inProgress: complaints.filter((c) => ['배정', '처리 중', '보완 요청', '답변완료'].includes(c.status)).length,
    done:       complaints.filter((c) => c.status === '완료').length,
    rejected:   complaints.filter((c) => c.status === '반려').length,
    urgent:     complaints.filter((c) => c.urgency === '긴급').length,
    myComplaints:   complaints.filter((c) => c.citizenId === (currentUser.id || 'citizen')),
    urgentList:     complaints.filter((c) => c.urgency === '긴급'),
    unreadCount:    notifications.filter((n) => !n.read).length,
  };

  return (
    <AppContext.Provider value={{
      complaints,
      notifications,
      chatSessions,
      users,
      staffFiles,
      stats,
      currentUser,
      myDeptComplaints,
      login,
      logout,
      updateCurrentUser,
      updateComplaintStatus,
      updateComplaintDept,
      saveMemo,
      saveReply,
      addComplaint,
      saveChatSession,
      deleteChatSession,
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
