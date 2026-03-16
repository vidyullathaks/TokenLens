from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/api/test")
async def test():
    return {"status": "minimal fastapi works"}
