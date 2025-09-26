# FILE: sales.py - UPDATED WITH PRODUCT/MERCHANDISE FILTER

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Literal, List, Union
from datetime import date, datetime, timedelta
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
    orderType: Optional[Literal['All', 'Store', 'Online']] = 'All'
    productType: Optional[Literal['All', 'Products', 'Merchandise']] = 'All'  # NEW: Added product type filter

class SalesMetricsResponse(BaseModel):
    totalSales: float
    cashSales: float
    gcashSales: float
    itemsSold: int

class DailyReportItem(BaseModel):
    productName: str
    category: Optional[str]
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float

class WeeklyReportItem(BaseModel):
    day: str
    transactions: int
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float
    bestItem: Optional[str]

class MonthlyReportItem(BaseModel):
    week: str
    period: str
    transactions: int
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float
    bestItem: Optional[str]

class YearlyReportItem(BaseModel):
    month: str
    transactions: int
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float
    bestItem: Optional[str]

class CustomReportItem(BaseModel):
    date: date
    transactions: int
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float
    bestItem: Optional[str]

class SalesReportRequest(BaseModel):
    reportType: Literal['daily', 'weekly', 'monthly', 'yearly', 'custom']
    startDate: Optional[date] = None
    endDate: Optional[date] = None

class Totals(BaseModel):
    transactions: int
    itemsSold: int
    storeSale: float
    onlineSale: float
    totalSale: float

class SalesReportResponse(BaseModel):
    data: List[Union[DailyReportItem, WeeklyReportItem, MonthlyReportItem, YearlyReportItem, CustomReportItem]]
    totals: Totals

# --- Helper to generate WHERE clause for order types ---
def get_order_type_condition(order_type: str) -> str:
    if order_type == 'Store':
        return "AND s.OrderType IN ('Dine In', 'Take Out')"
    elif order_type == 'Online':
        return "AND s.OrderType IN ('Pick Up', 'Delivery')"
    return "" # For 'All'

# --- NEW: Helper to generate WHERE clause for product types ---
def get_product_type_condition(product_type: str) -> str:
    if product_type == 'Products':
        return "AND si.Category != 'merchandise'"
    elif product_type == 'Merchandise':
        return "AND si.Category = 'merchandise'"
    return "" # For 'All'

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
            
            # Generate dynamic WHERE clauses for filters
            order_type_condition = get_order_type_condition(request.orderType)
            product_type_condition = get_product_type_condition(request.productType)  # NEW
            
            # Step 2: Calculate sales made only AFTER the session started
            sql = f"""
                WITH ItemTotalPrices AS (
                    SELECT
                        si.SaleID,
                        si.Quantity,
                        (si.UnitPrice * si.Quantity) + ISNULL(SUM(a.Price * sia.Quantity), 0) AS LineTotal
                    FROM SaleItems si
                    LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                    LEFT JOIN Addons a ON sia.AddonID = a.AddonID
                    JOIN Sales s ON si.SaleID = s.SaleID
                    WHERE s.Status = 'completed' 
                    AND s.CashierName = ? 
                    AND s.CreatedAt >= ? 
                    {order_type_condition}
                    {product_type_condition}
                    GROUP BY si.SaleItemID, si.SaleID, si.UnitPrice, si.Quantity
                )
                SELECT
                    ISNULL(SUM(itp.LineTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN itp.LineTotal ELSE 0 END), 0) AS CashSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'GCash' THEN itp.LineTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL((SELECT SUM(si2.Quantity) FROM SaleItems si2 
                        JOIN Sales s2 ON si2.SaleID = s2.SaleID
                        WHERE s2.Status = 'completed' 
                        AND s2.CashierName = ? 
                        AND s2.CreatedAt >= ?
                        {order_type_condition.replace('s.', 's2.')}
                        {product_type_condition.replace('si.', 'si2.')}
                    ), 0) AS ItemsSold
                FROM Sales s
                JOIN ItemTotalPrices itp ON s.SaleID = itp.SaleID
                WHERE 
                    s.Status = 'completed'
                    AND s.CashierName = ?
                    AND s.CreatedAt >= ?
                    {order_type_condition}
            """
            
            params = (
                request.cashierName, session_start_time,  # For CTE filtering
                request.cashierName, session_start_time,  # For ItemsSold subquery
                request.cashierName, session_start_time   # For main query
            )
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
            # Generate dynamic WHERE clauses for filters
            order_type_condition = get_order_type_condition(request.orderType)
            product_type_condition = get_product_type_condition(request.productType)  # NEW

            sql = f"""
                WITH ItemTotalPrices AS (
                    SELECT
                        si.SaleID,
                        si.Quantity,
                        (si.UnitPrice * si.Quantity) + ISNULL(SUM(a.Price * sia.Quantity), 0) AS LineTotal
                    FROM SaleItems si
                    LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                    LEFT JOIN Addons a ON sia.AddonID = a.AddonID
                    JOIN Sales s ON si.SaleID = s.SaleID
                    WHERE s.Status = 'completed' 
                    AND s.CashierName = ? 
                    AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE) 
                    {order_type_condition}
                    {product_type_condition}
                    GROUP BY si.SaleItemID, si.SaleID, si.UnitPrice, si.Quantity
                )
                SELECT
                    ISNULL(SUM(itp.LineTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'Cash' THEN itp.LineTotal ELSE 0 END), 0) AS CashSales,
                    ISNULL(SUM(CASE WHEN s.PaymentMethod = 'GCash' THEN itp.LineTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL((SELECT SUM(si2.Quantity) FROM SaleItems si2 
                        JOIN Sales s2 ON si2.SaleID = s2.SaleID
                        WHERE s2.Status = 'completed' 
                        AND s2.CashierName = ? 
                        AND CAST(s2.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                        {order_type_condition.replace('s.', 's2.')}
                        {product_type_condition.replace('si.', 'si2.')}
                    ), 0) AS ItemsSold
                FROM Sales s
                JOIN ItemTotalPrices itp ON s.SaleID = itp.SaleID
                WHERE 
                    s.Status = 'completed'
                    AND s.CashierName = ?
                    AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                    {order_type_condition}
            """
            
            params = (
                request.cashierName,  # For CTE filtering
                request.cashierName,  # For ItemsSold subquery
                request.cashierName   # For main query
            )
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            
            if row:
                return SalesMetricsResponse(
                    totalSales=float(row.TotalSales),
                    cashSales=float(row.CashSales),
                    gcashSales=float(row.GcashSales),
                    itemsSold=int(row.ItemsSold)
                )
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



