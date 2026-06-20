"""
validation.py — Validation API endpoints.

GET  /api/validation/history        — all events with predictions, their
                                       validation status, and (if validated)
                                       predicted vs. actual outcomes
POST /api/validation/{id}           — log actual outcomes for a completed
                                       event, compute accuracy
POST /api/validation/manual-event   — create a standalone event purely for
                                       post-hoc validation (no prior forecast
                                       run through the dashboard)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Event, Prediction, Validation

router = APIRouter()

# Risk level <-> numeric score band. Officers log what they observed in the
# field as a level ("Low"/"Moderate"/"High"/"Critical"); we map that to the
# midpoint of the corresponding 0-100 band so it can be compared against the
# model's numeric prediction for accuracy scoring.
RISK_LEVEL_SCORE = {
    "low": 18,
    "moderate": 47,
    "high": 70,
    "critical": 90,
}
SCORE_RISK_LEVEL = [
    (80, "critical"),
    (60, "high"),
    (35, "moderate"),
    (0, "low"),
]


def score_to_risk_level(score: float | None) -> str | None:
    if score is None:
        return None
    for threshold, label in SCORE_RISK_LEVEL:
        if score >= threshold:
            return label
    return "low"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ValidationHistoryItem(BaseModel):
    id: str
    eventName: str
    eventType: str
    eventDate: str | None
    predictedRiskScore: int
    predictedRiskLevel: str
    predictedDelayMinutes: int
    eventOccurred: bool
    validated: bool
    actualRiskScore: int | None = None
    actualRiskLevel: str | None = None
    actualDelayMinutes: int | None = None
    actualCrowdSize: int | None = None
    actualResourceUsage: str | None = None
    actualIncidentCount: int | None = None
    notes: str | None = None
    accuracyPercent: int | None = None


class ActualOutcomeInput(BaseModel):
    actualCrowdSize: int | None = None
    actualDelayMinutes: int = Field(..., ge=0)
    actualRiskLevel: str = Field(..., description="low | moderate | high | critical")
    actualResourceUsage: str | None = None
    actualIncidentCount: int | None = Field(default=None, ge=0)
    notes: str | None = None


class ActualOutcomeResponse(BaseModel):
    id: str
    validated: bool
    accuracyPercent: int | None
    actualRiskScore: int | None
    actualRiskLevel: str | None
    actualDelayMinutes: int | None
    actualCrowdSize: int | None
    actualResourceUsage: str | None
    actualIncidentCount: int | None
    notes: str | None


class ManualEventInput(BaseModel):
    eventName: str
    eventType: str
    eventDateTime: str  # ISO datetime string
    latitude: float = 12.9716
    longitude: float = 77.5946
    locationName: str | None = None
    actualCrowdSize: int | None = None
    actualDelayMinutes: int = Field(..., ge=0)
    actualRiskLevel: str
    actualResourceUsage: str | None = None
    actualIncidentCount: int | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_accuracy(predicted_score: float, actual_score: float, predicted_delay: int, actual_delay: int) -> int:
    risk_error = abs(predicted_score - actual_score) / 100
    delay_error = abs(predicted_delay - actual_delay) / max(predicted_delay, actual_delay, 1)
    blended = 1 - (risk_error * 0.6 + delay_error * 0.4)
    return round(min(99, max(40, blended * 100)))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/validation/history", response_model=list[ValidationHistoryItem])
async def get_validation_history(db: AsyncSession = Depends(get_db)):
    """Return every event that has a prediction, with its validation state.

    Events are included regardless of whether they've happened yet so the
    UI can show a "Waiting for Event Completion" state for future events
    and an actionable "Add Actual Event Data" state for completed ones.
    """
    result = await db.execute(
        select(Event, Prediction, Validation)
        .join(Prediction, Prediction.event_id == Event.id)
        .outerjoin(Validation, Validation.event_id == Event.id)
        .order_by(Event.start_time.desc())
        .limit(50)
    )
    rows = result.all()

    now = datetime.utcnow()
    history = []
    for event, prediction, validation in rows:
        event_occurred = bool(event.start_time and event.start_time <= now) or event.status == "completed"

        item = ValidationHistoryItem(
            id=event.id,
            eventName=event.name,
            eventType=event.event_type,
            eventDate=event.start_time.isoformat() if event.start_time else None,
            predictedRiskScore=round(prediction.congestion_risk_score),
            predictedRiskLevel=prediction.risk_level or score_to_risk_level(prediction.congestion_risk_score),
            predictedDelayMinutes=prediction.estimated_delay_minutes or 0,
            eventOccurred=event_occurred,
            validated=bool(validation and validation.validated),
            actualRiskScore=round(validation.actual_congestion_score) if validation and validation.actual_congestion_score is not None else None,
            actualRiskLevel=validation.actual_risk_level if validation else None,
            actualDelayMinutes=validation.actual_delay_minutes if validation else None,
            actualCrowdSize=validation.actual_crowd_size if validation else None,
            actualResourceUsage=validation.actual_resource_usage if validation else None,
            actualIncidentCount=validation.actual_incident_count if validation else None,
            notes=validation.notes if validation else None,
            accuracyPercent=round(validation.accuracy_percentage) if validation and validation.accuracy_percentage is not None else None,
        )
        history.append(item)

    return history


@router.post("/validation/{event_id}", response_model=ActualOutcomeResponse)
async def submit_actual_outcome(
    event_id: str,
    actuals: ActualOutcomeInput,
    db: AsyncSession = Depends(get_db),
):
    """Log actual ground-truth outcome for a completed event and score it."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.start_time and event.start_time > datetime.utcnow() and event.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="This event hasn't occurred yet — actual outcomes can only be logged after completion.",
        )

    result = await db.execute(
        select(Prediction)
        .where(Prediction.event_id == event_id)
        .order_by(Prediction.created_at.desc())
        .limit(1)
    )
    prediction = result.scalar_one_or_none()

    result = await db.execute(select(Validation).where(Validation.event_id == event_id))
    validation = result.scalar_one_or_none()

    predicted_score = prediction.congestion_risk_score if prediction else 50
    predicted_delay = prediction.estimated_delay_minutes if prediction else 30

    risk_level_key = actuals.actualRiskLevel.strip().lower()
    actual_score = RISK_LEVEL_SCORE.get(risk_level_key)
    if actual_score is None:
        raise HTTPException(status_code=400, detail="actualRiskLevel must be one of: low, moderate, high, critical")

    accuracy = _compute_accuracy(predicted_score, actual_score, predicted_delay, actuals.actualDelayMinutes)
    score_delta = round(predicted_score - actual_score, 1)

    if not validation:
        validation = Validation(event_id=event_id, prediction_id=prediction.id if prediction else None)
        db.add(validation)

    validation.actual_congestion_score = actual_score
    validation.actual_risk_level = risk_level_key
    validation.actual_delay_minutes = actuals.actualDelayMinutes
    validation.actual_crowd_size = actuals.actualCrowdSize
    validation.actual_resource_usage = actuals.actualResourceUsage
    validation.actual_incident_count = actuals.actualIncidentCount
    validation.notes = actuals.notes
    validation.accuracy_percentage = accuracy
    validation.score_delta = score_delta
    validation.validated = True

    event.status = "completed"

    await db.commit()

    return ActualOutcomeResponse(
        id=event_id,
        validated=True,
        accuracyPercent=accuracy,
        actualRiskScore=round(actual_score),
        actualRiskLevel=risk_level_key,
        actualDelayMinutes=actuals.actualDelayMinutes,
        actualCrowdSize=actuals.actualCrowdSize,
        actualResourceUsage=actuals.actualResourceUsage,
        actualIncidentCount=actuals.actualIncidentCount,
        notes=actuals.notes,
    )


