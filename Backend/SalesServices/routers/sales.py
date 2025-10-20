# FILE: sales.py - UPDATED TO INCLUDE E-WALLET IN GCASH SALES

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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://1227.0.0.1:4000/auth/token")
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
    productType: Optional[Literal['All', 'Products', 'Merchandise']] = 'All'

class SalesMetricsByDateRequest(BaseModel):
    cashierName: str
    date: date
    orderType: Optional[Literal['All', 'Store', 'Online']] = 'All'
    productType: Optional[Literal['All', 'Products', 'Merchandise']] = 'All'

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

# --- Helper to generate WHERE clause for product types ---
def get_product_type_condition(product_type: str) -> str:
    if product_type == 'Products':
        return "AND si.Category != 'merchandise'"
    elif product_type == 'Merchandise':
        return "AND si.Category = 'merchandise'"
    return "" # For 'All'


@router_sales_metrics.post(
    "/current_session",
    response_model=SalesMetricsResponse,
    summary="Get Sales Metrics for the Current Active Session"
)
async def get_current_session_sales_metrics(
    request: SalesMetricsRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT SessionStart FROM CashierSessions WHERE CashierName = ? AND Status = 'Active'", request.cashierName)
            session_row = await cursor.fetchone()
            if not session_row:
                return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)
            session_start_time = session_row.SessionStart
            order_type_condition = get_order_type_condition(request.orderType)
            product_type_condition = get_product_type_condition(request.productType)
            sql = f"""
                WITH SaleTotals AS (
                    SELECT s.SaleID, s.PaymentMethod,
                        ((SELECT ISNULL(SUM(si.UnitPrice * si.Quantity), 0) FROM SaleItems si WHERE si.SaleID = s.SaleID {product_type_condition}) +
                         (SELECT ISNULL(SUM(a.Price * sia.Quantity), 0) FROM SaleItems si JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID JOIN Addons a ON sia.AddonID = a.AddonID WHERE si.SaleID = s.SaleID {product_type_condition}))
                        - (ISNULL(s.PromotionalDiscountAmount, 0) + ISNULL(s.TotalDiscountAmount, 0)) AS FinalTotal,
                        (SELECT ISNULL(SUM(si2.Quantity), 0) FROM SaleItems si2 WHERE si2.SaleID = s.SaleID {product_type_condition.replace('si.','si2.')}) as ItemsInSale
                    FROM Sales s WHERE s.Status = 'completed' AND s.CashierName = ? AND s.CreatedAt >= ? {order_type_condition}
                )
                SELECT ISNULL(SUM(FinalTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN FinalTotal ELSE 0 END), 0) AS CashSales,
                    -- MODIFIED: Include 'E-Wallet' with 'GCash'
                    ISNULL(SUM(CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN FinalTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL(SUM(ItemsInSale), 0) AS ItemsSold
                FROM SaleTotals
            """
            params = (request.cashierName, session_start_time)
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            if row: return SalesMetricsResponse(totalSales=float(row.TotalSales), cashSales=float(row.CashSales), gcashSales=float(row.GcashSales), itemsSold=int(row.ItemsSold))
            return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)
    except Exception as e:
        logger.error(f"Error fetching current session metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales metrics.")
    finally:
        if conn: await conn.close()


