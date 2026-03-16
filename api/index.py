import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

db = None

@asynccontextmanager
async def lifespan(application: FastAPI):
    global db
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'tokenlens')]
    yield
    client.close()

app = FastAPI(lifespan=lifespan)

@app.get("/api/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "healthy", "db": "connected"}
    except Exception as e:
        return JSONResponse({"status": "db_error", "error": str(e)}, status_code=500)

@app.get("/api/")
async def root():
    return {"message": "TokenLens API", "status": "healthy"}
