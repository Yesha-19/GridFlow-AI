import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock, MapPin, RotateCcw, Users,
  FileDown, Loader2, CheckCircle, XCircle,
  Radio, ShieldCheck, ShieldAlert, Siren,
  Clock,
} from 'lucide-react';
import { PLANNED_EVENT_TYPES, UNPLANNED_EVENT_TYPES } from '../../utils/constants';
import { formatDateTime, formatNumber, getRiskBand, getWeatherAdjustedRisk } from '../../utils/riskUtils';
import { generateBriefingPDF } from '../../utils/pdfGenerator';
import RouteMap from '../RouteMap/RouteMap.jsx';
import RiskCard from '../RiskCard/RiskCard.jsx';
import WeatherPanel from '../WeatherPanel/WeatherPanel.jsx';
import ResourcePanel from '../ResourcePanel/ResourcePanel.jsx';
import AnalyticsPanel from '../AnalyticsPanel/AnalyticsPanel.jsx';
import HistoricalCard from '../HistoricalCard/HistoricalCard.jsx';
import SeverityBadge from '../SeverityBadge/SeverityBadge.jsx';
import EventTimeline from '../EventTimeline/EventTimeline.jsx';
import { useEventContext } from '../../context/EventContext.jsx';

// ── Derived readiness state from risk score ──────────────────────────────────
function getReadiness(score) {
  if (score >= 80) return {
    label: 'Critical Alert',
    sub: 'Immediate commander response required',
    color: 'text-risk-critical',
    bg: 'bg-risk-critical/10',
    border: 'border-risk-critical/30',
    dot: 'bg-risk-critical',
    icon: Siren,
    pulse: true,
  };
  if (score >= 60) return {
    label: 'Deployment Recommended',
    sub: 'Pre-position resources within 30 minutes',
    color: 'text-risk-high',
    bg: 'bg-risk-high/10',
    border: 'border-risk-high/30',
    dot: 'bg-risk-high',
    icon: ShieldAlert,
    pulse: true,
  };
  return {
    label: 'Resources Ready',
    sub: 'Monitoring active — no immediate action required',
    color: 'text-risk-low',
    bg: 'bg-risk-low/10',
    border: 'border-risk-low/30',
    dot: 'bg-risk-low',
    icon: ShieldCheck,
    pulse: false,
  };
}

// ── Last-updated clock ───────────────────────────────────────────────────────
function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ── PDF download status ──────────────────────────────────────────────────────
const PDF_IDLE    = 'idle';
const PDF_LOADING = 'loading';
const PDF_SUCCESS = 'success';
const PDF_ERROR   = 'error';

export default function Dashboard({ event, prediction, resources, routing, historicalComparison, onReset }) {
  const navigate = useNavigate();
  const mapRefHolder = useRef(null);
  const [pdfStatus, setPdfStatus] = useState(PDF_IDLE);
  const now = useNow();
  const { weatherData } = useEventContext();

  const eventTypeLabel =
    [...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES].find((t) => t.value === event.eventType)?.label ?? event.eventType;

  const score = prediction?.congestionRiskScore ?? 0;
  const band = getRiskBand(score);
  const readiness = getReadiness(score);
  const ReadinessIcon = readiness.icon;

  function handleNewForecast() {
    onReset();
    navigate('/');
  }

  const handleMapRef = useCallback((ref) => {
    mapRefHolder.current = ref;
  }, []);

 async function handleDownloadPDF() {
  if (pdfStatus === PDF_LOADING) return;
  setPdfStatus(PDF_LOADING);
  try {
    await generateBriefingPDF({ event, prediction, resources, routing, mapImageDataUrl: null });
    setPdfStatus(PDF_SUCCESS);
    setTimeout(() => setPdfStatus(PDF_IDLE), 3000);
  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    setPdfStatus(PDF_ERROR);
    setTimeout(() => setPdfStatus(PDF_IDLE), 4000);
  }
}

  const pdfBtn = {
    [PDF_IDLE]:    { label: 'Download PDF', icon: FileDown,    cls: 'border-console-border bg-console-raised text-console-text hover:bg-console-border' },
    [PDF_LOADING]: { label: 'Generating PDF…',       icon: Loader2,     cls: 'border-signal/40 bg-signal/10 text-signal cursor-wait' },
    [PDF_SUCCESS]: { label: 'PDF Downloaded',        icon: CheckCircle, cls: 'border-risk-low/40 bg-risk-low/10 text-risk-low' },
    [PDF_ERROR]:   { label: 'PDF Failed – Retry',    icon: XCircle,     cls: 'border-risk-critical/40 bg-risk-critical/10 text-risk-critical' },
  }[pdfStatus];
  const PdfIcon = pdfBtn.icon;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

      {/* ── Command Status Banner ─────────────────────────────────────────── */}
      <div className={`mb-4 flex items-center justify-between rounded-xl border ${readiness.border} ${readiness.bg} px-4 py-3`}>
        <div className="flex items-center gap-3">
          {/* Live pulse dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {readiness.pulse && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${readiness.dot} opacity-60`} />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${readiness.dot}`} />
          </span>
          <ReadinessIcon size={16} className={readiness.color} />
          <div>
            <span className={`font-display text-sm font-bold ${readiness.color}`}>
              Event Status: {readiness.label}
            </span>
            <span className="ml-3 text-xs text-console-muted">{readiness.sub}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-console-muted">
          <Radio size={11} className="text-signal animate-pulse" />
          Monitoring Active
          <span className="ml-2 flex items-center gap-1">
            <Clock size={10} />
            Last updated: {now.toLocaleTimeString('en-IN', { hour12: false })}
          </span>
        </div>
      </div>

      {/* ── Event Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-console-border bg-console-panel/80 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-signal">
              {eventTypeLabel}
            </span>
            <SeverityBadge score={score} size="compact" />
          </div>
          <h1 className="mt-1.5 font-display text-xl font-semibold text-console-text">
            {event.eventName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-console-muted">
            <span className="flex items-center gap-1.5"><MapPin size={13} /> {event.venueName}</span>
            <span className="flex items-center gap-1.5"><CalendarClock size={13} /> {formatDateTime(event.startTime)}</span>
            <span className="flex items-center gap-1.5"><Users size={13} /> {formatNumber(event.expectedAttendance)} expected</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PDF Download */}
          <button
            onClick={handleDownloadPDF}
            disabled={pdfStatus === PDF_LOADING}
            className={`flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-all ${pdfBtn.cls}`}
          >
            <PdfIcon size={14} className={pdfStatus === PDF_LOADING ? 'animate-spin' : ''} />
            {pdfBtn.label}
          </button>

          <button
            onClick={handleNewForecast}
            className="flex items-center gap-2 rounded-md border border-console-border bg-console-raised px-3.5 py-2 text-sm font-medium text-console-text transition-colors hover:bg-console-border"
          >
            <RotateCcw size={14} />
            New forecast
          </button>
        </div>
      </div>

      {/* Severity Banner */}
      <div className="mt-4">
        <SeverityBadge score={score} />
      </div>

      {/* Main Content Grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <RouteMap
            event={event}
            prediction={prediction}
            resources={resources}
            routing={routing}
            onMapRef={handleMapRef}
          />
          <AnalyticsPanel event={event} prediction={prediction} />
        </div>

        <div className="flex flex-col gap-5">
          <RiskCard event={event} prediction={prediction} />
          <WeatherPanel />
          <ResourcePanel resources={resources} />
          <EventTimeline event={event} prediction={prediction} />
          <HistoricalCard historicalComparison={historicalComparison} />
        </div>
      </div>
    </div>
  );
}
