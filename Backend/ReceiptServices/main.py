from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# --- Import Routers ---
from routers.receipt import router as receipt_router

app = FastAPI(
    title="Receipt Configuration Service API",
    description="API for managing receipt configuration and settings.",
    version="1.0.0"
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:4001",
        "http://localhost:4002",
        "http://localhost:9000",
        "http://localhost:9001",
        "http://localhost:9002",
        "http://localhost:9005",
        "http://localhost:9006",  # Self
        "http://127.0.0.1:9006",
        "http://192.168.100.32:4000",
        "http://192.168.100.32:4001",
        "http://192.168.100.14:4002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(receipt_router, prefix="/api")

# --- Static Files (Optional) ---
UPLOAD_DIR_NAME = "uploads"
os.makedirs(UPLOAD_DIR_NAME, exist_ok=True)
app.mount(f"/{UPLOAD_DIR_NAME}", StaticFiles(directory=UPLOAD_DIR_NAME), name=UPLOAD_DIR_NAME)

# --- Root Endpoint ---
@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the Receipt Configuration Service API. Visit /docs for documentation."}

# --- Uvicorn Runner ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=9006, host="0.0.0.0", reload=True)