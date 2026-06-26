import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp } from '../../store/AppContext';

const roleStyle = {
  citizen: { label: '일반 시민', bg: 'bg-blue-50',    text: 'text-blue-600',   icon: 'person' },
  staff:   { label: '담당자',    bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'badge' },
};

function AdminSettings() {
  const [activeTab, setActiveTab] = useState('category');
  const { users, approveUser, rejectUser, updateUserDept } = useApp();
  const DEPT_LIST = ['도로교통과', '환경위생과', '도시시설과', '교통행정과', '청소행정과', '공원녹지과', '상수도과', '사회복지과'];
  const [search, setSearch]           = useState('');
  const [toast, setToast]             = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleFilter, setRoleFilter]   = useState('citizen');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const handleApprove = (user) => { approveUser(user.id); showToast(`${user.name}님의 담당자 가입을 승인했습니다.`); };
  const handleReject  = (user) => { rejectUser(user.id);  showToast(`${user.name}님의 가입 신청을 거절했습니다.`); };

  const pending = users.filter((u) => u.status === 'pending');
  const active  = users.filter((u) => {
    if (u.status !== 'active') return false;
    if (u.role !== roleFilter) return false;
    return u.name.includes(search) || (u.email || '').includes(search);
  });

  const citizenCount = users.filter((u) => u.role === 'citizen' && u.status === 'active').length;
  const staffCount   = users.filter((u) => u.role === 'staff'   && u.status === 'active').length;

  const tabs = [
    { key: 'category', label: '민원 카테고리 설정' },
    { key: 'dept',     label: '조직 및 부서 관리' },
    { key: 'users',    label: '사용자 관리', badge: pending.length || null },
  ];

  const categories = [
    { name: '주거 및 환경', desc: '소음, 불법주차, 위생 관리 등', icon: 'corporate_fare' },
    { name: '교통 및 도로', desc: '신호등 고장, 도로 파손, 대중교통 불편', icon: 'directions_car' },
    { name: '복지 및 보건', desc: '취약계층 지원, 예방접종, 의료시설 관련', icon: 'medical_services' },
  ];

  const departments = [
    { name: '도로교통과', type: '교통/도로', members: 12, active: 34, status: '정상' },
    { name: '환경보전과', type: '환경/위생', members: 8,  active: 21, status: '정상' },
    { name: '사회복지과', type: '복지/보건', members: 15, active: 18, status: '정상' },
    { name: '교통지도과', type: '교통/주차', members: 10, active: 27, status: '정상' },
    { name: '공원녹지과', type: '환경/녹지', members: 6,  active: 9,  status: '점검중' },
  ];

  return (
    <AdminLayout pageTitle="시스템 관리" activeMenu="settings">

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      {/* 탭 */}
      <div className="mb-6 border-b border-outline-variant flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 px-2 text-sm font-bold whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.key
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 1: 민원 카테고리 설정 */}
      {activeTab === 'category' && (
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-outline-variant p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">민원 카테고리 목록</h3>
              <div className="flex items-center gap-3">
                <span className="bg-primary/5 text-primary px-3 py-1.5 rounded-lg text-xs font-bold">총 {categories.length}개 항목</span>
                <button className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">
                  <span className="material-symbols-outlined text-lg">add</span>
                  카테고리 추가
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {categories.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-5 border border-outline-variant rounded-2xl">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">{c.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface mb-1">{c.name}</h4>
                      <p className="text-sm text-on-surface-variant">{c.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">활성</span>
                    <button className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button className="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-outline-variant p-8">
            <h3 className="font-bold text-lg mb-6">AI 분석 가중치</h3>
            <div className="space-y-6">
              {[
                { label: '감정 분석 민감도',   value: 85 },
                { label: '긴급 키워드 탐지율', value: 92 },
                { label: '자동 분류 정확도',   value: 78 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">{item.label}</label>
                    <span className="text-xl font-bold text-primary">{item.value}%</span>
                  </div>
                  <div className="h-2.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 탭 2: 조직 및 부서 관리 */}
      {activeTab === 'dept' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '총 부서 수',   value: `${departments.length}개`,                              icon: 'corporate_fare' },
              { label: '전체 담당자',  value: `${departments.reduce((s, d) => s + d.members, 0)}명`, icon: 'group' },
              { label: '처리 중 민원', value: `${departments.reduce((s, d) => s + d.active, 0)}건`,  icon: 'pending_actions' },
              { label: '정상 운영',    value: `${departments.filter((d) => d.status === '정상').length}개`, icon: 'check_circle' },
            ].map((c) => (
              <div key={c.label} className="bg-white p-5 rounded-xl border border-outline-variant flex items-center gap-4">
                <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">{c.icon}</span>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold">{c.label}</p>
                  <p className="text-lg font-bold text-on-surface">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant">
              <h3 className="font-bold">부서 목록</h3>
              <button className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">
                <span className="material-symbols-outlined text-lg">add</span>
                부서 추가
              </button>
            </div>
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant">
                <tr>
                  {['부서명','담당 민원 유형','담당자 수','처리 중','상태','관리'].map((h) => (
                    <th key={h} className="px-6 py-3 text-xs font-bold text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {departments.map((d) => (
                  <tr key={d.name} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm text-on-surface">{d.name}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{d.type}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{d.members}명</td>
                    <td className="px-6 py-4 text-sm font-bold text-primary">{d.active}건</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        d.status === '정상' ? 'bg-emerald-50 text-emerald-600' : 'bg-error-container text-error'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button className="p-1.5 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 탭 3: 사용자 관리 */}
      {activeTab === 'users' && (
        <div className="flex gap-6 items-start">

          {/* ── 왼쪽: 목록 ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* 승인 대기 */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-on-surface">승인 대기</h2>
                  <span className="bg-amber-100 text-amber-600 font-bold text-xs px-2 py-0.5 rounded-full">{pending.length}건</span>
                </div>
                <div className="space-y-2">
                  {pending.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`bg-amber-50 border rounded-2xl px-5 py-4 flex items-center gap-4 cursor-pointer transition-all ${
                        selectedUser?.id === user.id ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-amber-700 text-lg">badge</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-on-surface">{user.name}
                          <span className="ml-2 text-xs font-normal text-on-surface-variant">{user.email}</span>
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">담당자 가입 신청 · {user.dept} · {user.joinedAt}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleReject(user); if (selectedUser?.id === user.id) setSelectedUser(null); }}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">거절</button>
                        <button onClick={(e) => { e.stopPropagation(); handleApprove(user); }}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:brightness-105 transition-all">승인</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 회원 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-on-surface">전체 회원</h2>
                <div className="relative w-52">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 이메일"
                    className="w-full h-9 pl-9 pr-3 border border-outline-variant rounded-xl text-xs outline-none focus:border-primary" />
                </div>
              </div>

              {/* 역할 탭 */}
              <div className="flex gap-6 border-b border-outline-variant mb-3">
                {[
                  { key: 'citizen', label: '일반',   count: citizenCount },
                  { key: 'staff',   label: '담당자', count: staffCount },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setRoleFilter(f.key); setSelectedUser(null); }}
                    className={`flex items-center gap-1.5 pb-2.5 px-1 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      roleFilter === f.key
                        ? 'text-primary border-primary'
                        : 'text-on-surface-variant border-transparent hover:text-on-surface'
                    }`}
                  >
                    {f.label}
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      roleFilter === f.key ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-slate-50 border-b border-outline-variant">
                    <tr>
                      {(roleFilter === 'staff'
                        ? ['이름', '전화번호', '이메일', '담당 부서', '가입일시', '부서 변경']
                        : ['이름', '전화번호', '이메일', '역할', '담당 부서', '가입일']
                      ).map((h) => (
                        <th key={h} className="text-center px-4 py-3 text-xs font-bold text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {active.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-on-surface-variant text-sm">사용자가 없습니다.</td></tr>
                    ) : active.map((user) => {
                      const r = roleStyle[user.role] ?? roleStyle.citizen;
                      const isSelected = selectedUser?.id === user.id;
                      if (roleFilter === 'staff') {
                        return (
                          <tr
                            key={user.id}
                            onClick={() => setSelectedUser(isSelected ? null : user)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-4 py-3.5 align-middle text-center font-bold text-on-surface truncate">{user.name}</td>
                            <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.phone || '-'}</td>
                            <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.email || '-'}</td>
                            <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.dept || '-'}</td>
                            <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.joinedAt}</td>
                            <td className="px-4 py-3.5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={user.dept || ''}
                                onChange={(e) => { updateUserDept(user.id, e.target.value); showToast(`${user.name}님의 부서가 '${e.target.value}'(으)로 변경되었습니다.`); }}
                                className="h-7 px-2 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none focus:border-primary"
                              >
                                {DEPT_LIST.map((d) => <option key={d}>{d}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr
                          key={user.id}
                          onClick={() => setSelectedUser(isSelected ? null : user)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3.5 align-middle text-center font-bold text-on-surface truncate">{user.name}</td>
                          <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.phone || '-'}</td>
                          <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.email || '-'}</td>
                          <td className="px-4 py-3.5 align-middle text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${r.bg} ${r.text}`}>
                              <span className="material-symbols-outlined text-xs">{r.icon}</span>{r.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.dept || '-'}</td>
                          <td className="px-4 py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.joinedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── 오른쪽: 상세 카드 ── */}
          <div className="w-72 shrink-0">
            {selectedUser ? (() => {
              const u = selectedUser;
              const r = roleStyle[u.role] ?? roleStyle.citizen;
              const isPending = u.status === 'pending';
              return (
                <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden sticky top-4">
                  {/* 카드 헤더 */}
                  <div className="bg-gradient-to-br from-primary/10 to-blue-50 px-6 pt-6 pb-5 flex flex-col items-center text-center relative">
                    <button onClick={() => setSelectedUser(null)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
                    </button>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isPending ? 'bg-amber-200' : r.bg}`}>
                      <span className={`material-symbols-outlined text-3xl ${isPending ? 'text-amber-700' : r.text}`}>{r.icon}</span>
                    </div>
                    <h3 className="font-bold text-on-surface text-base">{u.name}</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${r.bg} ${r.text}`}>{r.label}</span>
                      {isPending && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-600">승인 대기</span>}
                      {!isPending && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">활성</span>}
                    </div>
                  </div>

                  {/* 상세 정보 */}
                  <div className="px-5 py-4 space-y-3">
                    {[
                      { icon: 'call',           label: '전화번호', value: u.phone || '-' },
                      { icon: 'calendar_today', label: '가입일',   value: u.joinedAt },
                      { icon: 'corporate_fare', label: '담당 부서', value: u.dept || '-' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant text-base">{row.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-on-surface-variant">{row.label}</p>
                          <p className="text-xs font-bold text-on-surface truncate">{row.value}</p>
                        </div>
                      </div>
                    ))}

                    {u.deptGroup?.length > 0 && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant text-base">account_tree</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-on-surface-variant mb-1">담당 부서 그룹</p>
                          <div className="flex flex-wrap gap-1">
                            {u.deptGroup.map((d) => (
                              <span key={d} className="text-[10px] font-bold bg-primary/8 text-primary px-2 py-0.5 rounded-full">{d}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="px-5 pb-5 space-y-2 border-t border-outline-variant/60 pt-4">
                    {isPending ? (
                      <>
                        <button onClick={() => { handleApprove(u); setSelectedUser(null); }}
                          className="w-full bg-primary text-white text-xs font-bold py-2.5 rounded-xl hover:brightness-105 transition-all flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">check_circle</span>가입 승인
                        </button>
                        <button onClick={() => { handleReject(u); setSelectedUser(null); }}
                          className="w-full border border-red-200 text-red-600 text-xs font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">cancel</span>가입 거절
                        </button>
                      </>
                    ) : (
                      <button className="w-full border border-outline-variant text-on-surface-variant text-xs font-bold py-2.5 rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">lock_reset</span>비밀번호 초기화
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white rounded-2xl border border-outline-variant border-dashed p-8 flex flex-col items-center justify-center text-center gap-3">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">person_search</span>
                <p className="text-xs text-on-surface-variant">회원을 클릭하면<br />상세 정보가 표시됩니다.</p>
              </div>
            )}
          </div>

        </div>
      )}

    </AdminLayout>
  );
}

export default AdminSettings;
