import api from './api';
export async function getAnalytics() {
  try {
    const { data } = await api.get('/analytics');
    return {
      analytics: data,
      accuracyTrend: data.accuracyTrend
    };
  } catch (err) {
    console.error('[analyticsApi] API Error:', err.message);
    throw err;
  }
}
