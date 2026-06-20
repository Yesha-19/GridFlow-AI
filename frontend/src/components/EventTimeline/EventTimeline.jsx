import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Zap, Wind, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';
import { resolveEvent } from '../../services/eventsApi';

const PHASES = [
  { key: 'setup', label: 'Setup & Staging', icon: Clock, offset: -60, color: 'text-signal' },
  { key: 'buildup', label: 'Crowd Build-up', icon: Zap, offset: 0, color: 'text-risk-moderate' },
  { key: 'peak', label: 'Peak Congestion', icon: Zap, offset: null, color: 'text-risk-critical' },
  { key: 'dispersal', label: 'Dispersal', icon: Wind, offset: null, color: 'text-risk-high' },
  { key: 'clear', label: 'All Clear', icon: CheckCircle2, offset: null, color: 'text-risk-low' },
];

/**
 * Format a positive delay in minutes into a human-readable overage string.
 * e.g. 95 → "+1h 35m", 30 → "+30m"
 */
function formatDelay(delayMinutes) {
  if (delayMinutes <= 0) return '';
  const h = Math.floor(delayMinutes / 60);
  const m = Math.round(delayMinutes % 60);
  if (h > 0) return `+${h}h ${m}m`;
  return `+${m} min`;
}

/**
 * EventTimeline — animated timeline showing event progression phases.
 *
 * CRITICAL: The timeline NEVER auto-completes to "All Clear".
 * If estimated time is exceeded, the event is marked as DELAYED.
 * Only manual "Mark as Resolved" advances to the final state.
 */
import { useEventContext } from '../../context/EventContext';

