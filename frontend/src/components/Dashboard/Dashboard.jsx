import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, MapPin, RotateCcw, Users } from 'lucide-react';
import { PLANNED_EVENT_TYPES, UNPLANNED_EVENT_TYPES } from '../../utils/constants';
import { formatDateTime, formatNumber } from '../../utils/riskUtils';
import RouteMap from '../RouteMap/RouteMap.jsx';
import RiskCard from '../RiskCard/RiskCard.jsx';
import ResourcePanel from '../ResourcePanel/ResourcePanel.jsx';
import AnalyticsPanel from '../AnalyticsPanel/AnalyticsPanel.jsx';
import HistoricalCard from '../HistoricalCard/HistoricalCard.jsx';
import SeverityBadge from '../SeverityBadge/SeverityBadge.jsx';
import EventTimeline from '../EventTimeline/EventTimeline.jsx';
import AlertSystem from '../AlertSystem/AlertSystem.jsx';

export default function Dashboard({ event, prediction, resources, routing, historicalComparison, onReset }) {
  const navigate = useNavigate();
  const eventTypeLabel =
    [...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES].find((t) => t.value === event.eventType)?.label ?? event.eventType;

  function handleNewForecast() {
    onReset();
    navigate('/');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Event header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-console-border bg-console-panel/80 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-signal">
              {eventTypeLabel}
            </span>
            <SeverityBadge score={prediction?.congestionRiskScore ?? 0} size="compact" />
          </div>
          <h1 className="mt-1.5 font-display text-xl font-semibold text-console-text">
            {event.eventName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-console-muted">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {event.venueName}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarClock size={13} /> {formatDateTime(event.startTime)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={13} /> {formatNumber(event.expectedAttendance)} expected
            </span>
          </div>
        </div>

        <button
          onClick={handleNewForecast}
          className="flex items-center gap-2 rounded-md border border-console-border bg-console-raised px-3.5 py-2 text-sm font-medium text-console-text transition-colors hover:bg-console-border"
        >
          <RotateCcw size={14} />
          New forecast
        </button>
      </div>

      {/* Severity Banner */}
      <div className="mt-4">
        <SeverityBadge score={prediction?.congestionRiskScore ?? 0} />
      </div>

      {/* Main content grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <RouteMap event={event} prediction={prediction} resources={resources} routing={routing} />
          <AnalyticsPanel event={event} prediction={prediction} />
        </div>

        <div className="flex flex-col gap-5">
          <RiskCard event={event} prediction={prediction} />
          <ResourcePanel resources={resources} />
          <EventTimeline event={event} prediction={prediction} />
          <AlertSystem event={event} prediction={prediction} />
          <HistoricalCard historicalComparison={historicalComparison} />
        </div>
      </div>
    </div>
  );
}
