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

// 백엔드 GET /admin/departments 구현 필요
export const getDepartmentsApi = () =>
  client.get('/admin/departments').then((r) => r.data);
