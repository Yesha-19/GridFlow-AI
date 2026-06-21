import React, { useEffect, useState } from 'react';
import { Clock3, Gauge, MapPinned, ShieldAlert, Target } from 'lucide-react';
import { getRiskBand, formatMinutes, getWeatherAdjustedRisk } from '../../utils/riskUtils';
import { useCountdown } from '../../hooks/useCountdown';
import { useEventContext } from '../../context/EventContext.jsx';

const RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_COUNT = 36;

export default function RiskCard({ event, prediction }) {
  const { weatherData } = useEventContext();
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE);
  
  const baseScore = prediction?.baseRiskScore ?? prediction?.congestionRiskScore ?? 0;
  const { multiplier } = getWeatherAdjustedRisk(baseScore, weatherData?.condition);
  const adjustedScore = prediction?.congestionRiskScore ?? 0;
  const band = getRiskBand(adjustedScore);
  const countdown = useCountdown(event?.startTime);

  useEffect(() => {
    const target =
      CIRCUMFERENCE - (CIRCUMFERENCE * adjustedScore) / 100;
    const id = requestAnimationFrame(() => setAnimatedOffset(target));
    return () => cancelAnimationFrame(id);
  }, [adjustedScore]);

  if (!prediction) return null;

  return (
    <div className="rounded-xl border border-console-border bg-console-panel/80 p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className={band.textClass} />
        <h3 className="font-display text-sm font-semibold text-console-text">
          Congestion Risk
        </h3>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${band.softBgClass} ${band.textClass}`}
        >
          {band.label}
        </span>
      </div>

      <div className="relative mx-auto mt-4 flex h-48 w-48 items-center justify-center">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          {Array.from({ length: TICK_COUNT }).map((_, i) => {
            const angle = (i / TICK_COUNT) * 360;
            return (
              <line
                key={i}
                x1={90}
                y1={6}
                x2={90}
                y2={i % 3 === 0 ? 13 : 10}
                stroke="#232E4A"
                strokeWidth="1.5"
                transform={`rotate(${angle} 90 90)`}
              />
            );
          })}
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke="#161F36"
            strokeWidth="12"
          />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke={band.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span className="font-mono text-4xl font-semibold text-console-text">
            {adjustedScore}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-console-muted">
            / 100 score
          </span>
          {multiplier > 0 && (
            <div className="mt-1 flex items-center gap-1.5 rounded-full bg-risk-high/10 px-2 py-0.5 animate-pulse">
              <span className="text-[10px]">{weatherData.condition === 'Clouds' ? '☁️' : '🌧️'}</span>
              <span className="font-mono text-[9px] font-bold text-risk-high">
                +{Math.round(multiplier * 100)}% WEATHER PENALTY
              </span>
            </div>
          )}
        </div>
      </div>

      {event?.startTime && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-console-raised px-3 py-2 font-mono text-xs text-console-muted">
          <Clock3 size={13} className="text-signal" />
          {countdown.isPast ? 'Event window has started' : `T-minus ${countdown.label} to event start`}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat icon={<Gauge size={14} />} label="Confidence" value={`${prediction.confidenceScore}%`} />
        <Stat
          icon={<Target size={14} />}
          label="Est. delay"
          value={formatMinutes(prediction.estimatedDelayMinutes)}
        />
        <Stat
          icon={<MapPinned size={14} />}
          label="Radius"
          value={`${prediction.affectedRadiusKm} km`}
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-md border border-console-border bg-console-raised/60 px-2 py-2.5">
      <div className="flex items-center justify-center gap-1 text-console-muted">{icon}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-console-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-console-muted">{label}</div>
    </div>
  );
}
