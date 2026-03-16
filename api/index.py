import sys
import os
import traceback

# Add backend directory to path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
backend_path_abs = os.path.abspath(backend_path)
sys.path.insert(0, backend_path_abs)

try:
    from server import app
except Exception as e:
    # If import fails, return a debug FastAPI app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    error_info = {
        "import_error": str(e),
        "traceback": traceback.format_exc(),
        "backend_path": backend_path_abs,
        "backend_exists": os.path.exists(backend_path_abs),
        "backend_files": os.listdir(backend_path_abs) if os.path.exists(backend_path_abs) else [],
        "sys_path": sys.path[:5],
        "cwd": os.getcwd(),
        "file": __file__,
    }

    @app.get("/api/health")
    @app.get("/api/")
    @app.get("/api/{path:path}")
    async def debug_error(path: str = ""):
        return JSONResponse(error_info, status_code=500)
