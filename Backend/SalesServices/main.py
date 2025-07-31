from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Imports for your routers ---
from routers import pos_router, purchase_order, cancelled_order, sales
from routers.top_products import router_top_products

app = FastAPI(
    title="POS and Order Service API",
    description="Handles sales creation and retrieves processing orders.",
    version="1.0.0"
)

# --- Include all your routers with their correct variable names ---

app.include_router(pos_router.router_sales)
app.include_router(purchase_order.router_purchase_order)
app.include_router(cancelled_order.router_cancelled_order)
app.include_router(router_top_products)

# --- THIS IS THE FIX ---
# The object in sales.py is named 'router_sales_metrics'
app.include_router(sales.router_sales_metrics)

# --- Your CORS middleware (no changes needed) ---
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
        "http://192.168.100.14:8003",
        "http://localhost:8003",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health check endpoint (no changes needed) ---
@app.get("/", tags=["Health Check"])
def read_root():
    return {"status": "ok", "message": "POS Service is running."}

# --- Uvicorn runner (no changes needed) ---
if __name__ == "__main__":
    import uvicorn
    
    print("--- Starting POS Service on http://0.0.0.0:9000 ---")
    print("API docs available at http://127.0.0.1:9000/docs")
    uvicorn.run("main:app", port=9000, host="0.0.0.0", reload=True)