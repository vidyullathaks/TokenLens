import sys
import os
import traceback
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from server import app
    _import_error = None
except Exception as e:
    _import_error = {"error": str(e), "tb": traceback.format_exc(), "path": os.path.dirname(os.path.abspath(__file__)), "files": os.listdir(os.path.dirname(os.path.abspath(__file__)))}
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.get("/api/{path:path}")
    async def err(path: str = ""):
        return JSONResponse(_import_error, status_code=500)

    @app.get("/api/")
    async def err2():
        return JSONResponse(_import_error, status_code=500)
