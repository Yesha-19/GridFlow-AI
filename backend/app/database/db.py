"""
db.py — SQLAlchemy async engine with PostgreSQL.

Uses asyncpg for async PostgreSQL support.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

# ---------------------------------------------------------------------------
# Database URL — PostgreSQL
# ---------------------------------------------------------------------------


DATABASE_URL: str = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please provide a PostgreSQL connection string in the .env file.")

# --- ADD THESE TWO LINES ---
# Render gives 'postgres://', but SQLAlchemy async needs 'postgresql+asyncpg://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
# ---------------------------
# ---------------------------------------------------------------------------
# SQLAlchemy async engine
# ---------------------------------------------------------------------------
from sqlalchemy.pool import NullPool

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true",
    poolclass=NullPool,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Shared declarative base for all Gridlock ORM models."""


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an AsyncSession per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Startup helper
# ---------------------------------------------------------------------------


async def create_tables() -> None:
    """Create all ORM-mapped tables if they don't exist."""
    from app.database import models as _models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[db] Database tables created/verified OK")


# ---------------------------------------------------------------------------
# Context-manager session (for scripts / background tasks)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Standalone async context manager for use outside FastAPI's DI."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()