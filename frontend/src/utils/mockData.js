
import { PLANNED_EVENT_TYPES, UNPLANNED_EVENT_TYPES } from './constants';

// Combine both lists once so generateMockForecast can always look up a type weight.
const EVENT_TYPES = [...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES];

// --- Tiny seeded PRNG (mulberry32) -----------------------------------------
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function makeRng(event) {
  const seed = `${event.eventName}|${event.venueName}|${event.latitude}|${event.longitude}`;
  return seedFromString(seed);
}

function offset(lat, lng, rng, spreadKm = 1.2) {
  const dLat = (rng() - 0.5) * 0.018 * spreadKm;
  const dLng = (rng() - 0.5) * 0.018 * spreadKm;
  return [lat + dLat, lng + dLng];
}

// --- Bengaluru real coordinates from dataset --------------------------------
const BENGALURU_HOTSPOTS = [
  { lat: 12.9788, lng: 77.5996, name: 'Chinnaswamy Stadium Area' },
  { lat: 13.0070, lng: 77.5725, name: 'Palace Grounds' },
  { lat: 12.9756, lng: 77.5928, name: 'Kanteerava Stadium' },
  { lat: 12.9770, lng: 77.5734, name: 'Freedom Park' },
  { lat: 12.9507, lng: 77.5848, name: 'Lalbagh' },
  { lat: 12.9763, lng: 77.5929, name: 'Cubbon Park' },
  { lat: 12.9758, lng: 77.6069, name: 'MG Road' },
  { lat: 12.9822, lng: 77.6089, name: 'Commercial Street' },
  { lat: 12.9561, lng: 77.7019, name: 'Marathahalli' },
  { lat: 12.9352, lng: 77.6245, name: 'Koramangala' },
  { lat: 12.9253, lng: 77.5831, name: 'Jayanagar' },
  { lat: 13.0035, lng: 77.5686, name: 'Malleshwaram' },
  { lat: 12.9698, lng: 77.7500, name: 'Whitefield' },
  { lat: 13.0400, lng: 77.5181, name: 'Peenya' },
  { lat: 12.9219, lng: 77.6452, name: 'HSR Layout' },
];

/**
 * Builds a full forecast (risk score + resource plan) for a submitted event.
 */
export function generateMockForecast(event) {
  const rng = makeRng(event);
  // BUG FIX: was referencing undefined EVENT_TYPES — now imported from combined list above.
  const typeWeight =
    EVENT_TYPES.find((t) => t.value === event.eventType)?.baseWeight ?? 0.6;

  const attendanceFactor = Math.min(event.expectedAttendance / 50000, 1);
  const durationFactor = Math.min(event.durationHours / 8, 1);

  const rawScore =
    typeWeight * 55 + attendanceFactor * 35 + durationFactor * 10 + (rng() - 0.5) * 8;
  const congestionRiskScore = Math.round(Math.min(Math.max(rawScore, 4), 98));

  const estimatedDelayMinutes = Math.round(
    8 + (congestionRiskScore / 100) * 65 + rng() * 10
  );

  const affectedRadiusKm = Math.round(
    (1.2 + (congestionRiskScore / 100) * 3.6 + rng() * 0.6) * 10
  ) / 10;

  const confidenceScore = Math.round(72 + rng() * 20);
  const peakOffsetMinutes = Math.round(20 + rng() * 70);

  // Risk level tier — aligned with SeverityBadge thresholds (35/60/80).
  let riskLevel = 'LOW';
  if (congestionRiskScore >= 80) riskLevel = 'CRITICAL';
  else if (congestionRiskScore >= 60) riskLevel = 'HIGH';
  else if (congestionRiskScore >= 35) riskLevel = 'MEDIUM';

  const prediction = {
    congestionRiskScore,
    estimatedDelayMinutes,
    affectedRadiusKm,
    confidenceScore,
    peakOffsetMinutes,
    riskLevel,
  };

  const personnelBase = 6 + attendanceFactor * 40 + typeWeight * 20;
  const resources = {
    policePersonnel: Math.round(personnelBase + rng() * 8),
    trafficWardens: Math.round(personnelBase * 0.55 + rng() * 5),
    barricades: Math.round(20 + attendanceFactor * 140 + rng() * 15),
    cctvUnits: Math.round(4 + attendanceFactor * 16 + rng() * 3),
    ambulanceStandby: Math.max(1, Math.round(1 + attendanceFactor * 5)),
    deploymentZones: buildDeploymentZones(event, congestionRiskScore, rng),
  };

  const historicalComparison = generateHistoricalComparison(event, congestionRiskScore, rng);

  return { prediction, resources, historicalComparison };
}

