"""Strategy management endpoints."""
from fastapi import APIRouter, UploadFile, File
import os, shutil

router = APIRouter()
STRATEGIES_DIR = os.path.join(os.path.dirname(__file__), "..", "strategies")

@router.get("/")
async def list_strategies():
    files = [f.replace(".py", "") for f in os.listdir(STRATEGIES_DIR) if f.endswith(".py") and f != "__init__.py"]
    return {"strategies": files}

@router.post("/upload")
async def upload_strategy(file: UploadFile = File(...)):
    path = os.path.join(STRATEGIES_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"message": f"Strategy {file.filename} uploaded", "name": file.filename.replace('.py', '')}
