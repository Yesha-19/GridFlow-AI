"""
models.py — SQLAlchemy ORM model definitions for the Gridlock MVP.

Uses String IDs instead of PostgreSQL UUID for SQLite compatibility.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database.db import Base


def generate_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Mixins
# ---------------------------------------------------------------------------


class TimestampMixin:
    """Automatically managed created_at / updated_at columns."""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Event model
# ---------------------------------------------------------------------------


class Event(TimestampMixin, Base):
    """Represents a traffic-impacting event (planned or unplanned)."""

    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=generate_id, index=True)
    name = Column(String(255), nullable=False)
    event_type = Column(String(50), nullable=False, index=True)
    is_planned = Column(Boolean, default=True, nullable=False)

    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=True)

    # Crowd & timing
    crowd_size = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    duration_hours = Column(Float, nullable=False)

    # Lifecycle
    status = Column(String(20), default="planned", nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Relationships
    predictions = relationship("Prediction", back_populates="event", cascade="all, delete-orphan")
    resource_plan = relationship("ResourcePlan", back_populates="event", uselist=False, cascade="all, delete-orphan")
    alternate_routes = relationship("RouteAlternate", back_populates="event", cascade="all, delete-orphan")
    validation = relationship("Validation", back_populates="event", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Event id={self.id} name={self.name!r} type={self.event_type}>"


# ---------------------------------------------------------------------------
# Prediction model
# ---------------------------------------------------------------------------


class Prediction(TimestampMixin, Base):
    """Stores the ML model output for a single event."""

    __tablename__ = "predictions"

    id = Column(String(36), primary_key=True, default=generate_id, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core prediction outputs
    congestion_risk_score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    peak_congestion_time = Column(DateTime, nullable=True)
    congestion_duration_minutes = Column(Integer, nullable=True)
    impact_radius_km = Column(Float, nullable=False)

    # Model metadata
    model_version = Column(String(50), default="2.0.0", nullable=False)
    confidence_score = Column(Float, nullable=True)
    estimated_delay_minutes = Column(Integer, nullable=True)

    # Relationship
    event = relationship("Event", back_populates="predictions")

    def __repr__(self):
        return f"<Prediction id={self.id} score={self.congestion_risk_score:.1f}>"


# ---------------------------------------------------------------------------
# Resource Plan model
# ---------------------------------------------------------------------------


class ResourcePlan(TimestampMixin, Base):
    """Recommended traffic resource allocation derived from the prediction."""

    __tablename__ = "resource_plans"

    id = Column(String(36), primary_key=True, default=generate_id, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    required_officers = Column(Integer, nullable=False)
    required_barricades = Column(Integer, nullable=False)
    traffic_wardens = Column(Integer, nullable=False, default=0)
    cctv_units = Column(Integer, nullable=False, default=0)
    ambulance_standby = Column(Integer, nullable=False, default=0)
    deployment_priority = Column(String(20), nullable=False)
    deployment_notes = Column(Text, nullable=True)
    deployment_zones_json = Column(Text, nullable=True)  # JSON serialized zones

    # Relationship
    event = relationship("Event", back_populates="resource_plan")


# ---------------------------------------------------------------------------
# Route Alternate model
# ---------------------------------------------------------------------------


class RouteAlternate(TimestampMixin, Base):
    """A single alternate route suggestion."""

    __tablename__ = "route_alternates"

    id = Column(String(36), primary_key=True, default=generate_id, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)

    route_name = Column(String(100), nullable=False)
    route_index = Column(Integer, nullable=False)
    estimated_distance_km = Column(Float, nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    congestion_level = Column(String(20), nullable=True)
    avoidance_description = Column(Text, nullable=True)
    waypoints_json = Column(Text, nullable=True)
    recommended_for = Column(String(200), nullable=True)

    # Relationship
    event = relationship("Event", back_populates="alternate_routes")


# ---------------------------------------------------------------------------
# Validation model
# ---------------------------------------------------------------------------


class Validation(TimestampMixin, Base):
    """Post-event accuracy record comparing prediction to ground truth."""

    __tablename__ = "validations"

    id = Column(String(36), primary_key=True, default=generate_id, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    prediction_id = Column(String(36), ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True)

    # Ground-truth data submitted post-event
    actual_congestion_score = Column(Float, nullable=True)
    actual_delay_minutes = Column(Integer, nullable=True)
    actual_peak_time = Column(DateTime, nullable=True)
    actual_duration_minutes = Column(Integer, nullable=True)
    actual_crowd_size = Column(Integer, nullable=True)
    actual_risk_level = Column(String(20), nullable=True)
    actual_resource_usage = Column(Text, nullable=True)
    actual_incident_count = Column(Integer, nullable=True)

    # Derived accuracy metrics
    accuracy_percentage = Column(Float, nullable=True)
    score_delta = Column(Float, nullable=True)
    requires_review = Column(Boolean, default=False, nullable=False)
    validated = Column(Boolean, default=False, nullable=False, index=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Relationship
    event = relationship("Event", back_populates="validation")