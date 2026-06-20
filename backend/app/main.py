"""
main.py — FastAPI application for the Gridlock MVP backend.

Provides REST API for event-driven congestion prediction, resource
recommendation, and diversion routing. Uses SQLite for zero-setup demo.
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add project root to path for ML imports
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))

from app.api.prediction import router as prediction_router
from app.api.routing import router as routing_router
from app.api.validation import router as validation_router
from app.api.events import router as events_router
from app.api.analytics import router as analytics_router
from app.database.db import create_tables
from app.database.seed_data import seed_historical_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — setup and teardown."""
    # Startup
    print("-" * 60)
    print("          GRIDLOCK 2.0 — Backend API Server              ")
    print("-" * 60)
    await create_tables()
    await seed_historical_data()
    print("[server] API ready at http://localhost:8000")
    print("[server] Docs at http://localhost:8000/docs")
    yield
    # Shutdown
    print("[server] Shutting down...")


app = FastAPI(
    title="Gridlock 2.0 API",
    description="Event-Driven Congestion Prediction & Resource Optimization",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "*",  # Allow all for demo
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(prediction_router, prefix="/api", tags=["Prediction"])
app.include_router(routing_router, prefix="/api", tags=["Routing"])
app.include_router(validation_router, prefix="/api", tags=["Validation"])
app.include_router(events_router, prefix="/api", tags=["Events"])
app.include_router(analytics_router, prefix="/api", tags=["Analytics"])


@app.get("/")
async def root():
    return {
        "service": "Gridlock 2.0 API",
        "status": "online",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "gridlock-backend"}


