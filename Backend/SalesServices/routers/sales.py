# FILE: sales.py

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
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
router_sales_metrics = APIRouter(
    prefix="/auth/sales_metrics",
    tags=["Sales Metrics"]
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
class SalesMetricsRequest(BaseModel):
    cashierName: str

class SalesMetricsResponse(BaseModel):
    totalSales: float
    cashSales: float
    gcashSales: float
    itemsSold: int

# --- NEW ENDPOINT FOR CURRENT SESSION METRICS ---
@router_sales_metrics.post(
    "/current_session",
    response_model=SalesMetricsResponse,
    summary="Get Sales Metrics for the Current Active Session"
)
async def get_current_session_sales_metrics(
    request: SalesMetricsRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # Step 1: Find the start time of the cashier's active session
            await cursor.execute(
                "SELECT SessionStart FROM CashierSessions WHERE CashierName = ? AND Status = 'Active'",
                request.cashierName
            )
            session_row = await cursor.fetchone()

            if not session_row:
                return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)

            session_start_time = session_row.SessionStart

            # Step 2: Calculate sales made only AFTER the session started
            # THIS QUERY IS NOW CORRECTED TO INCLUDE ADDON PRICES
            sql = """
                WITH ItemTotalPrices AS (
                    SELECT
                        si.SaleID,
                        si.Quantity,
                        -- Calculate total price for one item line, including addons
                        (si.UnitPrice * si.Quantity) + ISNULL(SUM(a.Price * sia.Quantity), 0) AS LineTotal
                    FROM SaleItems si
                    LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                    LEFT JOIN Addons a ON sia.AddonID = a.AddonID
                    GROUP BY si.SaleItemID, si.SaleID, si.UnitPrice, si.Quantity
                )
                SELECT
                    ISNULL(SUM(itp.LineTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN itp.LineTotal ELSE 0 END), 0) AS CashSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'GCash' THEN itp.LineTotal ELSE 0 END), 0) AS GcashSales,
                    -- ItemsSold calculation remains the same, summing the quantity of main items
                    ISNULL((SELECT SUM(Quantity) FROM SaleItems WHERE SaleID IN (
                        SELECT SaleID FROM Sales WHERE Status = 'completed' AND CashierName = ? AND CreatedAt >= ?
                    )), 0) AS ItemsSold
                FROM Sales s
                JOIN ItemTotalPrices itp ON s.SaleID = itp.SaleID
                WHERE 
                    s.Status = 'completed'
                    AND s.CashierName = ?
                    AND s.CreatedAt >= ?;
            """
            
            # Parameters need to be duplicated for the subquery and the main query
            params = (request.cashierName, session_start_time, request.cashierName, session_start_time)
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            
            if row:
                return SalesMetricsResponse(
                    totalSales=float(row.TotalSales),
                    cashSales=float(row.CashSales),
                    gcashSales=float(row.GcashSales),
                    itemsSold=int(row.ItemsSold)
                )
            return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)

    except Exception as e:
        logger.error(f"Error fetching current session metrics for {request.cashierName}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales metrics for the current session.")
    finally:
        if conn:
            await conn.close()


# --- Endpoint to Get Today's Total Sales Metrics for a Cashier (for reports, etc.) ---
@router_sales_metrics.post(
    "/today",
    response_model=SalesMetricsResponse,
    summary="Get ALL of Today's Sales Metrics for a Specific Cashier"
)
async def get_todays_sales_metrics(
    request: SalesMetricsRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view sales metrics."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # THIS QUERY IS NOW CORRECTED TO INCLUDE ADDON PRICES
            sql = """
                WITH ItemTotalPrices AS (
                    SELECT
                        si.SaleID,
                        si.Quantity,
                        (si.UnitPrice * si.Quantity) + ISNULL(SUM(a.Price * sia.Quantity), 0) AS LineTotal
                    FROM SaleItems si
                    LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                    LEFT JOIN Addons a ON sia.AddonID = a.AddonID
                    GROUP BY si.SaleItemID, si.SaleID, si.UnitPrice, si.Quantity
                )
                SELECT
                    ISNULL(SUM(itp.LineTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN itp.LineTotal ELSE 0 END), 0) AS CashSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'GCash' THEN itp.LineTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL((SELECT SUM(Quantity) FROM SaleItems WHERE SaleID IN (
                        SELECT SaleID FROM Sales WHERE Status = 'completed' AND CashierName = ? AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                    )), 0) AS ItemsSold
                FROM Sales s
                JOIN ItemTotalPrices itp ON s.SaleID = itp.SaleID
                WHERE 
                    s.Status = 'completed'
                    AND s.CashierName = ?
                    AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE);
            """
            
            # Parameter is used in the subquery and main query
            params = (request.cashierName, request.cashierName)
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            
            if row:
                response_data = SalesMetricsResponse(
                    totalSales=float(row.TotalSales),
                    cashSales=float(row.CashSales),
                    gcashSales=float(row.GcashSales),
                    itemsSold=int(row.ItemsSold)
                )
                return response_data
            else:
                return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)

    except Exception as e:
        logger.error(f"Error fetching sales metrics for {request.cashierName}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sales metrics."
        )
    finally:
        if conn:
            await conn.close()