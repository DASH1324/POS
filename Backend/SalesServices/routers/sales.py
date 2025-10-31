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


# =========================================================================================
# === ALIGNED SALES REPORT ENDPOINT AND MODELS FOR REACT COMPONENT ========================
# =========================================================================================

# --- Pydantic model for the INCOMING REQUEST ---
class AlignedSalesReportRequest(BaseModel):
    reportType: Literal['today', 'yesterday', 'custom']
    startDate: Optional[date] = None
    endDate: Optional[date] = None

# --- Pydantic Models for the OUTGOING RESPONSE ---
class SalesReportSummary(BaseModel):
    totalSales: float = 0.0
    cashInDrawer: float = 0.0
    discrepancy: float = 0.0
    transactions: int = 0
    refunds: float = 0.0
    
class PaymentSummary(BaseModel):
    cashAmount: float = 0.0
    gcashAmount: float = 0.0
    
class CategoryBreakdownItem(BaseModel):
    category: str
    quantity: int
    sales: float

class ProductBreakdownItem(BaseModel):
    product: str
    category: str
    units: int
    total: float

class CashDrawerSummary(BaseModel):
    opening: float = 0.0
    cashSales: float = 0.0
    refunds: float = 0.0
    expected: float = 0.0
    actual: float = 0.0
    discrepancy: float = 0.0
    reportedBy: str = "N/A"
    verifiedBy: str = "N/A"

class PaymentMethodItem(BaseModel):
    type: str
    transactions: int
    amount: float

class RefundItem(BaseModel):
    id: str
    product: str
    amount: float
    reason: Optional[str] = "N/A"
    cashier: str
    date: str

class AlignedSalesReportResponse(BaseModel):
    summary: SalesReportSummary
    paymentSummary: PaymentSummary
    categoryBreakdown: List[CategoryBreakdownItem]
    productBreakdown: List[ProductBreakdownItem]
    cashDrawer: CashDrawerSummary
    paymentMethods: List[PaymentMethodItem]
    refundsList: List[RefundItem]


