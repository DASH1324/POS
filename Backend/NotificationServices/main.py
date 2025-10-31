import asyncio
import logging
from typing import Set

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Import the router from notifications.py
from routers.notifications import router, set_connection_manager

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"New WebSocket connection. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        tasks = [conn.send_json(message) for conn in self.active_connections]
        await asyncio.gather(*tasks, return_exceptions=False)
        logger.info(f"Broadcasted message to {len(self.active_connections)} client(s).")

# --- Initialize Manager ---
manager = ConnectionManager()

# Inject the manager into the notifications router
set_connection_manager(manager)

# --- FastAPI App ---
app = FastAPI(title="Notification Service API", version="1.0.0")

# --- WebSocket Endpoint ---
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- App Configuration ---
app.include_router(router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4001", "http://127.0.0.1:4001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run("main:app", port=9004, host="0.0.0.0", reload=True)