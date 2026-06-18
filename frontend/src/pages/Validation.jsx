import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Brain } from 'lucide-react';
import { getValidationHistory, submitActualOutcome } from '../services/validationApi';
import { UNPLANNED_EVENT_TYPES, PLANNED_EVENT_TYPES } from '../utils/constants';
import { formatDateTime, formatMinutes, getRiskBand } from '../utils/riskUtils';
import LearningLoop from '../components/LearningLoop/LearningLoop.jsx';
import SeverityBadge from '../components/SeverityBadge/SeverityBadge.jsx';

function computeAccuracy(predictedRisk, actualRisk, predictedDelay, actualDelay) {
  const riskError = Math.abs(predictedRisk - actualRisk) / 100;
  const delayError =
    Math.abs(predictedDelay - actualDelay) / Math.max(predictedDelay, actualDelay, 1);
  const blended = 1 - (riskError * 0.6 + delayError * 0.4);
  return Math.round(Math.min(99, Math.max(40, blended * 100)));
}

export default function Validation() {
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    getValidationHistory()
      .then(setHistory)
      .catch((err) => setLoadError(err.message || 'Could not load validation history'));
  }, []);

  const validatedRows = useMemo(() => history?.filter((r) => r.validated) ?? [], [history]);
  const avgAccuracy = useMemo(() => {
    if (!validatedRows.length) return null;
    return Math.round(
      validatedRows.reduce((sum, r) => sum + r.accuracyPercent, 0) / validatedRows.length
    );
  }, [validatedRows]);

  function handleValidated(updatedRow) {
    setHistory((prev) => prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-signal" />
        <h1 className="font-display text-xl font-semibold text-console-text">
          Model Validation
        </h1>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-console-muted">
        Track how predicted risk and delay compare against what actually happened on
        the ground, and log outcomes for events the model hasn't been graded on yet.
      </p>

      {/* KPI row */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        {avgAccuracy != null && (
          <div className="inline-flex items-center gap-3 rounded-xl border border-console-border bg-console-panel/80 px-5 py-4">
            <span className="font-mono text-3xl font-semibold text-risk-low">
              {avgAccuracy}%
            </span>
            <span className="text-xs text-console-muted">
              average accuracy across {validatedRows.length} validated event
              {validatedRows.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {validatedRows.length > 0 && (
          <div className="inline-flex items-center gap-3 rounded-xl border border-console-border bg-console-panel/80 px-5 py-4">
            <Brain size={18} className="text-signal" />
            <span className="text-xs text-console-muted">
              {history?.filter(r => !r.validated).length || 0} events pending validation
            </span>
          </div>
        )}
      </div>

      {loadError && (
        <p className="mt-4 text-sm text-risk-critical">{loadError}</p>
      )}

      {!history && !loadError && (
        <div className="mt-8 flex items-center gap-2 text-sm text-console-muted">
          <Loader2 className="animate-spin" size={16} /> Loading validation history…
        </div>
      )}

      {/* Main content grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Validation list */}
        <div>
          {history && (
            <div className="space-y-3">
              {history.map((row) =>
                row.validated ? (
                  <ValidatedRow key={row.id} row={row} />
                ) : (
                  <PendingRow key={row.id} row={row} onValidated={handleValidated} />
                )
              )}
            </div>
          )}
        </div>

        {/* Learning Loop sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <LearningLoop />
        </div>
      </div>
    </div>
  );
}

function eventTypeLabel(value) {
  return [...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES].find((t) => t.value === value)?.label ?? value;
}

function ComparisonBar({ predicted, actual, max = 100, unit = '' }) {
  return (
    <div className="space-y-1">
      <BarRow label="Predicted" value={predicted} max={max} unit={unit} color="bg-signal" />
      <BarRow label="Actual" value={actual} max={max} unit={unit} color="bg-risk-moderate" />
    </div>
  );
}

function BarRow({ label, value, max, unit, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-console-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-console-raised">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-console-text">
        {value}
        {unit}
      </span>
    </div>
  );
}

function ValidatedRow({ row }) {
  const band = getRiskBand(row.actualRiskScore);
  return (
    <div className="rounded-xl border border-console-border bg-console-panel/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="sm:w-56">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-semibold text-console-text">{row.eventName}</p>
        </div>
        <p className="mt-0.5 text-xs text-console-muted">
          {eventTypeLabel(row.eventType)} · {formatDateTime(row.eventDate)}
        </p>
      </div>

      <div className="mt-3 grid flex-1 grid-cols-2 gap-4 sm:mt-0">
        <ComparisonBar predicted={row.predictedRiskScore} actual={row.actualRiskScore} unit="" />
        <ComparisonBar
          predicted={row.predictedDelayMinutes}
          actual={row.actualDelayMinutes}
          max={Math.max(row.predictedDelayMinutes, row.actualDelayMinutes, 60)}
          unit="m"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 sm:mt-0">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${band.softBgClass} ${band.textClass}`}>
          {row.accuracyPercent}% accurate
        </span>
      </div>
    </div>
  );
}

function PendingRow({ row, onValidated }) {
  const [actualRiskScore, setActualRiskScore] = useState('');
  const [actualDelayMinutes, setActualDelayMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = actualRiskScore !== '' && actualDelayMinutes !== '' && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const risk = Number(actualRiskScore);
    const delay = Number(actualDelayMinutes);
    try {
      const updated = await submitActualOutcome(row.id, {
        actualRiskScore: risk,
        actualDelayMinutes: delay,
      });
      onValidated({
        ...row,
        ...updated,
        accuracyPercent: computeAccuracy(row.predictedRiskScore, risk, row.predictedDelayMinutes, delay),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-dashed border-console-border bg-console-panel/50 p-4 sm:flex sm:items-end sm:gap-4"
    >
      <div className="sm:w-56">
        <p className="font-display text-sm font-semibold text-console-text">{row.eventName}</p>
        <p className="mt-0.5 text-xs text-console-muted">
          Predicted {row.predictedRiskScore} risk · {formatMinutes(row.predictedDelayMinutes)} delay
        </p>
      </div>

      <div className="mt-3 flex flex-1 flex-wrap items-end gap-3 sm:mt-0">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-console-muted">Actual risk score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={actualRiskScore}
            onChange={(e) => setActualRiskScore(e.target.value)}
            className="input w-32"
            placeholder="0–100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-console-muted">Actual delay (min)</span>
          <input
            type="number"
            min={0}
            value={actualDelayMinutes}
            onChange={(e) => setActualDelayMinutes(e.target.value)}
            className="input w-32"
            placeholder="minutes"
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          Log outcome
        </button>
      </div>
    </form>
  );
}
