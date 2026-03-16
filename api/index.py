import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        return JSONResponse({
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }, status_code=500)

# Try to import motor
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    _motor_ok = True
    _motor_error = None
except Exception as e:
    _motor_ok = False
    _motor_error = str(e)

# Try to connect
_db = None
_client_error = None
if _motor_ok:
    try:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[os.environ.get('DB_NAME', 'tokenlens')]
    except Exception as e:
        _client_error = str(e)

@app.get("/api/diag")
async def diag():
    result = {
        "motor_import": _motor_ok,
        "motor_import_error": _motor_error,
        "client_error": _client_error,
        "db_connected": _db is not None,
        "mongo_url_set": bool(os.environ.get("MONGO_URL")),
    }
    if _db is not None:
        try:
            await _db.command("ping")
            result["db_ping"] = "ok"
        except Exception as e:
            result["db_ping"] = str(e)
    return result

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/")
async def root():
    return {"message": "TokenLens API"}
