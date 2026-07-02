import client from './client';

// 관리자 대시보드 통계 API (GET /admin/stats/*). staff/admin 로그인 필요.

export const getStatsSummaryApi = () =>
  client.get('/admin/stats/summary').then((r) => r.data);

export const getStatsByCategoryApi = () =>
  client.get('/admin/stats/by-category').then((r) => r.data);

export const getStatsByDepartmentApi = () =>
  client.get('/admin/stats/by-department').then((r) => r.data);

export const getStatsByStatusApi = () =>
  client.get('/admin/stats/by-status').then((r) => r.data);

export const getStatsTimelineApi = () =>
  client.get('/admin/stats/timeline').then((r) => r.data);

export const getStatsUrgencyApi = () =>
  client.get('/admin/stats/urgency').then((r) => r.data);

export const getStatsUrgentTopApi = () =>
  client.get('/admin/stats/urgent-top').then((r) => r.data);

export const getStatsHotClustersApi = () =>
  client.get('/admin/stats/hot-clusters').then((r) => r.data);

export const getStatsAttachmentRateApi = () =>
  client.get('/admin/stats/attachment-rate').then((r) => r.data);

export const getStatsResponseMetricsApi = () =>
  client.get('/admin/stats/response-metrics').then((r) => r.data);

export const getStatsUserMetricsApi = () =>
  client.get('/admin/stats/user-metrics').then((r) => r.data);

// 11개를 한 번에 로드 (실패한 건 null)
export const getAllStatsApi = async () => {
  const [
    summary, byCategory, byDepartment, byStatus, timeline, urgency,
    urgentTop, hotClusters, attachmentRate, responseMetrics, userMetrics,
  ] = await Promise.all([
    getStatsSummaryApi().catch(() => null),
    getStatsByCategoryApi().catch(() => null),
    getStatsByDepartmentApi().catch(() => null),
    getStatsByStatusApi().catch(() => null),
    getStatsTimelineApi().catch(() => null),
    getStatsUrgencyApi().catch(() => null),
    getStatsUrgentTopApi().catch(() => null),
    getStatsHotClustersApi().catch(() => null),
    getStatsAttachmentRateApi().catch(() => null),
    getStatsResponseMetricsApi().catch(() => null),
    getStatsUserMetricsApi().catch(() => null),
  ]);
  return {
    summary, byCategory, byDepartment, byStatus, timeline, urgency,
    urgentTop, hotClusters, attachmentRate, responseMetrics, userMetrics,
  };
};
