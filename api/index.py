import os
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/health")
async def health():
    return {"status": "healthy", "env_ok": bool(os.environ.get("MONGO_URL"))}

@app.get("/api/")
async def root():
    return {"message": "TokenLens API"}