# --- CORRECTED ENDPOINT FOR SALES REPORT ---
@router_sales_metrics.post(
    "/report",
    response_model=SalesReportResponse,
    summary="Generate a sales report for different time periods"
)
async def get_sales_report(
    request: SalesReportRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    base_query = """
        WITH ItemTotalPrices AS (
            SELECT
                si.SaleID, si.ItemName, si.Category, si.Quantity,
                (si.UnitPrice * si.Quantity) + ISNULL(SUM(a.Price * sia.Quantity), 0) AS LineTotal
            FROM SaleItems si
            LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
            LEFT JOIN Addons a ON sia.AddonID = a.AddonID
            GROUP BY si.SaleItemID, si.SaleID, si.ItemName, si.Category, si.UnitPrice, si.Quantity
        ),
        AggregatedSales AS (
            SELECT
                s.SaleID, s.OrderType, s.CreatedAt, itp.ItemName, itp.Category, itp.Quantity, itp.LineTotal
            FROM Sales s
            JOIN ItemTotalPrices itp ON s.SaleID = itp.SaleID
            WHERE s.Status = 'completed' {date_filter}
        )
    """

    date_filter = ""
    params = []
    
    # Use the provided startDate as the reference date, otherwise default to today
    reference_date = request.startDate if request.startDate else date.today()

    if request.reportType == 'daily':
        query = base_query + """
            SELECT
                ItemName AS productName, Category AS category, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale
            FROM AggregatedSales GROUP BY ItemName, Category ORDER BY totalSale DESC
        """
        date_filter = "AND CAST(s.CreatedAt AS DATE) = ?"
        params.append(reference_date)
    
    elif request.reportType == 'weekly':
        query = base_query + """
            , RankedItems AS (
                SELECT ItemName, DATENAME(weekday, CreatedAt) as DayOfWeek,
                       ROW_NUMBER() OVER(PARTITION BY DATENAME(weekday, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn
                FROM AggregatedSales GROUP BY ItemName, DATENAME(weekday, CreatedAt)
            )
            SELECT
                DATENAME(weekday, CreatedAt) AS day, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.DayOfWeek = DATENAME(weekday, AggregatedSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM AggregatedSales GROUP BY DATENAME(weekday, CreatedAt) ORDER BY MIN(CreatedAt)
        """
        # SQL Server specific query to get the start of the week for the given reference date
        date_filter = "AND s.CreatedAt >= DATEADD(wk, DATEDIFF(wk, 7, ?), 0) AND s.CreatedAt < DATEADD(wk, DATEDIFF(wk, 7, ?), 7)"
        params.extend([reference_date, reference_date])

    elif request.reportType == 'monthly':
        query = base_query + """
            , RankedItems AS (
                SELECT ItemName, DATEPART(week, CreatedAt) as WeekNum,
                       ROW_NUMBER() OVER(PARTITION BY DATEPART(week, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn
                FROM AggregatedSales GROUP BY ItemName, DATEPART(week, CreatedAt)
            )
            SELECT
                DATEPART(week, CreatedAt) AS weekNumber, MIN(CAST(CreatedAt AS DATE)) as weekStart, MAX(CAST(CreatedAt AS DATE)) as weekEnd,
                COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.WeekNum = DATEPART(week, AggregatedSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM AggregatedSales GROUP BY DATEPART(week, CreatedAt) ORDER BY weekNumber
        """
        date_filter = "AND DATEPART(month, s.CreatedAt) = DATEPART(month, ?) AND DATEPART(year, s.CreatedAt) = DATEPART(year, ?)"
        params.extend([reference_date, reference_date])

    elif request.reportType == 'yearly':
        query = base_query + """
            , RankedItems AS (
                SELECT ItemName, DATENAME(month, CreatedAt) as MonthName,
                       ROW_NUMBER() OVER(PARTITION BY DATENAME(month, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn
                FROM AggregatedSales GROUP BY ItemName, DATENAME(month, CreatedAt)
            )
            SELECT
                DATENAME(month, CreatedAt) AS month, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.MonthName = DATENAME(month, AggregatedSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM AggregatedSales GROUP BY DATENAME(month, CreatedAt), DATEPART(month, CreatedAt) ORDER BY DATEPART(month, CreatedAt)
        """
        date_filter = "AND DATEPART(year, s.CreatedAt) = DATEPART(year, ?)"
        params.append(reference_date)

    elif request.reportType == 'custom':
        if not request.startDate or not request.endDate:
            raise HTTPException(status_code=400, detail="Start date and end date are required for custom reports.")
        query = base_query + """
            , RankedItems AS (
                SELECT ItemName, CAST(CreatedAt AS DATE) as SaleDate,
                       ROW_NUMBER() OVER(PARTITION BY CAST(CreatedAt AS DATE) ORDER BY SUM(LineTotal) DESC) as rn
                FROM AggregatedSales GROUP BY ItemName, CAST(CreatedAt AS DATE)
            )
            SELECT
                CAST(CreatedAt AS DATE) AS date, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.SaleDate = CAST(AggregatedSales.CreatedAt AS DATE) AND ri.rn = 1) AS bestItem
            FROM AggregatedSales GROUP BY CAST(CreatedAt AS DATE) ORDER BY date
        """
        date_filter = "AND CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?"
        params.extend([request.startDate, request.endDate])

    else:
        raise HTTPException(status_code=400, detail="Invalid report type.")

    final_sql = query.format(date_filter=date_filter)

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute(final_sql, tuple(params))
            rows = await cursor.fetchall()
            
            results = []
            totals = {"transactions": 0, "itemsSold": 0, "storeSale": 0.0, "onlineSale": 0.0, "totalSale": 0.0}

            for row in rows:
                row_dict = dict(zip([column[0] for column in cursor.description], row))
                
                totals["itemsSold"] += row_dict.get("itemsSold", 0)
                totals["storeSale"] += float(row_dict.get("storeSale", 0.0))
                totals["onlineSale"] += float(row_dict.get("onlineSale", 0.0))
                totals["totalSale"] += float(row_dict.get("totalSale", 0.0))
                if "transactions" in row_dict:
                    totals["transactions"] += row_dict["transactions"]

                if request.reportType == 'monthly':
                    row_dict["week"] = f"Week {row_dict.get('weekNumber', '')}"
                    start_date = row_dict.get('weekStart')
                    end_date = row_dict.get('weekEnd')
                    if start_date and end_date:
                        row_dict["period"] = f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')}"

                results.append(row_dict)

            return SalesReportResponse(data=results, totals=totals)

    except Exception as e:
        logger.error(f"Error generating sales report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate sales report.")
    finally:
        if conn:
            await conn.close()