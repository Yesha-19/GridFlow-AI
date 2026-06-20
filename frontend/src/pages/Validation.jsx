import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Brain,
  Clock,
  PlusCircle,
  X,
} from 'lucide-react';
import {
  getValidationHistory,
  submitActualOutcome,
} from '../services/validationApi';
import { UNPLANNED_EVENT_TYPES, PLANNED_EVENT_TYPES } from '../utils/constants';
import { formatDateTime, formatMinutes, getRiskBand } from '../utils/riskUtils';
import LearningLoop from '../components/LearningLoop/LearningLoop.jsx';

const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function eventTypeLabel(value) {
  return (
    [...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES].find((t) => t.value === value)?.label ??
    value
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Validation() {
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeRow, setActiveRow] = useState(null); // row being given actuals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getValidationHistory()
      .then(setHistory)
      .catch((err) => setLoadError(err.message || 'Could not load validation history'));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const validatedRows = useMemo(() => history?.filter((r) => r.validated) ?? [], [history]);
  const pendingRows = useMemo(() => history?.filter((r) => !r.validated) ?? [], [history]);
  const avgAccuracy = useMemo(() => {
    if (!validatedRows.length) return null;
    return Math.round(
      validatedRows.reduce((sum, r) => sum + (r.accuracyPercent ?? 0), 0) / validatedRows.length
    );
  }, [validatedRows]);

  function applyValidatedRow(rowId, updated) {
    setHistory((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updated, validated: true } : r))
    );
    setActiveRow(null);
    setToast({ kind: 'success', message: 'Validation logged — model accuracy updated.' });
  }

  function applyManualEvent(newRow) {
    setHistory((prev) => [
      {
        id: newRow.id,
        eventName: newRow.eventName,
        eventType: newRow.eventType,
        eventDate: newRow.eventDate,
        predictedRiskScore: 50,
        predictedRiskLevel: 'moderate',
        predictedDelayMinutes: 30,
        eventOccurred: true,
        ...newRow,
        validated: true,
      },
      ...(prev ?? []),
    ]);
    setManualModalOpen(false);
    setToast({ kind: 'success', message: 'Event added and validated.' });
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
      <div className="mt-5 flex flex-wrap items-center gap-3">
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
        <div className="inline-flex items-center gap-3 rounded-xl border border-console-border bg-console-panel/80 px-5 py-4">
          <Brain size={18} className="text-signal shrink-0" />
          <span className="text-xs text-console-muted">
            {pendingRows.length} event{pendingRows.length === 1 ? '' : 's'} pending validation
          </span>
        </div>
      </div>

      {loadError && <p className="mt-4 text-sm text-risk-critical">{loadError}</p>}

      {!history && !loadError && (
        <div className="mt-8 flex items-center gap-2 text-sm text-console-muted">
          <Loader2 className="animate-spin" size={16} /> Loading validation history…
        </div>
      )}

      {/* Main content grid */}
      {history && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            {/* Pending Validation */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-console-muted">
                Pending Validation
              </h2>

              {pendingRows.length === 0 ? (
                <EmptyState onAddEvent={() => setManualModalOpen(true)} />
              ) : (
                <div className="space-y-3">
                  {pendingRows.map((row) => (
                    <PendingRow
                      key={row.id}
                      row={row}
                      onAddActuals={() => setActiveRow(row)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Validated Events */}
            {validatedRows.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-console-muted">
                  Validated Events
                </h2>
                <div className="space-y-3">
                  {validatedRows.map((row) => (
                    <ValidatedRow key={row.id} row={row} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Learning Loop sidebar */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <LearningLoop />
          </div>
        </div>
      )}

      {activeRow && (
        <ActualOutcomeModal
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onSubmitted={(updated) => applyValidatedRow(activeRow.id, updated)}
        />
      )}

      {manualModalOpen && (
        <ManualEventModal
          onClose={() => setManualModalOpen(false)}
          onSubmitted={applyManualEvent}
        />
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onAddEvent }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-console-border bg-console-panel/40 px-6 py-10 text-center">
      <ClipboardList size={24} className="text-console-muted" />
      <p className="max-w-sm text-sm text-console-muted">
        No events pending validation. When an event is completed, actual outcome data
        can be entered here to evaluate model performance.
      </p>
      <button
        type="button"
        onClick={onAddEvent}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90"
      >
        <PlusCircle size={14} />
        Add Event for Validation
      </button>
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ kind, message, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-risk-low/30 bg-console-panel px-4 py-3 text-sm text-console-text shadow-glow">
      <CheckCircle2 size={16} className="text-risk-low shrink-0" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-console-muted transition-colors hover:text-console-text"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Comparison columns (Predicted vs Actual) ──────────────────────────────
function ComparisonColumns({ row }) {
  const predictedBand = getRiskBand(row.predictedRiskScore);
  const actualBand = row.actualRiskScore != null ? getRiskBand(row.actualRiskScore) : null;
  const maxDelay = Math.max(row.predictedDelayMinutes ?? 0, row.actualDelayMinutes ?? 0, 60);

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-console-muted">
          Predicted
        </p>
        <div className="space-y-2">
          <Metric label="Risk" value={row.predictedRiskScore} band={predictedBand} />
          <BarRow value={row.predictedDelayMinutes ?? 0} max={maxDelay} unit="m" color="bg-signal" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-console-muted">
          Actual
        </p>
        <div className="space-y-2">
          {actualBand ? (
            <Metric label="Risk" value={row.actualRiskScore} band={actualBand} />
          ) : (
            <span className="text-xs text-console-muted">—</span>
          )}
          <BarRow
            value={row.actualDelayMinutes ?? 0}
            max={maxDelay}
            unit="m"
            color="bg-risk-moderate"
          />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, band }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-console-muted">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${band.softBgClass} ${band.textClass}`}>
        {value}
      </span>
    </div>
  );
}

function BarRow({ value, max, unit, color }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-10 shrink-0 text-console-muted">Delay</span>
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

// ─── Validated row ──────────────────────────────────────────────────────────
function ValidatedRow({ row }) {
  const band = row.actualRiskScore != null ? getRiskBand(row.actualRiskScore) : getRiskBand(row.predictedRiskScore);
  return (
    <div className="rounded-xl border border-console-border bg-console-panel/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="sm:w-48 shrink-0">
          <p className="font-display text-sm font-semibold leading-snug text-console-text">
            {row.eventName}
          </p>
          <p className="mt-0.5 text-xs text-console-muted">
            {eventTypeLabel(row.eventType)}
          </p>
          <p className="mt-0.5 text-xs text-console-muted">{formatDateTime(row.eventDate)}</p>
        </div>

        <div className="flex-1">
          <ComparisonColumns row={row} />
        </div>

        <div className="shrink-0 sm:text-right">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${band.softBgClass} ${band.textClass}`}
          >
            {row.accuracyPercent}% accurate
          </span>
        </div>
      </div>

      {(row.actualCrowdSize != null || row.actualResourceUsage || row.actualIncidentCount != null || row.notes) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-console-border pt-3 text-[11px] text-console-muted">
          {row.actualCrowdSize != null && <span>Crowd: {row.actualCrowdSize.toLocaleString('en-IN')}</span>}
          {row.actualResourceUsage && <span>Resources: {row.actualResourceUsage}</span>}
          {row.actualIncidentCount != null && <span>Incidents: {row.actualIncidentCount}</span>}
          {row.notes && <span className="italic">"{row.notes}"</span>}
        </div>
      )}
    </div>
  );
}

// ─── Pending row ────────────────────────────────────────────────────────────
function PendingRow({ row, onAddActuals }) {
  return (
    <div className="rounded-xl border border-dashed border-console-border bg-console-panel/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="sm:w-56">
          <p className="font-display text-sm font-semibold leading-snug text-console-text">
            {row.eventName}
          </p>
          <p className="mt-0.5 text-xs text-console-muted">
            {eventTypeLabel(row.eventType)} · {formatDateTime(row.eventDate)}
          </p>
          <p className="mt-1 text-xs text-console-muted">
            Predicted {row.predictedRiskScore} risk · {formatMinutes(row.predictedDelayMinutes)} delay
          </p>
        </div>

        <div className="shrink-0">
          {row.eventOccurred ? (
            <button
              type="button"
              onClick={onAddActuals}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90 sm:w-auto"
            >
              <CheckCircle2 size={14} />
              Add Actual Event Data
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-console-border bg-console-raised/50 px-3 py-1.5 text-xs font-medium text-console-muted">
              <Clock size={13} />
              Waiting for Event Completion
            </span>
          )}
        </div>
      </div>
      <div className="mt-2">
        <span className="inline-block rounded-full bg-console-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-console-muted">
          Pending Validation
        </span>
      </div>
    </div>
  );
}

// ─── Shared modal shell ─────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-console-border bg-console-panel p-5 shadow-glow scrollbar-console">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-console-text">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-console-muted transition-colors hover:text-console-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-console-muted">{label}</span>
      {children}
    </label>
  );
}

// ─── Actual Event Data Form (for an existing predicted event) ─────────────
function ActualOutcomeModal({ row, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    actualCrowdSize: '',
    actualDelayMinutes: '',
    actualRiskLevel: 'moderate',
    actualResourceUsage: '',
    actualIncidentCount: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = form.actualDelayMinutes !== '' && form.actualRiskLevel && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitActualOutcome(row.id, {
        actualCrowdSize: form.actualCrowdSize === '' ? null : Number(form.actualCrowdSize),
        actualDelayMinutes: Number(form.actualDelayMinutes),
        actualRiskLevel: form.actualRiskLevel,
        actualResourceUsage: form.actualResourceUsage || null,
        actualIncidentCount: form.actualIncidentCount === '' ? null : Number(form.actualIncidentCount),
        notes: form.notes || null,
      });
      onSubmitted(updated);
    } catch (err) {
      setError(err.message || 'Could not submit actual outcome.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Add Actual Event Data" onClose={onClose}>
      <div className="mb-4 rounded-md border border-console-border bg-console-raised/30 p-3 text-xs text-console-muted">
        <p className="font-semibold text-console-text">{row.eventName}</p>
        <p>{eventTypeLabel(row.eventType)} · {formatDateTime(row.eventDate)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Actual Crowd Size">
            <input
              type="number"
              min={0}
              className="input"
              placeholder="e.g. 3200"
              value={form.actualCrowdSize}
              onChange={(e) => setForm({ ...form, actualCrowdSize: e.target.value })}
            />
          </Field>
          <Field label="Actual Delay Duration (min)">
            <input
              type="number"
              min={0}
              required
              className="input"
              placeholder="minutes"
              value={form.actualDelayMinutes}
              onChange={(e) => setForm({ ...form, actualDelayMinutes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Actual Risk Level">
          <select
            className="input"
            value={form.actualRiskLevel}
            onChange={(e) => setForm({ ...form, actualRiskLevel: e.target.value })}
          >
            {RISK_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Actual Resource Usage">
            <input
              type="text"
              className="input"
              placeholder="e.g. 8 officers, 4 barricades"
              value={form.actualResourceUsage}
              onChange={(e) => setForm({ ...form, actualResourceUsage: e.target.value })}
            />
          </Field>
          <Field label="Actual Incident Count">
            <input
              type="number"
              min={0}
              className="input"
              placeholder="0"
              value={form.actualIncidentCount}
              onChange={(e) => setForm({ ...form, actualIncidentCount: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Any observations relevant to this validation…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {error && <p className="text-xs text-risk-critical">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-console-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-xs font-semibold text-console-muted transition-colors hover:text-console-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            Submit Validation
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Manual event creation + validation (empty-state action) ──────────────
function ManualEventModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState({
    eventName: '',
    eventType: PLANNED_EVENT_TYPES[0].value,
    eventDateTime: '',
    actualCrowdSize: '',
    actualDelayMinutes: '',
    actualRiskLevel: 'moderate',
    actualResourceUsage: '',
    actualIncidentCount: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit =
    form.eventName.trim() !== '' &&
    form.eventDateTime !== '' &&
    form.actualDelayMinutes !== '' &&
    !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitManualValidationEvent({
        eventName: form.eventName.trim(),
        eventType: form.eventType,
        eventDateTime: new Date(form.eventDateTime).toISOString(),
        actualCrowdSize: form.actualCrowdSize === '' ? null : Number(form.actualCrowdSize),
        actualDelayMinutes: Number(form.actualDelayMinutes),
        actualRiskLevel: form.actualRiskLevel,
        actualResourceUsage: form.actualResourceUsage || null,
        actualIncidentCount: form.actualIncidentCount === '' ? null : Number(form.actualIncidentCount),
        notes: form.notes || null,
      });
      onSubmitted({
        ...result,
        eventName: form.eventName.trim(),
        eventType: form.eventType,
        eventDate: new Date(form.eventDateTime).toISOString(),
      });
    } catch (err) {
      setError(err.message || 'Could not add event.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Add Event for Validation" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Event Name">
          <input
            type="text"
            required
            className="input"
            placeholder="e.g. Republic Day Parade"
            value={form.eventName}
            onChange={(e) => setForm({ ...form, eventName: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Event Type">
            <select
              className="input"
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
            >
              {[...PLANNED_EVENT_TYPES, ...UNPLANNED_EVENT_TYPES].map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Event Date & Time">
            <input
              type="datetime-local"
              required
              className="input"
              value={form.eventDateTime}
              onChange={(e) => setForm({ ...form, eventDateTime: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Actual Crowd Size">
            <input
              type="number"
              min={0}
              className="input"
              placeholder="e.g. 3200"
              value={form.actualCrowdSize}
              onChange={(e) => setForm({ ...form, actualCrowdSize: e.target.value })}
            />
          </Field>
          <Field label="Actual Delay Duration (min)">
            <input
              type="number"
              min={0}
              required
              className="input"
              placeholder="minutes"
              value={form.actualDelayMinutes}
              onChange={(e) => setForm({ ...form, actualDelayMinutes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Actual Risk Level">
          <select
            className="input"
            value={form.actualRiskLevel}
            onChange={(e) => setForm({ ...form, actualRiskLevel: e.target.value })}
          >
            {RISK_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Actual Resource Usage">
            <input
              type="text"
              className="input"
              placeholder="e.g. 8 officers, 4 barricades"
              value={form.actualResourceUsage}
              onChange={(e) => setForm({ ...form, actualResourceUsage: e.target.value })}
            />
          </Field>
          <Field label="Actual Incident Count">
            <input
              type="number"
              min={0}
              className="input"
              placeholder="0"
              value={form.actualIncidentCount}
              onChange={(e) => setForm({ ...form, actualIncidentCount: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Any observations relevant to this validation…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {error && <p className="text-xs text-risk-critical">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-console-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-xs font-semibold text-console-muted transition-colors hover:text-console-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-md bg-signal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <PlusCircle size={14} />}
            Add &amp; Validate
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
