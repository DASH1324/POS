from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

# routers
from routers import wastelogs

app = FastAPI(title="Waste Microservice")

# include routers
app.include_router(wastelogs.router, prefix='/wastelogs', tags=['waste logs'])

# CORS setup to allow frontend and backend on ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4001",
        "http://192.168.100.32:4001",
        "http://localhost:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://192.168.100.14:8002",
        "http://localhost:8002",
        "http://192.168.100.14:9003",
        "http://localhost:9003",       
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# run app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=9003, host="127.0.0.1", reload=True)
