import asyncio
from app.database.db import get_session, engine
from app.database.models import Event, Prediction, Validation, ResourcePlan
from sqlalchemy import text

async def reset():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        # Cascade drop to avoid foreign key violations
        await conn.execute(text("DROP TABLE IF EXISTS validations CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS resource_plans CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS predictions CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS events CASCADE;"))
    
    print("Re-creating tables and seeding data...")
    from app.database.db import create_tables
    from app.database.seed_data import seed_historical_data
    await create_tables()
    await seed_historical_data()
    print("Reset complete!")

if __name__ == "__main__":
    asyncio.run(reset())
