import api from './api';
export async function getValidationHistory() {
  try {
    const { data } = await api.get('/validation/history');
    return data;
  } catch (err) {
    console.error('[validationApi] API Error:', err.message);
    throw err;
  }
}

export async function submitActualOutcome(eventId, actuals) {
  try {
    const { data } = await api.post(`/validation/${eventId}`, actuals);
    return data;
  } catch (err) {
    console.error('[validationApi] API Error:', err.message);
    throw err;
  }
}

export async function submitManualValidationEvent(payload) {
  try {
    const { data } = await api.post('/validation/manual-event', payload);
    return data;
  } catch (err) {
    console.error('[validationApi] API Error:', err.message);
    throw err;
  }
}
