# Gridlock — Frontend (Event Congestion Optimizer)

React + Vite + Tailwind + Leaflet frontend for the Flipkart Gridlock Hackathon MVP.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
```

## Running without the backend

The backend is being built in parallel, so every API call has a seeded mock
fallback — the app is fully demoable today. Control this with `.env`:

```
VITE_USE_MOCK=true     # default: generate realistic forecasts locally
VITE_API_BASE_URL=/api # used once VITE_USE_MOCK=false
```

Flip `VITE_USE_MOCK=false` the moment the real endpoints are up. Each service
module (`src/services/*.js`) still falls back to mock data if a live request
fails, so a flaky backend during the demo won't take the UI down with it.

## Backend contract

These are the three endpoints the UI expects. Full request/response shapes
are documented as JSDoc comments directly above each function:

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/predict` | `src/services/predictionApi.js` | Congestion risk score + resource plan |
| `POST /api/routing` | `src/services/routingApi.js` | Affected roads + diversion routes |
| `GET /api/validation/history`, `POST /api/validation/{id}` | `src/services/validationApi.js` | Predicted-vs-actual accuracy tracking |

## Structure

```
src/
  components/      # EventForm, RouteMap, RiskCard, ResourcePanel, AnalyticsPanel, Dashboard
  pages/            # Home (console), Dashboard, Validation, Analytics
  context/          # EventContext — shares the active forecast across pages
  hooks/            # useCountdown — T-minus timer to event start
  services/         # axios calls with documented contracts + mock fallback
  utils/            # constants, risk-band helpers, mock data generator, map icons
```