@router_sales_metrics.post(
    "/report",
    response_model=AlignedSalesReportResponse,
    summary="Generate a comprehensive sales report for a specific period"
)
async def get_sales_report(
    request: AlignedSalesReportRequest, 
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["admin", "manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    start_date, end_date = None, None
    if request.reportType == 'today':
        start_date = end_date = date.today()
    elif request.reportType == 'yesterday':
        start_date = end_date = date.today() - timedelta(days=1)
    elif request.reportType == 'custom':
        start_date, end_date = request.startDate, request.endDate

    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="A valid date range is required for this report.")

    base_query_cte = """
        WITH SaleAggregates AS (
            SELECT 
                s.SaleID, s.OrderType, s.CreatedAt, s.PaymentMethod, s.CashierName,
                si.ItemName, si.Category, si.Quantity,
                (si.UnitPrice * si.Quantity) AS ItemSubtotal,
                ISNULL((SELECT SUM(a.Price * sia.Quantity) FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = si.SaleItemID), 0) AS AddonsTotal,
                ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0) AS TotalSaleDiscount
            FROM Sales s 
            JOIN SaleItems si ON s.SaleID = si.SaleID 
            WHERE s.Status = 'completed' AND CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
        ),
        SaleTotals AS (
            SELECT SaleID, SUM(ItemSubtotal + AddonsTotal) as GrossTotal
            FROM SaleAggregates GROUP BY SaleID
        ),
        FinalSales AS (
            SELECT 
                sa.SaleID, sa.OrderType, sa.CreatedAt, sa.PaymentMethod, sa.CashierName, sa.ItemName, sa.Category, sa.Quantity,
                (sa.ItemSubtotal + sa.AddonsTotal) - 
                ( (sa.ItemSubtotal + sa.AddonsTotal) / NULLIF(st.GrossTotal, 0) * sa.TotalSaleDiscount ) as LineTotal
            FROM SaleAggregates sa
            JOIN SaleTotals st ON sa.SaleID = st.SaleID
        )
    """
    params = [start_date, end_date]
    conn = None
    try:
        conn = await get_db_connection()
        
        # 1. Fetch Summary Data
        summary_query = base_query_cte + """
            SELECT 
                ISNULL(SUM(LineTotal), 0) as totalSales,
                COUNT(DISTINCT SaleID) as transactions,
                ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN LineTotal ELSE 0 END), 0) as cashAmount,
                ISNULL(SUM(CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN LineTotal ELSE 0 END), 0) as gcashAmount
            FROM FinalSales;
        """
        async with conn.cursor() as cursor:
            await cursor.execute(summary_query, tuple(params))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            summary_row = await cursor.fetchone()
            summary_row_dict = dict(zip(columns, summary_row)) if summary_row else {}

        # 2. Fetch Category Breakdown
        category_query = base_query_cte + "SELECT Category AS category, SUM(Quantity) AS quantity, SUM(LineTotal) AS sales FROM FinalSales GROUP BY Category ORDER BY sales DESC;"
        async with conn.cursor() as cursor:
            await cursor.execute(category_query, tuple(params))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            category_rows = await cursor.fetchall()
            category_breakdown = [dict(zip(columns, row)) for row in category_rows]

        # 3. Fetch Product Breakdown
        product_query = base_query_cte + "SELECT ItemName AS product, Category AS category, SUM(Quantity) AS units, SUM(LineTotal) AS total FROM FinalSales GROUP BY ItemName, Category ORDER BY total DESC;"
        async with conn.cursor() as cursor:
            await cursor.execute(product_query, tuple(params))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            product_rows = await cursor.fetchall()
            product_breakdown = [dict(zip(columns, row)) for row in product_rows]

        # 4. Fetch Payment Methods Breakdown
        payment_methods_query = base_query_cte + "SELECT CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN 'GCash' ELSE PaymentMethod END as type, COUNT(DISTINCT SaleID) as transactions, SUM(LineTotal) as amount FROM FinalSales GROUP BY CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN 'GCash' ELSE PaymentMethod END;"
        async with conn.cursor() as cursor:
            await cursor.execute(payment_methods_query, tuple(params))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            payment_rows = await cursor.fetchall()
            payment_methods = [dict(zip(columns, row)) for row in payment_rows]

        # 5. Fetch Refunds List
        refunds_query = "SELECT CAST(ro.SaleID AS VARCHAR) as id, si.ItemName as product, (si.UnitPrice * si.Quantity) as amount, ro.RefundReason as reason, s.CashierName as cashier, FORMAT(ro.RefundedAt, 'MM/dd/yyyy') as date FROM RefundedOrders ro JOIN Sales s ON ro.SaleID = s.SaleID JOIN SaleItems si ON s.SaleID = si.SaleID WHERE CAST(ro.RefundedAt AS DATE) BETWEEN ? AND ? GROUP BY ro.SaleID, si.ItemName, si.UnitPrice, si.Quantity, ro.RefundReason, s.CashierName, ro.RefundedAt;"
        async with conn.cursor() as cursor:
            await cursor.execute(refunds_query, tuple(params))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            refund_rows = await cursor.fetchall()
            refunds_list = [dict(zip(columns, row)) for row in refund_rows]
            total_refund_amount = sum(float(item.get('amount', 0.0)) for item in refunds_list)

        # 6. Fetch Cash Drawer Summary
        cash_drawer_query = "SELECT TOP 1 InitialCash as opening, CashSalesAtClose as cashSales, (SELECT ISNULL(SUM(si.UnitPrice * si.Quantity), 0) FROM RefundedOrders ro JOIN Sales s ON ro.SaleID = s.SaleID AND s.PaymentMethod = 'Cash' JOIN SaleItems si ON s.SaleID = si.SaleID WHERE CAST(ro.RefundedAt AS DATE) BETWEEN ? AND ?) as refunds, ClosingCash as actual, CashierName as reportedBy FROM CashierSessions WHERE Status = 'Closed' AND CAST(SessionEnd AS DATE) BETWEEN ? AND ? ORDER BY SessionEnd DESC;"
        async with conn.cursor() as cursor:
            await cursor.execute(cash_drawer_query, (start_date, end_date, start_date, end_date))
            # [FIX] Get column names BEFORE fetching data
            columns = [column[0] for column in cursor.description]
            cash_drawer_row = await cursor.fetchone()
            cash_drawer_row_dict = dict(zip(columns, cash_drawer_row)) if cash_drawer_row else {}
        
        cash_drawer = CashDrawerSummary()
        if cash_drawer_row_dict:
            opening_bal = float(cash_drawer_row_dict.get('opening') or 0.0)
            cash_sales = float(cash_drawer_row_dict.get('cashSales') or 0.0)
            refunds = float(cash_drawer_row_dict.get('refunds') or 0.0)
            actual = float(cash_drawer_row_dict.get('actual') or 0.0)
            expected = (opening_bal + cash_sales) - refunds
            discrepancy = actual - expected
            cash_drawer = CashDrawerSummary(
                opening=opening_bal, cashSales=cash_sales, refunds=refunds, expected=expected, 
                actual=actual, discrepancy=discrepancy, 
                reportedBy=cash_drawer_row_dict.get('reportedBy', 'N/A'),
                verifiedBy="Manager"
            )

        # Assemble the final response object
        summary = SalesReportSummary(
            totalSales=float(summary_row_dict.get('totalSales') or 0.0),
            transactions=summary_row_dict.get('transactions') or 0,
            refunds=total_refund_amount,
            cashInDrawer=cash_drawer.actual,
            discrepancy=cash_drawer.discrepancy
        )
        payment_summary = PaymentSummary(
            cashAmount=float(summary_row_dict.get('cashAmount') or 0.0),
            gcashAmount=float(summary_row_dict.get('gcashAmount') or 0.0)
        )
        
        return AlignedSalesReportResponse(
            summary=summary, paymentSummary=payment_summary, categoryBreakdown=category_breakdown,
            productBreakdown=product_breakdown, cashDrawer=cash_drawer,
            paymentMethods=payment_methods, refundsList=refunds_list
        )
    except Exception as e:
        logger.error(f"Error generating aligned sales report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate sales report.")
    finally:
        if conn: await conn.close()

# =========================================================================================
# === END OF ALIGNED SALES REPORT ENDPOINT ================================================
# =========================================================================================

class SalesMonitoringRequest(BaseModel):
    dateRange: Literal['today', 'week', 'month']
    selectedCashier: Optional[str] = 'all'  # CHANGED: from selectedProduct
    selectedCategory: Optional[str] = 'all'

class ProductSalesDetail(BaseModel):
    id: int
    product: str
    category: str
    revenue: float
    profit: float
    quantity: int
    date: str
    cashier: Optional[str]  # CHANGED: from orderType

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
                # Use DATEADD with day and DATEDIFF to get the start of the week (Sunday)
                date_condition = "AND s.CreatedAt >= DATEADD(day, -DATEPART(weekday, GETDATE()) + 1, CAST(GETDATE() AS DATE))"
            elif request.dateRange == 'month':
                # Use DATEADD with day and DAY to get the first day of the month
                date_condition = "AND s.CreatedAt >= DATEADD(day, 1 - DAY(GETDATE()), CAST(GETDATE() AS DATE))"
            
            cashier_condition = "" # CHANGED
            category_condition = ""
            params = []
            
            # CHANGED: Use selectedCashier instead of selectedProduct
            if request.selectedCashier and request.selectedCashier != 'all':
                cashier_condition = "AND s.CashierName = ?"
                params.append(request.selectedCashier)
            
            if request.selectedCategory and request.selectedCategory != 'all':
                category_condition = "AND si.Category = ?"
                params.append(request.selectedCategory)
            
            sql = f"""
                WITH SaleCalculations AS (
                    SELECT 
                        s.SaleID, si.SaleItemID, si.ItemName, si.Category, si.Quantity, si.UnitPrice,
                        s.OrderType, s.CreatedAt, s.CashierName, -- ADDED CashierName
                        (si.UnitPrice * si.Quantity + ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE sia.SaleItemID = si.SaleItemID
                        ), 0)) AS ItemTotalWithAddons,
                        (ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0)) AS TotalDiscount
                    FROM Sales s JOIN SaleItems si ON s.SaleID = si.SaleID
                    WHERE s.Status = 'completed'
                    {date_condition} {cashier_condition} {category_condition} -- UPDATED conditions
                ),
                SaleTotals AS (
                    SELECT SaleID, SUM(ItemTotalWithAddons) AS SaleTotal
                    FROM SaleCalculations GROUP BY SaleID
                ),
                FinalCalculations AS (
                    SELECT 
                        sc.SaleItemID, sc.SaleID, sc.ItemName, sc.Category, sc.Quantity,
                        sc.OrderType, sc.CreatedAt, sc.ItemTotalWithAddons, sc.CashierName, -- ADDED CashierName
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
                    SUM((ItemTotalWithAddons - ProportionalDiscount) * 0.60) as profit, -- Assuming 60% profit margin
                    SUM(Quantity) as quantity,
                    CAST(CreatedAt AS DATE) as date, -- CHANGED: Group by date
                    CashierName as cashier -- CHANGED: Select CashierName
                FROM FinalCalculations
                GROUP BY ItemName, Category, CashierName, CAST(CreatedAt AS DATE) -- CHANGED: Group by
                ORDER BY revenue DESC
            """
            
            await cursor.execute(sql, tuple(params))
            rows = await cursor.fetchall()
            
            sales_data = []
            total_revenue = 0.0
            total_profit = 0.0
            total_quantity = 0
            
            # We need to re-query to get the transaction count correctly based on filters
            count_sql = f"""
                SELECT COUNT(DISTINCT s.SaleID)
                FROM Sales s
                JOIN SaleItems si ON s.SaleID = si.SaleID
                WHERE s.Status = 'completed'
                {date_condition} {cashier_condition} {category_condition} -- UPDATED conditions
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
                    cashier=row.cashier # CHANGED
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