"""
prediction.py — POST /api/predict endpoint.

Accepts event details, runs the ML prediction pipeline, and returns
congestion score with resource recommendations and historical comparison.
"""

import json
import math
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Event, Prediction, ResourcePlan
from app.services.prediction_service import run_prediction_pipeline
from app.services.resource_service import compute_resource_plan
from app.services.knowledge_base_service import find_similar_events

router = APIRouter()


class EventInput(BaseModel):
    eventName: str
    eventType: str
    venueName: str
    latitude: float
    longitude: float
    expectedAttendance: int = Field(ge=100)
    startTime: str  # ISO 8601
    durationHours: float = Field(gt=0)


class DeploymentZone(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    personnelCount: int
    priority: str


class PredictionResponse(BaseModel):
    congestionRiskScore: int
    estimatedDelayMinutes: int
    affectedRadiusKm: float
    confidenceScore: int
    peakOffsetMinutes: int
    riskLevel: str


class ResourceResponse(BaseModel):
    policePersonnel: int
    trafficWardens: int
    barricades: int
    cctvUnits: int
    ambulanceStandby: int
    deploymentZones: list[DeploymentZone]


class HistoricalEvent(BaseModel):
    eventName: str
    eventType: str
    date: str
    congestionSpike: int
    officersNeeded: int
    barricadesUsed: int
    similarity: int


class ForecastResponse(BaseModel):
    eventId: str
    prediction: PredictionResponse
    resources: ResourceResponse
    historicalComparison: list[HistoricalEvent] = []


@router.post("/predict", response_model=ForecastResponse)
async def predict_congestion(
    event: EventInput,
    db: AsyncSession = Depends(get_db),
):
    """Run the full forecast pipeline for an upcoming event."""

    # Parse start time
    from datetime import timezone
    try:
        start_time = datetime.fromisoformat(event.startTime.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        start_time = datetime.utcnow() + timedelta(hours=6)

    # Run ML prediction
    prediction_result = run_prediction_pipeline(
        event_type=event.eventType,
        latitude=event.latitude,
        longitude=event.longitude,
        crowd_size=event.expectedAttendance,
        start_time=start_time,
        duration_hours=event.durationHours,
    )

    # Compute resource recommendations
    resource_result = compute_resource_plan(
        congestion_score=prediction_result["congestion_score"],
        crowd_size=event.expectedAttendance,
        event_type=event.eventType,
        latitude=event.latitude,
        longitude=event.longitude,
        duration_hours=event.durationHours,
    )

    # Find similar historical events
    similar_events = await find_similar_events(
        db=db,
        event_type=event.eventType,
        latitude=event.latitude,
        longitude=event.longitude,
        crowd_size=event.expectedAttendance,
    )

    # Persist event and prediction to DB
    db_event = Event(
        name=event.eventName,
        event_type=event.eventType,
        is_planned=True,
        latitude=event.latitude,
        longitude=event.longitude,
        location_name=event.venueName,
        crowd_size=event.expectedAttendance,
        start_time=start_time,
        duration_hours=event.durationHours,
        status="planned",
    )
    db.add(db_event)
    await db.flush()

    db_prediction = Prediction(
        event_id=db_event.id,
        congestion_risk_score=prediction_result["congestion_score"],
        risk_level=prediction_result["risk_level"],
        peak_congestion_time=start_time + timedelta(minutes=prediction_result["peak_offset_minutes"]),
        congestion_duration_minutes=int(event.durationHours * 40),
        impact_radius_km=prediction_result["affected_radius_km"],
        confidence_score=prediction_result["confidence_score"],
        estimated_delay_minutes=prediction_result["estimated_delay_minutes"],
    )
    db.add(db_prediction)

    db_resources = ResourcePlan(
        event_id=db_event.id,
        required_officers=resource_result["policePersonnel"],
        required_barricades=resource_result["barricades"],
        traffic_wardens=resource_result["trafficWardens"],
        cctv_units=resource_result["cctvUnits"],
        ambulance_standby=resource_result["ambulanceStandby"],
        deployment_priority=prediction_result["risk_level"].lower(),
        deployment_zones_json=json.dumps(resource_result["deploymentZones"]),
    )
    db.add(db_resources)
    await db.commit()

    # Build response
    return ForecastResponse(
        eventId=db_event.id,
        prediction=PredictionResponse(
            congestionRiskScore=round(prediction_result["congestion_score"]),
            estimatedDelayMinutes=prediction_result["estimated_delay_minutes"],
            affectedRadiusKm=prediction_result["affected_radius_km"],
            confidenceScore=round(prediction_result["confidence_score"]),
            peakOffsetMinutes=prediction_result["peak_offset_minutes"],
            riskLevel=prediction_result["risk_level"],
        ),
        resources=ResourceResponse(
            policePersonnel=resource_result["policePersonnel"],
            trafficWardens=resource_result["trafficWardens"],
            barricades=resource_result["barricades"],
            cctvUnits=resource_result["cctvUnits"],
            ambulanceStandby=resource_result["ambulanceStandby"],
            deploymentZones=[DeploymentZone(**z) for z in resource_result["deploymentZones"]],
        ),
        historicalComparison=[HistoricalEvent(**e) for e in similar_events],
    )
