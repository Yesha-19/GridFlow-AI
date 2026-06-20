import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Brain, Trash } from 'lucide-react';
import { getValidationHistory, submitActualOutcome } from '../services/validationApi';
import { deleteEvent } from '../services/eventsApi';
import { UNPLANNED_EVENT_TYPES, PLANNED_EVENT_TYPES } from '../utils/constants';
import { formatDateTime, formatMinutes, getRiskBand } from '../utils/riskUtils';
import LearningLoop from '../components/LearningLoop/LearningLoop.jsx';

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

  function handleDeleted(deletedId) {
    setHistory((prev) => prev.filter((r) => r.id !== deletedId));
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
        <div className="min-w-0">
          {history && (
            <div className="space-y-3">
              {history.filter(row => row.eventOccurred).map((row) =>
                row.validated ? (
                  <ValidatedRow key={row.id} row={row} onDeleted={handleDeleted} />
                ) : (
                  <PendingRow key={row.id} row={row} onValidated={handleValidated} onDeleted={handleDeleted} />
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

function ComparisonBar({ predicted, actual, unit = '' }) {
  return (
    <div className="space-y-1.5 w-full">
      <BarRow label="Predicted" value={predicted} unit={unit} color="bg-signal" />
      <BarRow label="Actual" value={actual} unit={unit} color="bg-risk-moderate" />
    </div>
  );
}

function BarRow({ label, value, unit, color }) {
  return (
    <div className="flex items-center gap-4 text-[11px] w-full max-w-[140px]">
      <div className="flex items-center gap-1.5 w-20 shrink-0 text-console-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        <span>{label}</span>
      </div>
      <span className="font-mono text-console-text">
        {value}{unit}
      </span>
    </div>
  );
}

function ValidatedRow({ row, onDeleted }) {
  const band = row.actualRiskScore != null ? getRiskBand(row.actualRiskScore) : getRiskBand(row.predictedRiskScore);
  
  const handleDelete = () => {
    if (onDeleted) onDeleted(row.id);
    deleteEvent(row.id).catch(console.error);
  };

  return (
    <div className="rounded-xl border border-console-border bg-console-panel/80 p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6 flex-wrap">
      
      <div className="w-full xl:w-48 shrink-0">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-semibold text-console-text truncate">{row.eventName}</p>
        </div>
        <p className="mt-0.5 text-xs text-console-muted">
          {eventTypeLabel(row.eventType)} · {formatDateTime(row.eventDate)}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row flex-1 gap-6 w-full min-w-[280px]">
        <div className="flex-1 min-w-[120px]">
          <p className="text-[10px] text-console-muted mb-2 uppercase tracking-wider">Risk Score</p>
          <ComparisonBar predicted={row.predictedRiskScore} actual={row.actualRiskScore} unit="" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <p className="text-[10px] text-console-muted mb-2 uppercase tracking-wider">Time Delay</p>
          <ComparisonBar
            predicted={row.predictedDelayMinutes}
            actual={row.actualDelayMinutes}
            unit="m"
          />
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between w-full xl:w-auto xl:justify-end mt-4 xl:mt-0 gap-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${band.softBgClass} ${band.textClass}`}>
          {row.accuracyPercent}% accurate
        </span>
        <button 
          onClick={handleDelete} 
          className="text-console-muted hover:text-risk-critical transition-colors shrink-0 p-1"
          title="Remove event"
        >
          <Trash size={16} />
        </button>
      </div>
      
    </div>
  );
}

function PendingRow({ row, onValidated, onDeleted }) {
  const [actualRiskScore, setActualRiskScore] = useState('');
  const [actualDelayMinutes, setActualDelayMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const canSubmit = actualRiskScore !== '' && actualDelayMinutes !== '' && !submitting;

  const handleDelete = () => {
    if (onDeleted) onDeleted(row.id);
    deleteEvent(row.id).catch(console.error);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    // Round + clamp defensively: the number inputs below constrain this in
    // most browsers, but the API previously hard-rejected (422) anything
    // that wasn't a clean integer in range, so we don't rely on the browser
    // alone to guarantee that.
    const risk = Math.min(100, Math.max(0, Math.round(Number(actualRiskScore))));
    const delay = Math.max(0, Math.round(Number(actualDelayMinutes)));
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
    } catch (err) {
      setSubmitError(
        err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Could not save this outcome — please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-dashed border-console-border bg-console-panel/50 p-4 sm:flex sm:items-end sm:gap-4 flex-wrap"
    >
      <div className="sm:w-56 flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-console-text truncate">{row.eventName}</p>
          <p className="mt-0.5 text-xs text-console-muted truncate">
            Predicted {row.predictedRiskScore} risk · {formatMinutes(row.predictedDelayMinutes)} delay
          </p>
        </div>
        <button 
          type="button"
          onClick={handleDelete} 
          disabled={submitting}
          className="text-console-muted hover:text-risk-critical transition-colors shrink-0 mt-0.5 p-1"
          title="Remove event"
        >
          <Trash size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-wrap items-end gap-3 sm:mt-0 min-w-0">
        <label className="flex flex-col gap-1 w-full sm:w-auto">
          <span className="text-[11px] text-console-muted">Actual risk score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={actualRiskScore}
            onChange={(e) => setActualRiskScore(e.target.value)}
            className="input w-full sm:w-32"
            placeholder="0–100"
          />
        </label>
        <label className="flex flex-col gap-1 w-full sm:w-auto">
          <span className="text-[11px] text-console-muted">Actual delay (min)</span>
          <input
            type="number"
            min={0}
            value={actualDelayMinutes}
            onChange={(e) => setActualDelayMinutes(e.target.value)}
            className="input w-full sm:w-32"
            placeholder="minutes"
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center justify-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-50 w-full sm:w-auto"
        >
          {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          Log outcome
        </button>
      </div>

      {submitError && (
        <p className="mt-2 w-full text-xs text-risk-critical">{submitError}</p>
      )}
    </form>
  );
}