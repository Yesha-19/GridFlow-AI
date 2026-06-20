import api from './api';
export async function getForecast(eventPayload) {
  try {
    const { data } = await api.post('/predict', eventPayload);
    return data;
  } catch (err) {
    console.error('[predictionApi] API Error:', err.message);
    throw err;
  }
}
