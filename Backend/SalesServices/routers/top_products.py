# FILE: top_products.py

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List
import sys
import os
import httpx
import logging

# --- Configure logging & DB connection ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth Configuration ---
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# --- Define the new router ---
router_top_products = APIRouter(
    prefix="/auth/top_products",
    tags=["Top Products"]
)

# --- Authorization Helper ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Invalid token: {e.response.text}", headers={"WWW-Authenticate": "Bearer"})
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service unavailable.")

# --- Pydantic Models ---
class TopProductsRequest(BaseModel):
    cashierName: str

class TopProductItem(BaseModel):
    name: str
    sales: int # This matches the 'sales' key in your frontend's static data

# --- API Endpoint to Get Today's Top Selling Products for a Cashier ---
@router_top_products.post(
    "/today",
    response_model=List[TopProductItem],
    summary="Get today's top selling products for a specific cashier"
)
async def get_top_products_today(
    request: TopProductsRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # This query finds all completed sales for the cashier today,
            # groups them by the item name, sums the quantity for each item,
            # and orders them from most sold to least sold.
            # TOP 10 limits the result to the best sellers.
            sql = """
                SELECT
                    TOP 10
                    si.ItemName,
                    SUM(si.Quantity) AS TotalQuantitySold
                FROM Sales AS s
                JOIN SaleItems AS si ON s.SaleID = si.SaleID
                WHERE 
                    s.Status = 'completed'
                    AND s.CashierName = ?
                    AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                GROUP BY
                    si.ItemName
                ORDER BY
                    TotalQuantitySold DESC;
            """
            
            await cursor.execute(sql, request.cashierName)
            rows = await cursor.fetchall()
            
            # Format the database rows into the Pydantic response model
            top_products = [
                TopProductItem(name=row.ItemName, sales=row.TotalQuantitySold)
                for row in rows
            ]
            
            return top_products

    except Exception as e:
        logger.error(f"Error fetching top products for {request.cashierName}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch top selling products."
        )
    finally:
        if conn:
            await conn.close()