export default function EventTimeline({ event, prediction }) {
  const countdown = useCountdown(event?.startTime);
  const [isResolved, setIsResolved] = useState(event?.status === 'completed');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const navigate = useNavigate();
  const { markEventResolved } = useEventContext();

  React.useEffect(() => {
    setIsResolved(event?.status === 'completed');
  }, [event]);

  const handleResolve = async () => {
    setResolveError(null);
    try {
      setIsResolving(true);
      await resolveEvent(event.id);
      setIsResolved(true);
      if (markEventResolved) markEventResolved();
      
      // Auto-redirect to validation page after showing success state
      setTimeout(() => {
        navigate('/validation');
      }, 1500);
      
    } catch (err) {
      console.error('Failed to resolve event', err);
      setResolveError("Failed to resolve: Event ID missing or not found. Please click 'Reset' and run a new forecast.");
      setIsResolving(false);
    }
  };

  if (!event || !prediction) return null;

  const peakOffset = prediction.peakOffsetMinutes || 40;
  const durationMin = (event.durationHours || 4) * 60;

  // Compute phase offsets
  const phases = PHASES.map((phase, i) => {
    let minutesFromStart;
    if (i === 0) minutesFromStart = -60;
    else if (i === 1) minutesFromStart = 0;
    else if (i === 2) minutesFromStart = peakOffset;
    else if (i === 3) minutesFromStart = peakOffset + Math.round(durationMin * 0.3);
    else minutesFromStart = durationMin + 30;

    return {
      ...phase,
      minutesFromStart,
      time: formatOffset(minutesFromStart),
    };
  });

  // Determine current phase based on countdown
  // CRITICAL: NEVER auto-advance to phase 4 (All Clear).
  // Phase 4 is ONLY reached via manual resolution (isResolved).
  let currentPhaseIdx = 0;
  let isDelayed = false;
  let delayMinutes = 0;

  if (isResolved) {
    // Manual resolution — advance to All Clear
    currentPhaseIdx = 4;
  } else if (countdown.isPast) {
    const minutesPast = (countdown.days * 24 * 60) + (countdown.hours * 60) + countdown.minutes;

    if (minutesPast > durationMin) {
      // Time exceeded estimated duration — mark as DELAYED, stay at Dispersal
      currentPhaseIdx = 3;
      isDelayed = true;
      delayMinutes = minutesPast - durationMin;
    } else if (minutesPast > peakOffset + durationMin * 0.3) {
      currentPhaseIdx = 3;
    } else if (minutesPast > peakOffset) {
      currentPhaseIdx = 2;
    } else {
      currentPhaseIdx = 1;
    }
  }

  return (
    <div className="rounded-xl border border-console-border bg-console-panel/80 p-5">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-signal" />
        <h3 className="font-display text-sm font-semibold text-console-text">
          Event Timeline
        </h3>
        <span className="ml-auto font-mono text-[11px] text-console-muted">
          {isResolved
            ? 'Event resolved'
            : countdown.isPast
            ? 'Event in progress'
            : `T-minus ${countdown.label}`}
        </span>
      </div>

      <div className="mt-5 relative">
        {/* Timeline track */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-console-border" />

        <div className="space-y-4">
          {phases.map((phase, i) => {
            const Icon = phase.icon;
            const isActive = i === currentPhaseIdx;
            const isPast = i < currentPhaseIdx;
            const isFuture = i > currentPhaseIdx;

            // Show DELAYED badge on the active Dispersal phase when delayed
            const showDelayBadge = isDelayed && isActive && phase.key === 'dispersal';

            return (
              <div key={phase.key} className="relative flex items-start gap-3 pl-0">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isActive
                      ? showDelayBadge
                        ? 'text-risk-moderate border-risk-moderate bg-console-bg shadow-glow'
                        : `${phase.color} border-current bg-console-bg shadow-glow`
                      : isPast
                      ? 'border-risk-low/50 bg-risk-low/10 text-risk-low'
                      : 'border-console-border bg-console-raised text-console-muted'
                  }`}
                >
                  {isPast ? (
                    <CheckCircle2 size={14} />
                  ) : showDelayBadge ? (
                    <AlertTriangle size={14} className="animate-pulse" />
                  ) : (
                    <Icon size={14} className={isActive ? 'animate-pulse' : ''} />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-1 ${isFuture ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isActive ? 'text-console-text' : 'text-console-muted'
                      }`}
                    >
                      {phase.label}
                    </span>
                    {isActive && !showDelayBadge && (
                      <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-signal">
                        CURRENT
                      </span>
                    )}
                    {showDelayBadge && (
                      <span className="flex items-center gap-1 rounded-full bg-risk-moderate/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-risk-moderate animate-pulse">
                        <AlertTriangle size={10} />
                        DELAYED {formatDelay(delayMinutes)}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-console-muted">
                    {phase.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Resolution Control — only visible when event has started */}
      {countdown.isPast && (
        <div className="mt-5 border-t border-console-border pt-4">
          {isResolved ? (
            <div className="flex items-center gap-2 rounded-lg bg-risk-low/10 border border-risk-low/30 px-4 py-2.5">
              <CheckCircle2 size={16} className="text-risk-low" />
              <span className="text-sm font-semibold text-risk-low">
                Event Resolved
              </span>
              <span className="ml-auto font-mono text-[10px] text-console-muted">
                Confirmed by operator
              </span>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
        {resolveError && (
          <div className="text-risk-critical text-xs font-medium rounded-lg bg-risk-critical/10 p-2 border border-risk-critical/20">
            {resolveError}
          </div>
        )}
        <button
          onClick={handleResolve}
              disabled={isResolving}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-risk-low/40 bg-risk-low/10 px-4 py-2.5 text-sm font-semibold text-risk-low transition-all hover:bg-risk-low/20 hover:border-risk-low/60 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResolving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {isResolving ? 'Resolving...' : 'Mark as Resolved'}
            </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatOffset(minutes) {
  if (minutes < 0) return `${Math.abs(minutes)}min before start`;
  if (minutes === 0) return 'Event starts';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `+${h}h ${m}m after start`;
  return `+${m}min after start`;
}
