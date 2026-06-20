"""
events.py — CRUD endpoints for events.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Event

router = APIRouter()


class EventListItem(BaseModel):
    id: str
    name: str
    eventType: str
    locationName: str | None
    crowdSize: int
    startTime: str | None
    status: str
    latitude: float
    longitude: float


@router.get("/events", response_model=list[EventListItem])
async def list_events(db: AsyncSession = Depends(get_db)):
    """List all events."""
    result = await db.execute(
        select(Event).order_by(Event.created_at.desc()).limit(50)
    )
    events = result.scalars().all()
    return [
        EventListItem(
            id=e.id,
            name=e.name,
            eventType=e.event_type,
            locationName=e.location_name,
            crowdSize=e.crowd_size,
            startTime=e.start_time.isoformat() if e.start_time else None,
            status=e.status,
            latitude=e.latitude,
            longitude=e.longitude,
        )
        for e in events
    ]


@router.get("/events/{event_id}")
async def get_event(event_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single event by ID."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventListItem(
        id=event.id,
        name=event.name,
        eventType=event.event_type,
        locationName=event.location_name,
        crowdSize=event.crowd_size,
        startTime=event.start_time.isoformat() if event.start_time else None,
        status=event.status,
        latitude=event.latitude,
        longitude=event.longitude,
    )

@router.put("/events/{event_id}/resolve")
async def resolve_event(event_id: str, db: AsyncSession = Depends(get_db)):
    """Mark an event as completed so it moves to validation."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.status = "completed"
    await db.commit()
    return {"status": "success", "event_id": event.id}

@router.delete("/events/{event_id}")
async def delete_event(event_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an event (and cascade to predictions/validations)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await db.delete(event)
    await db.commit()
    return {"status": "success", "event_id": event.id}
