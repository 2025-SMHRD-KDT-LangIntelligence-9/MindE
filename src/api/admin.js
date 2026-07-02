import client from './client';

const transformUser = (u) => ({
  id:           String(u.user_id),
  name:         u.name,
  email:        u.email,
  phone:        u.phone ?? '',
  role:         u.user_type === 'admin' ? 'admin' : u.user_type === 'staff' ? 'staff' : 'citizen',
  dept:         u.department_name ?? '',
  departmentId: u.department_id ?? null,
  deptGroup:    u.dept_group ?? [],
  status:       u.user_type === 'pending_staff' ? 'pending' : 'active',
  joinedAt:     u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '',
});

export const getPendingStaffApi = () =>
  client.get('/admin/pending-staff').then((r) => r.data.map(transformUser));

export const approveStaffApi = (userId) =>
  client.post(`/admin/approve-staff/${userId}`).then((r) => r.data);

export const rejectStaffApi = (userId) =>
  client.delete(`/admin/reject-staff/${userId}`).then((r) => r.data);

export const getUsersApi = () =>
  client.get('/admin/users').then((r) => r.data.map(transformUser));

export const updateUserDeptApi = (userId, departmentId) =>
  client.patch(`/admin/users/${userId}/department`, { department_id: departmentId }).then((r) => r.data);

export const getDepartmentsApi = () =>
  client.get('/admin/departments').then((r) => r.data);

// 회원가입(비로그인)용 공개 부서 목록. 백엔드에 공개 엔드포인트가 없으면 null 반환.
export const getPublicDepartmentsApi = () =>
  client.get('/departments').then((r) => r.data).catch(() => null);

export const createDepartmentApi = (name) =>
  client.post('/admin/departments', { name }).then((r) => r.data);

export const updateDepartmentApi = (id, name) =>
  client.patch(`/admin/departments/${id}`, { name }).then((r) => r.data);

export const deleteDepartmentApi = (id) =>
  client.delete(`/admin/departments/${id}`);

export const getCategoriesApi = () =>
  client.get('/admin/categories').then((r) => r.data);

export const createCategoryApi = (name) =>
  client.post('/admin/categories', { name }).then((r) => r.data);

export const updateCategoryApi = (id, name) =>
  client.patch(`/admin/categories/${id}`, { name }).then((r) => r.data);

export const deleteCategoryApi = (id) =>
  client.delete(`/admin/categories/${id}`);

export const deleteUserApi = (userId) =>
  client.delete(`/admin/users/${userId}`);
