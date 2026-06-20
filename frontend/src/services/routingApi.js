import api from './api';
export async function getRoutingPlan(eventPayload, prediction) {
  try {
    const { data } = await api.post('/routing', { event: eventPayload, prediction });
    return data;
  } catch (err) {
    console.error('[routingApi] API Error:', err.message);
    throw err;
  }
}
