// Central place for config so swapping mock data for the live backend later
// is a one-line change (VITE_USE_MOCK in .env) rather than a code hunt.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// While the backend team builds the FastAPI service in parallel, the UI runs
// entirely on realistic generated data. Set VITE_USE_MOCK=false in .env once
// /api/predict, /api/routing, and /api/validation are live.
export const USE_MOCK = false;

// Default map view centers on Bengaluru (HQ city for the hackathon).
export const DEFAULT_MAP_CENTER = [12.9716, 77.5946];
export const DEFAULT_MAP_ZOOM = 13;

export const PLANNED_EVENT_TYPES = [
  { value: 'political_rally', label: 'Political Rally', baseWeight: 0.85 },
  { value: 'religious_festival', label: 'Religious Festival', baseWeight: 0.75 },
  { value: 'sports_event', label: 'Sports Event', baseWeight: 0.65 },
  { value: 'cultural_event', label: 'Cultural Event / Concert', baseWeight: 0.55 },
  { value: 'protest_strike', label: 'Protest / Strike', baseWeight: 0.9 },
  { value: 'vip_movement', label: 'VIP Movement', baseWeight: 0.7 },
 // { value: 'others', label: 'Other Unplanned Incident', baseWeight: 0.50 },
];

export const UNPLANNED_EVENT_TYPES = [
  { value: 'accident', label: 'Traffic Accident', baseWeight: 0.80 },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown', baseWeight: 0.50 },
  { value: 'tree_fall', label: 'Tree Fall', baseWeight: 0.70 },
  { value: 'waterlogging', label: 'Waterlogging / Flooding', baseWeight: 0.60 },
  //{ value: 'others', label: 'Other Unplanned Incident', baseWeight: 0.50 },
];

export const RISK_LEVELS = {
  low: {
    label: 'Low',
    color: '#2FD480',
    textClass: 'text-risk-low',
    bgClass: 'bg-risk-low',
    softBgClass: 'bg-risk-low/10',
    ringClass: 'ring-risk-low/40',
  },
  moderate: {
    label: 'Moderate',
    color: '#F5B83D',
    textClass: 'text-risk-moderate',
    bgClass: 'bg-risk-moderate',
    softBgClass: 'bg-risk-moderate/10',
    ringClass: 'ring-risk-moderate/40',
  },
  high: {
    label: 'High',
    color: '#FF7A45',
    textClass: 'text-risk-high',
    bgClass: 'bg-risk-high',
    softBgClass: 'bg-risk-high/10',
    ringClass: 'ring-risk-high/40',
  },
  critical: {
    label: 'Critical',
    color: '#FF4D5E',
    textClass: 'text-risk-critical',
    bgClass: 'bg-risk-critical',
    softBgClass: 'bg-risk-critical/10',
    ringClass: 'ring-risk-critical/40',
  },
};