function buildDeploymentZones(event, score, rng) {
  const zoneNames = [
    'Main Entry Gate',
    'VIP / Stage Approach',
    'North Junction',
    'South Service Road',
    'Parking Overflow Lot',
  ];
  const zoneCount = score >= 60 ? 5 : score >= 35 ? 4 : 3;
  return zoneNames.slice(0, zoneCount).map((name, i) => {
    const [lat, lng] = offset(event.latitude, event.longitude, rng, 0.9);
    const priority = i === 0 ? 'critical' : i === 1 ? 'high' : rng() > 0.5 ? 'moderate' : 'low';
    return {
      id: `zone-${i}`,
      name,
      lat,
      lng,
      personnelCount: Math.max(2, Math.round((score / 100) * 18 - i * 2 + rng() * 4)),
      priority,
    };
  });
}

function generateHistoricalComparison(event, currentScore, rng) {
  const HISTORICAL_DB = [
    { name: 'Ganesh Chaturthi Procession — MG Road', type: 'religious_festival', crowd: 45000, spike: 72, officers: 28, barricades: 85 },
    { name: 'IPL Match — RCB vs CSK', type: 'sports_event', crowd: 40000, spike: 58, officers: 22, barricades: 65 },
    { name: 'State Assembly Election Rally', type: 'political_rally', crowd: 60000, spike: 81, officers: 38, barricades: 120 },
    { name: 'Republic Day Parade Route', type: 'vip_movement', crowd: 80000, spike: 67, officers: 45, barricades: 150 },
    { name: 'Diwali Festival — Lalbagh', type: 'religious_festival', crowd: 35000, spike: 65, officers: 18, barricades: 60 },
    { name: 'Farmers Union Highway Strike', type: 'protest_strike', crowd: 15000, spike: 78, officers: 32, barricades: 90 },
    { name: 'Independence Day Concert', type: 'cultural_event', crowd: 22000, spike: 48, officers: 14, barricades: 45 },
    { name: 'Bengaluru Marathon 2024', type: 'sports_event', crowd: 25000, spike: 55, officers: 20, barricades: 70 },
    { name: 'Karaga Festival Procession', type: 'religious_festival', crowd: 55000, spike: 75, officers: 35, barricades: 110 },
    { name: 'CM Road Show — Campaign', type: 'political_rally', crowd: 70000, spike: 85, officers: 42, barricades: 135 },
    { name: 'New Year Concert — Palace Grounds', type: 'cultural_event', crowd: 30000, spike: 52, officers: 16, barricades: 55 },
    { name: 'Auto Expo 2024 — Whitefield', type: 'cultural_event', crowd: 18000, spike: 42, officers: 12, barricades: 40 },
  ];

  const scored = HISTORICAL_DB.map(h => {
    let similarity = 0;
    if (h.type === event.eventType) similarity += 40;
    const crowdRatio = Math.min(h.crowd, event.expectedAttendance) / Math.max(h.crowd, event.expectedAttendance, 1);
    similarity += crowdRatio * 35;
    similarity += Math.round(rng() * 25);
    return { ...h, similarity: Math.min(97, similarity) };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, 3).map(h => ({
    eventName: h.name,
    eventType: h.type,
    date: new Date(Date.now() - Math.round(rng() * 365 * 24 * 3600 * 1000)).toISOString(),
    congestionSpike: h.spike,
    officersNeeded: h.officers,
    barricadesUsed: h.barricades,
    similarity: h.similarity,
  }));
}

export function generateMockRouting(event, prediction) {
  const rng = makeRng(event);
  const { latitude: lat, longitude: lng } = event;
  const score = prediction?.congestionRiskScore ?? 50;

  const ROAD_NAMES = [
    'Outer Ring Road', 'MG Road', 'Brigade Road', 'Hosur Road',
    'Tumkur Road', 'Bannerghatta Road', 'Bellary Road', 'Old Airport Road',
  ];

  const congestionForLane = (i) => {
    const roll = score / 100 + (rng() - 0.5) * 0.3;
    if (i === 0 || roll > 0.7) return 'critical';
    if (roll > 0.45) return 'high';
    if (roll > 0.25) return 'moderate';
    return 'low';
  };

  const affectedRoutes = Array.from({ length: 4 }).map((_, i) => {
    const angle = (i / 4) * Math.PI * 2 + rng() * 0.4;
    const path = [
      [lat, lng],
      offset(lat + Math.sin(angle) * 0.01, lng + Math.cos(angle) * 0.01, rng, 1.4),
      offset(lat + Math.sin(angle) * 0.022, lng + Math.cos(angle) * 0.022, rng, 1.6),
    ];
    return {
      id: `affected-${i}`,
      name: `${ROAD_NAMES[i % ROAD_NAMES.length]} — Approach ${i + 1}`,
      congestionLevel: congestionForLane(i),
      coordinates: path,
    };
  });

  const diversionRoutes = Array.from({ length: 2 }).map((_, i) => {
    const angle = (i / 2) * Math.PI * 2 + Math.PI / 4 + rng() * 0.3;
    const path = [
      offset(lat, lng, rng, 1.8),
      offset(lat + Math.sin(angle) * 0.028, lng + Math.cos(angle) * 0.028, rng, 1.5),
      offset(lat + Math.sin(angle) * 0.04, lng + Math.cos(angle) * 0.04, rng, 1.5),
    ];
    return {
      id: `diversion-${i}`,
      name: `Diversion Route ${String.fromCharCode(65 + i)}`,
      coordinates: path,
      recommendedFor: i === 0 ? 'Heavy / commercial traffic' : 'Light vehicles & two-wheelers',
    };
  });

  return {
    affectedRoutes,
    diversionRoutes,
    closureZone: {
      center: [lat, lng],
      radiusMeters: Math.round((prediction?.affectedRadiusKm ?? 1.5) * 1000 * 0.35),
    },
  };
}

const SAMPLE_PAST_EVENTS = [
  { eventName: 'Republic Day Parade Route', eventType: 'vip_movement', expectedAttendance: 80000, durationHours: 4 },
  { eventName: 'Ganesh Chaturthi Procession — MG Road', eventType: 'religious_festival', expectedAttendance: 45000, durationHours: 6 },
  { eventName: 'State Assembly Election Rally', eventType: 'political_rally', expectedAttendance: 60000, durationHours: 3 },
  { eventName: 'City FC vs. Bengaluru FC — Derby Day', eventType: 'sports_event', expectedAttendance: 28000, durationHours: 3 },
  { eventName: 'Farmers Union Highway Strike', eventType: 'protest_strike', expectedAttendance: 15000, durationHours: 8 },
  { eventName: 'Independence Day Cultural Concert', eventType: 'cultural_event', expectedAttendance: 22000, durationHours: 5 },
];

export function generateMockValidationHistory() {
  return SAMPLE_PAST_EVENTS.map((evt, i) => {
    const rng = seedFromString(`${evt.eventName}-validation`);
    const hotspot = BENGALURU_HOTSPOTS[i % BENGALURU_HOTSPOTS.length];
    const { prediction } = generateMockForecast({
      ...evt,
      venueName: evt.eventName,
      latitude: hotspot.lat,
      longitude: hotspot.lng,
    });
    const drift = Math.round((rng() - 0.5) * 18);
    const actualRiskScore = Math.min(98, Math.max(4, prediction.congestionRiskScore + drift));
    const actualDelayMinutes = Math.max(
      4,
      Math.round(prediction.estimatedDelayMinutes + (rng() - 0.5) * 22)
    );
    const accuracyPercent = Math.round(
      100 - (Math.abs(drift) / 100) * 100 * 0.6 - rng() * 4
    );

    // Last event in the sample set is treated as "in the future" so the UI
    // can demo the Waiting for Event Completion state; the one before that
    // has occurred but hasn't been validated yet.
    const isFuture = i === SAMPLE_PAST_EVENTS.length - 1;
    const isPending = isFuture || i === SAMPLE_PAST_EVENTS.length - 2;

    const scoreToLevel = (score) => {
      if (score >= 80) return 'critical';
      if (score >= 60) return 'high';
      if (score >= 35) return 'moderate';
      return 'low';
    };

    return {
      id: `hist-${i}`,
      eventName: evt.eventName,
      eventType: evt.eventType,
      eventDate: isFuture
        ? new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString()
        : new Date(Date.now() - (i + 1) * 9 * 24 * 3600 * 1000).toISOString(),
      predictedRiskScore: prediction.congestionRiskScore,
      predictedRiskLevel: scoreToLevel(prediction.congestionRiskScore),
      predictedDelayMinutes: prediction.estimatedDelayMinutes,
      eventOccurred: !isFuture,
      validated: !isPending,
      actualRiskScore: isPending ? null : actualRiskScore,
      actualRiskLevel: isPending ? null : scoreToLevel(actualRiskScore),
      actualDelayMinutes: isPending ? null : actualDelayMinutes,
      actualCrowdSize: isPending ? null : Math.round(800 + rng() * 4000),
      actualResourceUsage: isPending ? null : `${4 + Math.round(rng() * 10)} officers, ${2 + Math.round(rng() * 6)} barricades`,
      actualIncidentCount: isPending ? null : Math.round(rng() * 3),
      notes: isPending ? null : '',
      accuracyPercent: isPending ? null : Math.min(99, Math.max(58, accuracyPercent)),
    };
  });
}

export function generateHourlyProfile(event, prediction) {
  const rng = makeRng(event);
  const startHour = event.startTime
    ? new Date(event.startTime).getHours()
    : 17;
  const peak = Math.min(98, prediction?.congestionRiskScore ?? 50);

  return Array.from({ length: 24 }).map((_, hour) => {
    const distance = Math.min(
      Math.abs(hour - startHour),
      24 - Math.abs(hour - startHour)
    );
    const falloff = Math.exp(-(distance * distance) / 10);
    const base = 8 + peak * falloff;
    const noise = (rng() - 0.5) * 6;
    return {
      hour,
      value: Math.round(Math.min(100, Math.max(3, base + noise))),
    };
  });
}

export function generateHeatmapData(event, prediction) {
  const rng = makeRng(event);
  const { latitude: lat, longitude: lng } = event;
  const score = prediction?.congestionRiskScore ?? 50;
  const radius = prediction?.affectedRadiusKm ?? 2;
  const points = [];

  const nPoints = 40 + Math.round(score * 0.6);
  for (let i = 0; i < nPoints; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * radius * 0.01;
    const intensity = Math.max(0.2, 1 - (dist / (radius * 0.01)));
    points.push({
      lat: lat + Math.sin(angle) * dist + (rng() - 0.5) * 0.002,
      lng: lng + Math.cos(angle) * dist + (rng() - 0.5) * 0.002,
      intensity: intensity * (score / 100),
    });
  }
  return points;
}

export function generateCrowdFlowData(event, prediction) {
  const rng = makeRng(event);
  const { latitude: lat, longitude: lng } = event;
  const score = prediction?.congestionRiskScore ?? 50;
  const particles = [];

  const nParticles = 20 + Math.round(score * 0.3);
  for (let i = 0; i < nParticles; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 0.3 + rng() * 0.7;
    const startDist = 0.005 + rng() * 0.015;
    particles.push({
      id: `particle-${i}`,
      startLat: lat + Math.sin(angle) * startDist,
      startLng: lng + Math.cos(angle) * startDist,
      endLat: lat + Math.sin(angle) * startDist * 0.3,
      endLng: lng + Math.cos(angle) * startDist * 0.3,
      speed,
      delay: rng() * 3,
    });
  }
  return particles;
}

export function generateAlertFeed(event, prediction) {
  const rng = makeRng(event);
  const score = prediction?.congestionRiskScore ?? 50;
  const hotspot = BENGALURU_HOTSPOTS[Math.floor(rng() * BENGALURU_HOTSPOTS.length)];

  return [
    {
      id: 'alert-1',
      type: score >= 80 ? 'critical' : score >= 60 ? 'high' : 'moderate',
      title: 'Congestion Spike Detected',
      message: `Traffic density at ${hotspot.name} exceeds threshold — deploying reserve personnel.`,
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: 'alert-2',
      type: 'info',
      title: 'Barricade Deployment Complete',
      message: `${Math.round(20 + rng() * 40)} barricades placed across ${3 + Math.round(rng() * 2)} zones.`,
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 'alert-3',
      type: score >= 60 ? 'high' : 'moderate',
      title: 'Diversion Route Activated',
      message: `Route A via Outer Ring Road now active for heavy vehicles.`,
      timestamp: new Date(Date.now() - 480000).toISOString(),
    },
    {
      id: 'alert-4',
      type: 'info',
      title: 'CCTV Feed Active',
      message: `${4 + Math.round(rng() * 12)} camera feeds streaming from event perimeter.`,
      timestamp: new Date(Date.now() - 720000).toISOString(),
    },
    {
      id: 'alert-5',
      type: 'low',
      title: 'Crowd Dispersal Beginning',
      message: `Event phase transitioning from peak to dispersal. ETA to normal: ${30 + Math.round(rng() * 60)}min.`,
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
  ];
}

export function generateAccuracyTrend() {
  const rng = seedFromString('accuracy-trend-v2');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let baseAccuracy = 68;
  return months.map((month) => {
    baseAccuracy += 1.5 + rng() * 2.5;
    const accuracy = Math.min(96, baseAccuracy);
    return {
      month,
      accuracy: Math.round(accuracy * 10) / 10,
      events: 8 + Math.round(rng() * 15),
    };
  });
}

export function generateCityAnalytics() {
  const rng = seedFromString('city-analytics-v2');
  return {
    totalEvents: 847,
    avgAccuracy: 87.3,
    avgResponseTime: 12,
    topCongestionZones: [
      { name: 'MG Road / Brigade Road', score: 82, events: 34 },
      { name: 'Silk Board Junction', score: 89, events: 28 },
      { name: 'KR Market Area', score: 76, events: 22 },
      { name: 'Marathahalli Bridge', score: 71, events: 19 },
      { name: 'Yeshwanthpur Circle', score: 68, events: 16 },
    ],
    eventTypeBreakdown: [
      { type: 'Religious Festival', count: 245, avgScore: 68 },
      { type: 'Political Rally', count: 189, avgScore: 78 },
      { type: 'Sports Event', count: 156, avgScore: 58 },
      { type: 'VIP Movement', count: 134, avgScore: 62 },
      { type: 'Protest / Strike', count: 82, avgScore: 82 },
      { type: 'Cultural Event', count: 41, avgScore: 48 },
    ],
    monthlyTrend: Array.from({ length: 12 }).map((_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
      events: 40 + Math.round(rng() * 50),
      avgScore: 45 + Math.round(rng() * 35),
    })),
  };
}