@router.post("/validation/manual-event", response_model=ActualOutcomeResponse)
async def create_manual_validation_event(
    payload: ManualEventInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a standalone, already-completed event together with its actual
    outcome — used by the "+ Add Event for Validation" empty-state action,
    for events that never went through the live forecast dashboard.
    """
    try:
        event_dt = datetime.fromisoformat(payload.eventDateTime.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail="eventDateTime must be a valid ISO datetime string")

    risk_level_key = payload.actualRiskLevel.strip().lower()
    actual_score = RISK_LEVEL_SCORE.get(risk_level_key)
    if actual_score is None:
        raise HTTPException(status_code=400, detail="actualRiskLevel must be one of: low, moderate, high, critical")

    event = Event(
        name=payload.eventName,
        event_type=payload.eventType,
        is_planned=True,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.locationName,
        crowd_size=payload.actualCrowdSize or 0,
        start_time=event_dt,
        duration_hours=1.0,
        status="completed",
    )
    db.add(event)
    await db.flush()

    # No model prediction exists for a manually-logged event, so the
    # comparison baseline defaults to a neutral midpoint prediction. The
    # accuracy figure reflects "no forecast was made" rather than a real
    # model score.
    predicted_score = 50
    predicted_delay = 30
    accuracy = _compute_accuracy(predicted_score, actual_score, predicted_delay, payload.actualDelayMinutes)

    validation = Validation(
        event_id=event.id,
        actual_congestion_score=actual_score,
        actual_risk_level=risk_level_key,
        actual_delay_minutes=payload.actualDelayMinutes,
        actual_crowd_size=payload.actualCrowdSize,
        actual_resource_usage=payload.actualResourceUsage,
        actual_incident_count=payload.actualIncidentCount,
        notes=payload.notes,
        accuracy_percentage=accuracy,
        score_delta=round(predicted_score - actual_score, 1),
        validated=True,
    )
    db.add(validation)
    await db.commit()

    return ActualOutcomeResponse(
        id=event.id,
        validated=True,
        accuracyPercent=accuracy,
        actualRiskScore=round(actual_score),
        actualRiskLevel=risk_level_key,
        actualDelayMinutes=payload.actualDelayMinutes,
        actualCrowdSize=payload.actualCrowdSize,
        actualResourceUsage=payload.actualResourceUsage,
        actualIncidentCount=payload.actualIncidentCount,
        notes=payload.notes,
    )
