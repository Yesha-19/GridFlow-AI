import api from './api';

export async function resolveEvent(eventId) {
  try {
    const { data } = await api.put(`/events/${eventId}/resolve`);
    return data;
  } catch (err) {
    console.error('[eventsApi] API Error:', err.message);
    throw err;
  }
}

export async function deleteEvent(eventId) {
  try {
    const { data } = await api.delete(`/events/${eventId}`);
    return data;
  } catch (err) {
    console.error('[eventsApi] API Error:', err.message);
    throw err;
  }
}
