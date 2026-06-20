import api from './api';
import { USE_MOCK } from '../utils/constants';
import { generateMockValidationHistory } from '../utils/mockData';

export async function getValidationHistory() {
  if (USE_MOCK) {
    await simulateLatency();
    return generateMockValidationHistory();
  }

  try {
    const { data } = await api.get('/validation/history');
    return data;
  } catch (err) {
    console.warn('[validationApi] falling back to mock validation history:', err.message);
    return generateMockValidationHistory();
  }
}

export async function submitActualOutcome(eventId, actuals) {
  if (USE_MOCK) {
    await simulateLatency();
    return mockOutcomeResponse(eventId, actuals);
  }

  try {
    const { data } = await api.post(`/validation/${eventId}`, actuals);
    return data;
  } catch (err) {
    console.warn('[validationApi] could not submit outcome, applying locally:', err.message);
    return mockOutcomeResponse(eventId, actuals);
  }
}

export async function submitManualValidationEvent(payload) {
  if (USE_MOCK) {
    await simulateLatency();
    return { id: `manual-${Date.now()}`, ...mockOutcomeResponse(null, payload) };
  }

  try {
    const { data } = await api.post('/validation/manual-event', payload);
    return data;
  } catch (err) {
    console.warn('[validationApi] could not create manual validation event:', err.message);
    return { id: `manual-${Date.now()}`, ...mockOutcomeResponse(null, payload) };
  }
}

function mockOutcomeResponse(eventId, actuals) {
  return {
    id: eventId,
    validated: true,
    accuracyPercent: 70 + Math.round(Math.random() * 20),
    actualRiskScore: { low: 18, moderate: 47, high: 70, critical: 90 }[actuals.actualRiskLevel] ?? 50,
    actualRiskLevel: actuals.actualRiskLevel,
    actualDelayMinutes: actuals.actualDelayMinutes,
    actualCrowdSize: actuals.actualCrowdSize ?? null,
    actualResourceUsage: actuals.actualResourceUsage ?? null,
    actualIncidentCount: actuals.actualIncidentCount ?? null,
    notes: actuals.notes ?? null,
  };
}

function simulateLatency() {
  return new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 300));
}
