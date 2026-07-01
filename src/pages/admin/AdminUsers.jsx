import { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp } from '../../store/AppContext';
import { getDepartmentsApi } from '../../api/admin';

const roleStyle = {
  citizen: { label: '일반 시민', bg: 'bg-blue-50',    text: 'text-blue-600',   icon: 'person' },
  staff:   { label: '담당자',    bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'badge' },
};

function AdminUsers() {
  const { users, approveUser, rejectUser, updateUserDept } = useApp();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [pendingDepts, setPendingDepts] = useState({});
  const [editingDept, setEditingDept] = useState({});
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    getDepartmentsApi()
      .then((data) => setDepartments(data))
      .catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const findDept = (name) => departments.find((d) => d.name === name);

  const handleApprove = async (user) => {
    await approveUser(user.id);
    const deptName = pendingDepts[user.id] ?? '';
    const dept = findDept(deptName);
    if (dept) await updateUserDept(user.id, dept.department_id, dept.name);
    showToast(`${user.name}님의 담당자 가입을 승인했습니다.`);
  };

  const handleReject = (user) => {
    rejectUser(user.id);
    showToast(`${user.name}님의 가입 신청을 거절했습니다.`);
  };

  const handleDeptChange = async (user, deptName) => {
    const dept = findDept(deptName);
    if (!dept) return;
    await updateUserDept(user.id, dept.department_id, dept.name);
    setEditingDept((p) => ({ ...p, [user.id]: undefined }));
    showToast(`${user.name}님의 담당 부서가 변경되었습니다.`);
  };

  const pending = users.filter((u) => u.status === 'pending');
  const active  = users.filter((u) => u.status === 'active' && (
    u.name.includes(search) || u.email.includes(search)
  ));

  return (
    <AdminLayout pageTitle="사용자 관리" activeMenu="users">

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-3 md:space-y-6">

        {/* ── 승인 대기 섹션 ── */}
        {pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-on-surface">승인 대기</h2>
              <span className="bg-amber-100 text-amber-600 font-bold text-xs px-2 py-0.5 rounded-full">{pending.length}건</span>
            </div>
            <div className="space-y-2">
              {pending.map((user) => (
                <div key={user.id} className="bg-amber-50 border border-amber-200 rounded-2xl px-3 md:px-5 py-2 md:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-amber-700 text-lg">badge</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface">{user.name}
                      <span className="ml-2 text-xs font-normal text-on-surface-variant">{user.email}</span>
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">담당자 가입 신청 · {user.joinedAt}</p>
                  </div>
                  {/* 부서 선택 드롭다운 */}
                  <select
                    value={pendingDepts[user.id] ?? ''}
                    onChange={(e) => setPendingDepts((p) => ({ ...p, [user.id]: e.target.value }))}
                    className="h-8 px-2 text-xs border border-amber-300 rounded-lg bg-white outline-none focus:border-primary"
                  >
                    <option value="">부서 선택</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleReject(user)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleApprove(user)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:brightness-105 transition-all"
                    >
                      승인
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 전체 회원 섹션 ── */}
        <div>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-on-surface">전체 회원</h2>
              <div className="flex gap-2">
                <span className="bg-blue-50 text-blue-600 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  일반 {users.filter((u) => u.role === 'citizen' && u.status === 'active').length}명
                </span>
                <span className="bg-emerald-50 text-emerald-600 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  담당자 {users.filter((u) => u.role === 'staff' && u.status === 'active').length}명
                </span>
              </div>
            </div>
            <div className="relative w-56">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 이메일"
                className="w-full h-9 pl-9 pr-3 border border-outline-variant rounded-xl text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-outline-variant">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">이메일</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">전화번호</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">역할</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">담당 부서</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-on-surface-variant">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {active.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-on-surface-variant text-sm">사용자가 없습니다.</td>
                  </tr>
                ) : active.map((user) => {
                  const r = roleStyle[user.role] ?? roleStyle.citizen;
                  const isEditing = editingDept[user.id] !== undefined;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 md:px-5 py-2 md:py-3.5 font-bold text-on-surface">{user.name}</td>
                      <td className="px-3 md:px-5 py-2 md:py-3.5 text-on-surface-variant">{user.email || '-'}</td>
                      <td className="px-3 md:px-5 py-2 md:py-3.5 text-on-surface-variant">{user.phone || '-'}</td>
                      <td className="px-3 md:px-5 py-2 md:py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${r.bg} ${r.text}`}>
                          <span className="material-symbols-outlined text-xs">{r.icon}</span>
                          {r.label}
                        </span>
                      </td>
                      <td className="px-3 md:px-5 py-2 md:py-3.5">
                        {user.role === 'staff' ? (
                          isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editingDept[user.id]}
                                onChange={(e) => setEditingDept((p) => ({ ...p, [user.id]: e.target.value }))}
                                className="h-7 px-1.5 text-xs border border-primary rounded-lg outline-none"
                              >
                                <option value="">선택</option>
                                {departments.map((d) => (
                                  <option key={d.department_id} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                              <button onClick={() => handleDeptChange(user, editingDept[user.id])}
                                className="text-xs font-bold text-primary hover:underline">저장</button>
                              <button onClick={() => setEditingDept((p) => ({ ...p, [user.id]: undefined }))}
                                className="text-xs text-on-surface-variant hover:underline">취소</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingDept((p) => ({ ...p, [user.id]: user.dept ?? '' }))}
                              className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary group"
                            >
                              {user.dept || '미지정'}
                              <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-on-surface-variant">-</span>
                        )}
                      </td>
                      <td className="px-3 md:px-5 py-2 md:py-3.5 text-on-surface-variant text-xs">{user.joinedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

export default AdminUsers;
