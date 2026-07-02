import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useApp } from '../../store/AppContext';
import { getDepartmentsApi, getCategoriesApi, createCategoryApi, updateCategoryApi, deleteCategoryApi, createDepartmentApi, updateDepartmentApi, deleteDepartmentApi } from '../../api/admin';

const roleStyle = {
  citizen: { label: '일반 시민', bg: 'bg-blue-50',    text: 'text-blue-600',   icon: 'person' },
  staff:   { label: '담당자',    bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'badge' },
};

const ICON_OPTIONS = ['corporate_fare','directions_car','medical_services','park','water_drop','recycling','construction','school','local_fire_department','groups'];

function AdminSettings() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('category');
  const { users, approveUser, rejectUser, deleteUser, updateUserDept } = useApp();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const [search, setSearch]             = useState('');
  const [toast, setToast]               = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleFilter, setRoleFilter]     = useState('citizen');

  // 카테고리 state
  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState({ open: false, mode: 'add', idx: null, category_id: null, name: '', desc: '', icon: 'corporate_fare', department_id: '' });

  // 카테고리-부서 매핑 (백엔드 미지원 → localStorage 임시 저장)
  const [catDeptMap, setCatDeptMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('minde_catDeptMap') || '{}'); } catch { return {}; }
  });
  const updateCatDeptMap = (catId, deptId) => {
    const next = deptId
      ? { ...catDeptMap, [String(catId)]: String(deptId) }
      : Object.fromEntries(Object.entries(catDeptMap).filter(([k]) => k !== String(catId)));
    setCatDeptMap(next);
    localStorage.setItem('minde_catDeptMap', JSON.stringify(next));
  };

  // 부서 state
  const [departments, setDepartments] = useState([]);
  useEffect(() => {
    getDepartmentsApi()
      .then((data) => setDepartments(data.map((d) => ({
        department_id: d.department_id,
        name: d.name,
        type: '',
        members: 0,
        active: 0,
        status: '정상',
      }))))
      .catch(() => {});
    getCategoriesApi()
      .then((data) => setCategories(data.map((c) => ({
        category_id: c.category_id,
        name: c.name,
        desc: '',
        icon: 'corporate_fare',
        department_id: c.department_id ?? '',
        department_name: c.department_name ?? '',
      }))))
      .catch(() => {});
  }, []);
  const [deptModal, setDeptModal] = useState({ open: false, mode: 'add', idx: null, department_id: null, name: '', type: '', status: '정상' });

  // 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', idx: null, id: null, label: '' });

  // 비밀번호 초기화 확인 모달
  const [pwResetModal, setPwResetModal] = useState({ open: false, user: null });

  // 회원탈퇴 확인 모달
  const [withdrawModal, setWithdrawModal] = useState({ open: false, user: null });

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

  /* ── 카테고리 핸들러 ── */
  const openCatAdd  = () => setCatModal({ open: true, mode: 'add', idx: null, category_id: null, name: '', desc: '', icon: 'corporate_fare', department_id: '' });
  const openCatEdit = (c, i) => setCatModal({ open: true, mode: 'edit', idx: i, category_id: c.category_id, name: c.name, desc: c.desc, icon: c.icon, department_id: catDeptMap[String(c.category_id)] || c.department_id || '' });
  const saveCat = async () => {
    if (!catModal.name.trim()) return;
    const dept = departments.find((d) => String(d.department_id) === String(catModal.department_id));
    try {
      if (catModal.mode === 'add') {
        const res = await createCategoryApi(catModal.name.trim());
        const entry = { category_id: res.category_id, name: res.name, desc: catModal.desc.trim(), icon: catModal.icon, department_id: catModal.department_id, department_name: dept?.name ?? '' };
        setCategories((prev) => [...prev, entry]);
        if (catModal.department_id) updateCatDeptMap(res.category_id, catModal.department_id);
      } else {
        await updateCategoryApi(catModal.category_id, catModal.name.trim());
        const entry = { category_id: catModal.category_id, name: catModal.name.trim(), desc: catModal.desc.trim(), icon: catModal.icon, department_id: catModal.department_id, department_name: dept?.name ?? '' };
        setCategories((prev) => prev.map((c, i) => i === catModal.idx ? entry : c));
        updateCatDeptMap(catModal.category_id, catModal.department_id);
      }
      showToast(catModal.mode === 'add' ? '카테고리가 추가되었습니다.' : '카테고리가 수정되었습니다.');
      setCatModal((m) => ({ ...m, open: false }));
    } catch {
      showToast('저장 중 오류가 발생했습니다.');
    }
  };

  /* ── 부서 핸들러 ── */
  const openDeptAdd  = () => setDeptModal({ open: true, mode: 'add', idx: null, department_id: null, name: '', type: '', status: '정상' });
  const openDeptEdit = (d, i) => setDeptModal({ open: true, mode: 'edit', idx: i, department_id: d.department_id, name: d.name, type: d.type || '', status: d.status || '정상' });
  const saveDept = async () => {
    if (!deptModal.name.trim()) return;
    try {
      if (deptModal.mode === 'add') {
        const res = await createDepartmentApi(deptModal.name.trim());
        const entry = { department_id: res.department_id, name: res.name, type: deptModal.type.trim(), members: 0, active: 0, status: deptModal.status };
        setDepartments((prev) => [...prev, entry]);
      } else {
        await updateDepartmentApi(deptModal.department_id, deptModal.name.trim());
        setDepartments((prev) => prev.map((d, i) => i === deptModal.idx ? { ...d, name: deptModal.name.trim(), type: deptModal.type.trim(), status: deptModal.status } : d));
      }
      showToast(deptModal.mode === 'add' ? '부서가 추가되었습니다.' : '부서 정보가 수정되었습니다.');
      setDeptModal((m) => ({ ...m, open: false }));
    } catch {
      showToast('저장 중 오류가 발생했습니다.');
    }
  };

  /* ── 삭제 핸들러 ── */
  const confirmDelete = async () => {
    try {
      if (deleteConfirm.type === 'category') {
        await deleteCategoryApi(deleteConfirm.id);
        setCategories((prev) => prev.filter((_, i) => i !== deleteConfirm.idx));
        updateCatDeptMap(deleteConfirm.id, '');
      }
      if (deleteConfirm.type === 'dept') {
        await deleteDepartmentApi(deleteConfirm.id);
        setDepartments((prev) => prev.filter((_, i) => i !== deleteConfirm.idx));
      }
      showToast(`'${deleteConfirm.label}'이(가) 삭제되었습니다.`);
    } catch (err) {
      const msg = err?.response?.data?.detail ?? '삭제 중 오류가 발생했습니다.';
      showToast(msg);
    }
    setDeleteConfirm({ open: false, type: '', idx: null, id: null, label: '' });
  };

  return (
    <AdminLayout pageTitle="시스템 관리" activeMenu="settings">

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{toast}
        </div>
      )}

      {/* 카테고리 추가/수정 모달 */}
      {catModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setCatModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-5">{catModal.mode === 'add' ? '카테고리 추가' : '카테고리 수정'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">카테고리명 *</label>
                <input value={catModal.name} onChange={(e) => setCatModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="예: 교통 및 도로"
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">설명</label>
                <input value={catModal.desc} onChange={(e) => setCatModal((m) => ({ ...m, desc: e.target.value }))}
                  placeholder="예: 신호등 고장, 도로 파손 등"
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">담당 부서</label>
                <select value={catModal.department_id} onChange={(e) => setCatModal((m) => ({ ...m, department_id: e.target.value }))}
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary bg-white">
                  <option value="">부서 선택</option>
                  {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-2 block">아이콘</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((ic) => (
                    <button key={ic} onClick={() => setCatModal((m) => ({ ...m, icon: ic }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${catModal.icon === ic ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10'}`}>
                      <span className="material-symbols-outlined text-lg">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setCatModal((m) => ({ ...m, open: false }))}
                className="flex-1 h-10 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">취소</button>
              <button onClick={saveCat}
                className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 transition-all">
                {catModal.mode === 'add' ? '추가' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 부서 추가/수정 모달 */}
      {deptModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDeptModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-5">{deptModal.mode === 'add' ? '부서 추가' : '부서 수정'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">부서명 *</label>
                <input value={deptModal.name} onChange={(e) => setDeptModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="예: 도로교통과"
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">운영 상태</label>
                <select value={deptModal.status} onChange={(e) => setDeptModal((m) => ({ ...m, status: e.target.value }))}
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl text-sm outline-none focus:border-primary bg-white">
                  <option>정상</option>
                  <option>점검중</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setDeptModal((m) => ({ ...m, open: false }))}
                className="flex-1 h-10 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">취소</button>
              <button onClick={saveDept}
                className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 transition-all">
                {deptModal.mode === 'add' ? '추가' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm({ open: false, type: '', idx: null, id: null, label: '' })}>
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">delete</span>
            </div>
            <h3 className="font-bold text-base mb-1">정말 삭제하시겠습니까?</h3>
            <p className="text-sm text-on-surface-variant mb-6">'{deleteConfirm.label}'을(를) 삭제하면 복구할 수 없습니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm({ open: false, type: '', idx: null, id: null, label: '' })}
                className="flex-1 h-10 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">취소</button>
              <button onClick={confirmDelete}
                className="flex-1 h-10 rounded-xl bg-error text-white text-sm font-bold hover:brightness-105 transition-all">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 초기화 확인 모달 */}
      {pwResetModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setPwResetModal({ open: false, user: null })}>
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-amber-500 text-2xl">lock_reset</span>
            </div>
            <h3 className="font-bold text-base mb-1">비밀번호를 초기화하시겠습니까?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-bold text-on-surface">{pwResetModal.user?.name}</span>님의 비밀번호가 임시 비밀번호로 변경됩니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPwResetModal({ open: false, user: null })}
                className="flex-1 h-10 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">취소</button>
              <button onClick={() => { showToast(`${pwResetModal.user?.name}님의 비밀번호가 초기화되었습니다.`); setPwResetModal({ open: false, user: null }); }}
                className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-sm font-bold hover:brightness-105 transition-all">초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 회원탈퇴 확인 모달 */}
      {withdrawModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setWithdrawModal({ open: false, user: null })}>
          <div className="bg-white rounded-2xl shadow-2xl w-[380px] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">person_remove</span>
            </div>
            <h3 className="font-bold text-base mb-1">회원을 탈퇴시키겠습니까?</h3>
            <p className="text-sm text-on-surface-variant mb-1">
              <span className="font-bold text-on-surface">{withdrawModal.user?.name}</span>님의 계정이 즉시 삭제됩니다.
            </p>
            <p className="text-xs text-error mb-6">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setWithdrawModal({ open: false, user: null })}
                className="flex-1 h-10 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">취소</button>
              <button onClick={() => {
                deleteUser(withdrawModal.user.id);
                showToast(`${withdrawModal.user.name}님의 계정이 탈퇴 처리되었습니다.`);
                setWithdrawModal({ open: false, user: null });
                setSelectedUser(null);
              }}
                className="flex-1 h-10 rounded-xl bg-error text-white text-sm font-bold hover:brightness-105 transition-all">탈퇴 처리</button>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="mb-3 md:mb-6 border-b border-outline-variant flex gap-4 md:gap-8">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-2 md:pb-4 px-1 md:px-2 text-xs md:text-sm font-bold whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
            }`}>
            {tab.label}
            {tab.badge && <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* 탭 1: 민원 카테고리 설정 */}
      {activeTab === 'category' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
          <section className="col-span-1 lg:col-span-8 bg-white rounded-2xl border border-outline-variant p-4 md:p-8">
            <div className="flex justify-between items-center mb-3 md:mb-6">
              <h3 className="font-bold text-base md:text-lg">민원 카테고리 목록</h3>
              <div className="flex items-center gap-3">
                <span className="bg-primary/5 text-primary px-3 py-1.5 rounded-lg text-xs font-bold">총 {categories.length}개 항목</span>
                <button onClick={openCatAdd}
                  className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-105 transition-all">
                  <span className="material-symbols-outlined text-lg">add</span>카테고리 추가
                </button>
              </div>
            </div>
            <div className="space-y-2 md:space-y-4">
              {categories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 md:py-12 text-on-surface-variant/50 gap-2">
                  <span className="material-symbols-outlined text-4xl">category</span>
                  <p className="text-sm">등록된 카테고리가 없습니다. 추가해 주세요.</p>
                </div>
              )}
              {categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 md:p-5 border border-outline-variant rounded-2xl">
                  <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">{c.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface mb-1">{c.name}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.desc && <p className="text-sm text-on-surface-variant">{c.desc}</p>}
                        {(() => {
                          const deptId = catDeptMap[String(c.category_id)] || String(c.department_id || '');
                          const dept = departments.find((d) => String(d.department_id) === deptId);
                          const name = dept?.name || c.department_name;
                          return name ? <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">{name}</span> : null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">활성</span>
                    <button onClick={() => openCatEdit(c, i)}
                      className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onClick={() => setDeleteConfirm({ open: true, type: 'category', idx: i, id: c.category_id, label: c.name })}
                      className="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="col-span-1 lg:col-span-4 bg-white rounded-2xl border border-outline-variant p-4 md:p-8">
            <h3 className="font-bold text-base md:text-lg mb-3 md:mb-6">AI 분석 가중치</h3>
            <div className="space-y-3 md:space-y-6">
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
        <div className="space-y-3 md:space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: '총 부서 수',   value: `${departments.length}개`,                              icon: 'corporate_fare' },
              { label: '전체 담당자',  value: `${departments.reduce((s, d) => s + d.members, 0)}명`, icon: 'group' },
              { label: '처리 중 민원', value: `${departments.reduce((s, d) => s + d.active, 0)}건`,  icon: 'pending_actions' },
              { label: '정상 운영',    value: `${departments.filter((d) => d.status === '정상').length}개`, icon: 'check_circle' },
            ].map((c) => (
              <div key={c.label} className="bg-white p-3 md:p-5 rounded-xl border border-outline-variant flex items-center gap-2 md:gap-4">
                <div className="w-8 h-8 md:w-11 md:h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
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
            <div className="flex justify-between items-center px-3 md:px-6 py-3 md:py-4 border-b border-outline-variant">
              <h3 className="font-bold">부서 목록</h3>
              <button onClick={openDeptAdd}
                className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-105 transition-all">
                <span className="material-symbols-outlined text-lg">add</span>부서 추가
              </button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant">
                <tr>
                  {['부서명','담당 민원 유형','담당자 수','처리 중','상태','관리'].map((h) => (
                    <th key={h} className="px-6 py-3 text-xs font-bold text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {departments.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-on-surface-variant text-sm">등록된 부서가 없습니다.</td></tr>
                )}
                {departments.map((d, i) => (
                  <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-3 md:px-6 py-2 md:py-4 font-bold text-sm text-on-surface">{d.name}</td>
                    <td className="px-3 md:px-6 py-2 md:py-4 text-sm text-on-surface-variant">
                      {(() => {
                        const assigned = categories.filter((c) => {
                          const deptId = catDeptMap[String(c.category_id)] || String(c.department_id || '');
                          return deptId !== '' && deptId === String(d.department_id);
                        }).map((c) => c.name);
                        return assigned.length > 0
                          ? <div className="flex flex-wrap gap-1">{assigned.map((n) => <span key={n} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">{n}</span>)}</div>
                          : <span className="text-on-surface-variant/40">-</span>;
                      })()}
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4 text-sm text-on-surface-variant">{d.members}명</td>
                    <td className="px-3 md:px-6 py-2 md:py-4 text-sm font-bold text-primary">{d.active}건</td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        d.status === '정상' ? 'bg-emerald-50 text-emerald-600' : 'bg-error-container text-error'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openDeptEdit(d, i)}
                          className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button onClick={() => setDeleteConfirm({ open: true, type: 'dept', idx: i, id: d.department_id, label: d.name })}
                          className="p-1.5 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error transition-colors">
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
        </div>
      )}

      {/* 탭 3: 사용자 관리 */}
      {activeTab === 'users' && (
        <div className="flex gap-3 md:gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-3 md:space-y-5">

            {/* 승인 대기 */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-on-surface">승인 대기</h2>
                  <span className="bg-amber-100 text-amber-600 font-bold text-xs px-2 py-0.5 rounded-full">{pending.length}건</span>
                </div>
                <div className="space-y-2">
                  {pending.map((user) => (
                    <div key={user.id} onClick={() => setSelectedUser(user)}
                      className={`bg-amber-50 border rounded-2xl px-3 md:px-5 py-2 md:py-4 flex items-center gap-2 md:gap-4 cursor-pointer transition-all ${
                        selectedUser?.id === user.id ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-200 hover:border-amber-300'
                      }`}>
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
                  <button key={f.key} onClick={() => { setRoleFilter(f.key); setSelectedUser(null); }}
                    className={`flex items-center gap-1.5 pb-2.5 px-1 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      roleFilter === f.key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
                    }`}>
                    {f.label}
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      roleFilter === f.key ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                    }`}>{f.count}</span>
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
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
                          <tr key={user.id} onClick={() => setSelectedUser(isSelected ? null : user)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center font-bold text-on-surface truncate">{user.name}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.phone || '-'}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.email || '-'}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.dept || '-'}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.joinedAt || '-'}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <select value={user.dept || ''}
                                onChange={(e) => {
                                  const dept = departments.find((d) => d.name === e.target.value);
                                  if (dept) {
                                    updateUserDept(user.id, dept.department_id, dept.name);
                                    showToast(`${user.name}님의 부서가 '${dept.name}'(으)로 변경되었습니다.`);
                                  }
                                }}
                                className="h-7 px-2 rounded-lg border border-outline-variant text-xs text-on-surface bg-white outline-none focus:border-primary">
                                <option value="">부서 선택</option>
                                {departments.map((d) => <option key={d.department_id} value={d.name}>{d.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={user.id} onClick={() => setSelectedUser(isSelected ? null : user)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-slate-50'}`}>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center font-bold text-on-surface truncate">{user.name}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.phone || '-'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.email || '-'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${r.bg} ${r.text}`}>
                              <span className="material-symbols-outlined text-xs">{r.icon}</span>{r.label}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.dept || '-'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3.5 align-middle text-center text-on-surface-variant text-xs truncate">{user.joinedAt || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 상세 카드 */}
          <div className="hidden md:block w-72 shrink-0">
            {selectedUser ? (() => {
              const u = selectedUser;
              const r = roleStyle[u.role] ?? roleStyle.citizen;
              const isPending = u.status === 'pending';
              return (
                <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden sticky top-4">
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
                      <>
                        <button onClick={() => setPwResetModal({ open: true, user: u })}
                          className="w-full border border-outline-variant text-on-surface-variant text-xs font-bold py-2.5 rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">lock_reset</span>비밀번호 초기화
                        </button>
                        <button onClick={() => setWithdrawModal({ open: true, user: u })}
                          className="w-full border border-red-200 text-red-600 text-xs font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">person_remove</span>회원 탈퇴
                        </button>
                      </>
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
