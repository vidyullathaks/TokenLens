import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tokenlens')]

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