@router_sales_metrics.post(
    "/today",
    response_model=SalesMetricsResponse,
    summary="Get ALL of Today's Sales Metrics for a Specific Cashier"
)
async def get_todays_sales_metrics(
    request: SalesMetricsRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            order_type_condition = get_order_type_condition(request.orderType)
            product_type_condition = get_product_type_condition(request.productType)
            sql = f"""
                WITH SaleTotals AS (
                    SELECT s.SaleID, s.PaymentMethod,
                        ((SELECT ISNULL(SUM(si.UnitPrice * si.Quantity), 0) FROM SaleItems si WHERE si.SaleID = s.SaleID {product_type_condition}) +
                         (SELECT ISNULL(SUM(a.Price * sia.Quantity), 0) FROM SaleItems si JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID JOIN Addons a ON sia.AddonID = a.AddonID WHERE si.SaleID = s.SaleID {product_type_condition}))
                        - (ISNULL(s.PromotionalDiscountAmount, 0) + ISNULL(s.TotalDiscountAmount, 0)) AS FinalTotal,
                        (SELECT ISNULL(SUM(si2.Quantity), 0) FROM SaleItems si2 WHERE si2.SaleID = s.SaleID {product_type_condition.replace('si.','si2.')}) as ItemsInSale
                    FROM Sales s WHERE s.Status = 'completed' AND s.CashierName = ? AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE) {order_type_condition}
                )
                SELECT ISNULL(SUM(FinalTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN FinalTotal ELSE 0 END), 0) AS CashSales,
                    -- MODIFIED: Include 'E-Wallet' with 'GCash'
                    ISNULL(SUM(CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN FinalTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL(SUM(ItemsInSale), 0) AS ItemsSold
                FROM SaleTotals
            """
            params = (request.cashierName,)
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            if row: return SalesMetricsResponse(totalSales=float(row.TotalSales), cashSales=float(row.CashSales), gcashSales=float(row.GcashSales), itemsSold=int(row.ItemsSold))
            return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)
    except Exception as e:
        logger.error(f"Error fetching today's sales metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales metrics.")
    finally:
        if conn: await conn.close()


@router_sales_metrics.post(
    "/by_date",
    response_model=SalesMetricsResponse,
    summary="Get Sales Metrics for a Specific Cashier by Date"
)
async def get_sales_metrics_by_date(
    request: SalesMetricsByDateRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["cashier", "admin", "manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            order_type_condition = get_order_type_condition(request.orderType)
            product_type_condition = get_product_type_condition(request.productType)

            sql = f"""
                WITH SaleTotals AS (
                    SELECT
                        s.SaleID,
                        s.PaymentMethod,
                        (
                            (SELECT ISNULL(SUM(si.UnitPrice * si.Quantity), 0) FROM SaleItems si WHERE si.SaleID = s.SaleID {product_type_condition}) +
                            (SELECT ISNULL(SUM(a.Price * sia.Quantity), 0) FROM SaleItems si JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID JOIN Addons a ON sia.AddonID = a.AddonID WHERE si.SaleID = s.SaleID {product_type_condition})
                        ) - (ISNULL(s.PromotionalDiscountAmount, 0) + ISNULL(s.TotalDiscountAmount, 0)) AS FinalTotal,
                        (
                            SELECT ISNULL(SUM(si2.Quantity), 0) 
                            FROM SaleItems si2 
                            WHERE si2.SaleID = s.SaleID {product_type_condition.replace('si.','si2.')}
                        ) as ItemsInSale
                    FROM Sales s
                    WHERE s.Status = 'completed' 
                    AND s.CashierName = ? 
                    AND CAST(s.CreatedAt AS DATE) = ? 
                    {order_type_condition}
                )
                SELECT
                    ISNULL(SUM(FinalTotal), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN FinalTotal ELSE 0 END), 0) AS CashSales,
                    -- MODIFIED: Include 'E-Wallet' with 'GCash'
                    ISNULL(SUM(CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN FinalTotal ELSE 0 END), 0) AS GcashSales,
                    ISNULL(SUM(ItemsInSale), 0) AS ItemsSold
                FROM SaleTotals
            """
            
            params = (request.cashierName, request.date)
            await cursor.execute(sql, params)
            row = await cursor.fetchone()
            
            if row:
                return SalesMetricsResponse(totalSales=float(row.TotalSales), cashSales=float(row.CashSales), gcashSales=float(row.GcashSales), itemsSold=int(row.ItemsSold))
            return SalesMetricsResponse(totalSales=0.0, cashSales=0.0, gcashSales=0.0, itemsSold=0)
    except Exception as e:
        logger.error(f"Error fetching sales metrics for date {request.date}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales metrics by date.")
    finally:
        if conn: await conn.close()


@router_sales_metrics.post(
    "/report",
    response_model=SalesReportResponse,
    summary="Generate a sales report for different time periods"
)
async def get_sales_report(
    request: SalesReportRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["admin", "manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    base_query = """
        WITH SaleAggregates AS (
            SELECT s.SaleID, s.OrderType, s.CreatedAt, si.ItemName, si.Category, si.Quantity,
                ((si.UnitPrice * si.Quantity) + ISNULL((SELECT SUM(a.Price * sia.Quantity) FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = si.SaleItemID), 0)) AS ItemTotalBeforeDiscount,
                ((((si.UnitPrice * si.Quantity) + ISNULL((SELECT SUM(a.Price * sia.Quantity) FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = si.SaleItemID), 0)) / 
                    NULLIF((SELECT SUM(si_inner.UnitPrice * si_inner.Quantity) + ISNULL(SUM(a_inner.Price * sia_inner.Quantity), 0) FROM SaleItems si_inner LEFT JOIN SaleItemAddons sia_inner ON si_inner.SaleItemID = sia_inner.SaleItemID LEFT JOIN Addons a_inner ON sia_inner.AddonID = a_inner.AddonID WHERE si_inner.SaleID = s.SaleID), 0)
                ) * (ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0))) AS ProportionalDiscount
            FROM Sales s JOIN SaleItems si ON s.SaleID = si.SaleID WHERE s.Status = 'completed' {date_filter}
        ),
        FinalSales AS (
            SELECT SaleID, OrderType, CreatedAt, ItemName, Category, Quantity, (ItemTotalBeforeDiscount - ISNULL(ProportionalDiscount, 0)) as LineTotal FROM SaleAggregates
        )
    """
    date_filter = ""
    params = []
    reference_date = request.startDate if request.startDate else date.today()
    if request.reportType == 'daily':
        query = base_query + """
            SELECT ItemName AS productName, Category AS category, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale
            FROM FinalSales GROUP BY ItemName, Category ORDER BY totalSale DESC
        """
        date_filter = "AND CAST(s.CreatedAt AS DATE) = ?"
        params.append(reference_date)
    elif request.reportType == 'weekly':
        query = base_query + """
            , RankedItems AS ( SELECT ItemName, DATENAME(weekday, CreatedAt) as DayOfWeek, ROW_NUMBER() OVER(PARTITION BY DATENAME(weekday, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn FROM FinalSales GROUP BY ItemName, DATENAME(weekday, CreatedAt) )
            SELECT DATENAME(weekday, CreatedAt) AS day, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.DayOfWeek = DATENAME(weekday, FinalSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM FinalSales GROUP BY DATENAME(weekday, CreatedAt), DATEPART(weekday, CreatedAt) ORDER BY DATEPART(weekday, CreatedAt)
        """
        date_filter = "AND CAST(s.CreatedAt AS DATE) >= DATEADD(day, -6, CAST(? AS DATE)) AND CAST(s.CreatedAt AS DATE) <= CAST(? AS DATE)"
        params.extend([reference_date, reference_date])
    elif request.reportType == 'monthly':
        query = base_query + """
            , RankedItems AS ( SELECT ItemName, DATEPART(week, CreatedAt) as WeekNum, ROW_NUMBER() OVER(PARTITION BY DATEPART(week, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn FROM FinalSales GROUP BY ItemName, DATEPART(week, CreatedAt) )
            SELECT DATEPART(week, CreatedAt) AS weekNumber, MIN(CAST(CreatedAt AS DATE)) as weekStart, MAX(CAST(CreatedAt AS DATE)) as weekEnd,
                COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.WeekNum = DATEPART(week, FinalSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM FinalSales GROUP BY DATEPART(week, CreatedAt) ORDER BY weekNumber
        """
        date_filter = "AND DATEPART(month, s.CreatedAt) = DATEPART(month, ?) AND DATEPART(year, s.CreatedAt) = DATEPART(year, ?)"
        params.extend([reference_date, reference_date])
    elif request.reportType == 'yearly':
        query = base_query + """
            , RankedItems AS ( SELECT ItemName, DATENAME(month, CreatedAt) as MonthName, ROW_NUMBER() OVER(PARTITION BY DATENAME(month, CreatedAt) ORDER BY SUM(LineTotal) DESC) as rn FROM FinalSales GROUP BY ItemName, DATENAME(month, CreatedAt) )
            SELECT DATENAME(month, CreatedAt) AS month, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.MonthName = DATENAME(month, FinalSales.CreatedAt) AND ri.rn = 1) AS bestItem
            FROM FinalSales GROUP BY DATENAME(month, CreatedAt), DATEPART(month, CreatedAt) ORDER BY DATEPART(month, CreatedAt)
        """
        date_filter = "AND DATEPART(year, s.CreatedAt) = DATEPART(year, ?)"
        params.append(reference_date)
    elif request.reportType == 'custom':
        if not request.startDate or not request.endDate: raise HTTPException(status_code=400, detail="Start date and end date are required for custom reports.")
        query = base_query + """
            , RankedItems AS ( SELECT ItemName, CAST(CreatedAt AS DATE) as SaleDate, ROW_NUMBER() OVER(PARTITION BY CAST(CreatedAt AS DATE) ORDER BY SUM(LineTotal) DESC) as rn FROM FinalSales GROUP BY ItemName, CAST(CreatedAt AS DATE) )
            SELECT CAST(CreatedAt AS DATE) AS date, COUNT(DISTINCT SaleID) AS transactions, SUM(Quantity) AS itemsSold,
                ISNULL(SUM(CASE WHEN OrderType IN ('Dine In', 'Take Out') THEN LineTotal ELSE 0 END), 0) AS storeSale,
                ISNULL(SUM(CASE WHEN OrderType IN ('Pick Up', 'Delivery') THEN LineTotal ELSE 0 END), 0) AS onlineSale,
                SUM(LineTotal) AS totalSale,
                (SELECT TOP 1 ItemName FROM RankedItems ri WHERE ri.SaleDate = CAST(FinalSales.CreatedAt AS DATE) AND ri.rn = 1) AS bestItem
            FROM FinalSales GROUP BY CAST(CreatedAt AS DATE) ORDER BY date
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
                if "transactions" in row_dict: totals["transactions"] += row_dict["transactions"]
                if request.reportType == 'monthly':
                    row_dict["week"] = f"Week {row_dict.get('weekNumber', '')}"
                    start_date = row_dict.get('weekStart')
                    end_date = row_dict.get('weekEnd')
                    if start_date and end_date: row_dict["period"] = f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')}"
                results.append(row_dict)
            return SalesReportResponse(data=results, totals=totals)
    except Exception as e:
        logger.error(f"Error generating sales report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate sales report.")
    finally:
        if conn: await conn.close()

# The rest of the file remains unchanged.
class SalesMonitoringRequest(BaseModel):
    dateRange: Literal['today', 'week', 'month']
    selectedProduct: Optional[str] = 'all'
    selectedCategory: Optional[str] = 'all'

class ProductSalesDetail(BaseModel):
    id: int
    product: str
    category: str
    revenue: float
    profit: float
    quantity: int
    date: str
    orderType: str

class SalesMonitoringResponse(BaseModel):
    salesData: List[ProductSalesDetail]
    totalRevenue: float
    totalProfit: float
    totalQuantity: int
    profitMargin: float
    transactionCount: int

@router_sales_metrics.post(
    "/monitoring",
    response_model=SalesMonitoringResponse,
    summary="Get Sales Monitoring Data with Filters"
)
async def get_sales_monitoring_data(
    request: SalesMonitoringRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["admin", "manager", "cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            date_condition = ""
            if request.dateRange == 'today':
                date_condition = "AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)"
            elif request.dateRange == 'week':
                date_condition = "AND s.CreatedAt >= DATEADD(day, -7, GETDATE())"
            elif request.dateRange == 'month':
                date_condition = "AND s.CreatedAt >= DATEADD(month, -1, GETDATE())"
            
            product_condition = ""
            category_condition = ""
            params = []
            
            if request.selectedProduct and request.selectedProduct != 'all':
                product_condition = "AND si.ItemName = ?"
                params.append(request.selectedProduct)
            
            if request.selectedCategory and request.selectedCategory != 'all':
                category_condition = "AND si.Category = ?"
                params.append(request.selectedCategory)
            
            sql = f"""
                WITH SaleCalculations AS (
                    SELECT 
                        s.SaleID, si.SaleItemID, si.ItemName, si.Category, si.Quantity, si.UnitPrice,
                        s.OrderType, s.CreatedAt,
                        (si.UnitPrice * si.Quantity + ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE sia.SaleItemID = si.SaleItemID
                        ), 0)) AS ItemTotalWithAddons,
                        (ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0)) AS TotalDiscount
                    FROM Sales s JOIN SaleItems si ON s.SaleID = si.SaleID
                    WHERE s.Status = 'completed'
                    {date_condition} {product_condition} {category_condition}
                ),
                SaleTotals AS (
                    SELECT SaleID, SUM(ItemTotalWithAddons) AS SaleTotal
                    FROM SaleCalculations GROUP BY SaleID
                ),
                FinalCalculations AS (
                    SELECT 
                        sc.SaleItemID, sc.SaleID, sc.ItemName, sc.Category, sc.Quantity,
                        sc.OrderType, sc.CreatedAt, sc.ItemTotalWithAddons,
                        CASE 
                            WHEN st.SaleTotal > 0 THEN (sc.ItemTotalWithAddons / st.SaleTotal) * sc.TotalDiscount
                            ELSE 0
                        END AS ProportionalDiscount
                    FROM SaleCalculations sc JOIN SaleTotals st ON sc.SaleID = st.SaleID
                )
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY SUM(ItemTotalWithAddons - ProportionalDiscount) DESC) as id,
                    ItemName as product, Category as category,
                    SUM(ItemTotalWithAddons - ProportionalDiscount) as revenue,
                    SUM((ItemTotalWithAddons - ProportionalDiscount) * 0.60) as profit,
                    SUM(Quantity) as quantity, MAX(CAST(CreatedAt AS DATE)) as date,
                    OrderType as orderType
                FROM FinalCalculations
                GROUP BY ItemName, Category, OrderType ORDER BY revenue DESC
            """
            
            await cursor.execute(sql, tuple(params))
            rows = await cursor.fetchall()
            
            sales_data = []
            total_revenue = 0.0
            total_profit = 0.0
            total_quantity = 0
            transaction_count = 0
            
            # Use a set to count unique transactions based on SaleID
            unique_sale_ids = set()
            
            # We need to re-query to get the transaction count correctly
            count_sql = f"""
                SELECT COUNT(DISTINCT s.SaleID)
                FROM Sales s
                JOIN SaleItems si ON s.SaleID = si.SaleID
                WHERE s.Status = 'completed'
                {date_condition} {product_condition} {category_condition}
            """
            await cursor.execute(count_sql, tuple(params))
            count_row = await cursor.fetchone()
            transaction_count = count_row[0] if count_row else 0
            
            for row in rows:
                revenue = float(row.revenue) if row.revenue else 0.0
                profit = float(row.profit) if row.profit else 0.0
                quantity = int(row.quantity) if row.quantity else 0
                
                sales_data.append(ProductSalesDetail(
                    id=row.id, product=row.product, category=row.category,
                    revenue=revenue, profit=profit, quantity=quantity,
                    date=row.date.isoformat() if row.date else date.today().isoformat(),
                    orderType=row.orderType
                ))
                
                total_revenue += revenue
                total_profit += profit
                total_quantity += quantity
            
            profit_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0.0
            
            return SalesMonitoringResponse(
                salesData=sales_data, totalRevenue=total_revenue,
                totalProfit=total_profit, totalQuantity=total_quantity,
                profitMargin=round(profit_margin, 2),
                transactionCount=transaction_count
            )
    
    except Exception as e:
        logger.error(f"Error fetching sales monitoring data: {e}", exc_info=True)
        logger.error(f"SQL Query: {sql if 'sql' in locals() else 'SQL not generated'}")
        logger.error(f"Parameters: {params if 'params' in locals() else 'No params'}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales monitoring data: {str(e)}")
    finally:
        if conn:
            await conn.close()