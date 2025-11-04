# FILE: sales.py - COMPLETE FILE WITH REFUND DEDUCTIONS

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

# --- Pydantic model for the INCOMING REQUEST ---
class AlignedSalesReportRequest(BaseModel):
    reportType: Literal['today', 'yesterday', 'custom']
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    cashierName: Optional[str] = None  # Added cashier filter

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

class SalesMonitoringRequest(BaseModel):
    dateRange: Literal['today', 'week', 'month']
    selectedCashier: Optional[str] = 'all'
    selectedCategory: Optional[str] = 'all'

class ProductSalesDetail(BaseModel):
    id: int
    product: str
    category: str
    revenue: float
    profit: float
    quantity: int
    date: str
    cashier: Optional[str]

class SalesMonitoringResponse(BaseModel):
    salesData: List[ProductSalesDetail]
    totalRevenue: float
    totalProfit: float
    totalQuantity: int
    profitMargin: float
    transactionCount: int

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
    return ""


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
                WITH CompletedSales AS (
                    SELECT 
                        s.SaleID,
                        s.PaymentMethod,
                        s.CreatedAt,
                        -- Calculate the actual amount paid (FinalAmount from Sales table)
                        (
                            SELECT SUM(si2.UnitPrice * si2.Quantity)
                            FROM SaleItems si2
                            WHERE si2.SaleID = s.SaleID
                        ) + 
                        ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItems si2
                            JOIN SaleItemAddons sia ON si2.SaleItemID = sia.SaleItemID
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE si2.SaleID = s.SaleID
                        ), 0) - 
                        ISNULL(s.TotalDiscountAmount, 0) - 
                        ISNULL(s.PromotionalDiscountAmount, 0) AS AmountPaid
                    FROM Sales s
                    WHERE s.Status = 'completed' 
                        AND s.CashierName = ? 
                        AND s.CreatedAt >= ?
                        {order_type_condition}
                ),
                PartiallyRefundedSales AS (
                    SELECT 
                        s.SaleID,
                        s.PaymentMethod,
                        -- For partially refunded sales, use the refund amount from RefundedOrders
                        ISNULL(ro.RefundAmount, 0) AS RefundAmount
                    FROM Sales s
                    LEFT JOIN RefundedOrders ro ON s.SaleID = ro.SaleID
                    WHERE s.Status IN ('completed')
                        AND s.CashierName = ?
                        AND s.CreatedAt >= ?
                        AND ro.RefundID IS NOT NULL
                        {order_type_condition}
                ),
                SaleItemsDetail AS (
                    SELECT 
                        si.SaleItemID,
                        si.SaleID,
                        si.Quantity,
                        ISNULL(ri.RefundedQuantity, 0) AS RefundedQty
                    FROM SaleItems si
                    LEFT JOIN RefundedItems ri ON si.SaleItemID = ri.SaleItemID
                    JOIN Sales s ON si.SaleID = s.SaleID
                    WHERE s.Status = 'completed'
                        AND s.CashierName = ?
                        AND s.CreatedAt >= ?
                        {order_type_condition}
                        {product_type_condition}
                ),
                NetSales AS (
                    SELECT 
                        cs.PaymentMethod,
                        cs.AmountPaid - ISNULL(pr.RefundAmount, 0) AS NetAmount
                    FROM CompletedSales cs
                    LEFT JOIN PartiallyRefundedSales pr ON cs.SaleID = pr.SaleID
                    WHERE (cs.AmountPaid - ISNULL(pr.RefundAmount, 0)) > 0
                ),
                ItemsSoldCalc AS (
                    SELECT 
                        SUM(Quantity - RefundedQty) AS ItemsSold
                    FROM SaleItemsDetail
                )
                SELECT 
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales), 0) AS TotalSales,
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales WHERE PaymentMethod = 'Cash'), 0) AS CashSales,
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales WHERE PaymentMethod IN ('GCash', 'E-Wallet')), 0) AS GcashSales,
                    ISNULL((SELECT ItemsSold FROM ItemsSoldCalc), 0) AS ItemsSold
            """
            
            # Need to pass cashierName and session_start_time multiple times for each CTE
            params = (
                request.cashierName, session_start_time,  # CompletedSales
                request.cashierName, session_start_time,  # PartiallyRefundedSales
                request.cashierName, session_start_time   # SaleItemsDetail
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
                WITH SaleItemTotals AS (
                    SELECT 
                        s.SaleID,
                        s.PaymentMethod,
                        si.SaleItemID,
                        si.Quantity,
                        (si.UnitPrice * si.Quantity) AS ItemSubtotal,
                        ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItemAddons sia 
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE sia.SaleItemID = si.SaleItemID
                        ), 0) AS AddonsTotal,
                        ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0) AS TotalSaleDiscount
                    FROM Sales s 
                    JOIN SaleItems si ON s.SaleID = si.SaleID
                    WHERE s.Status = 'completed' 
                        AND s.CashierName = ? 
                        AND CAST(s.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                        {order_type_condition}
                        {product_type_condition}
                ),
                RefundedAmounts AS (
                    SELECT 
                        ri.SaleItemID,
                        SUM(ri.RefundAmount) AS TotalRefunded,
                        SUM(ri.RefundedQuantity) AS RefundedQty
                    FROM RefundedItems ri
                    GROUP BY ri.SaleItemID
                ),
                SaleTotalsBeforeDiscount AS (
                    SELECT 
                        SaleID, 
                        SUM(ItemSubtotal + AddonsTotal) AS GrossTotal
                    FROM SaleItemTotals 
                    GROUP BY SaleID
                ),
                FinalSaleItems AS (
                    SELECT 
                        sit.SaleID,
                        sit.PaymentMethod,
                        sit.SaleItemID,
                        sit.Quantity,
                        (sit.ItemSubtotal + sit.AddonsTotal) - 
                        (
                            CASE 
                                WHEN stbd.GrossTotal > 0 
                                THEN ((sit.ItemSubtotal + sit.AddonsTotal) / stbd.GrossTotal) * sit.TotalSaleDiscount
                                ELSE 0
                            END
                        ) AS LineTotalAfterDiscount,
                        ISNULL(ra.TotalRefunded, 0) AS RefundedAmount,
                        ISNULL(ra.RefundedQty, 0) AS RefundedQty
                    FROM SaleItemTotals sit
                    JOIN SaleTotalsBeforeDiscount stbd ON sit.SaleID = stbd.SaleID
                    LEFT JOIN RefundedAmounts ra ON sit.SaleItemID = ra.SaleItemID
                ),
                NetSales AS (
                    SELECT 
                        SaleID,
                        PaymentMethod,
                        SaleItemID,
                        Quantity - RefundedQty AS NetQuantity,
                        LineTotalAfterDiscount - RefundedAmount AS NetAmount
                    FROM FinalSaleItems
                    WHERE (LineTotalAfterDiscount - RefundedAmount) > 0
                )
                SELECT 
                    ISNULL(SUM(NetAmount), 0) AS TotalSales,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN NetAmount ELSE 0 END), 0) AS CashSales,
                    ISNULL(SUM(CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN NetAmount ELSE 0 END), 0) AS GcashSales,
                    ISNULL(SUM(NetQuantity), 0) AS ItemsSold
                FROM NetSales
            """
            params = (request.cashierName,)
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
                WITH CompletedSales AS (
                    SELECT 
                        s.SaleID,
                        s.PaymentMethod,
                        s.CreatedAt
                    FROM Sales s
                    WHERE s.Status = 'completed' 
                        AND s.CashierName = ? 
                        AND CAST(s.CreatedAt AS DATE) = ?
                        {order_type_condition}
                ),
                SaleWithRefunds AS (
                    SELECT 
                        cs.SaleID,
                        cs.PaymentMethod,
                        -- Calculate original sale total (items + addons - discounts)
                        ISNULL((
                            SELECT SUM(si2.UnitPrice * si2.Quantity)
                            FROM SaleItems si2
                            WHERE si2.SaleID = cs.SaleID
                        ), 0) + 
                        ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItems si2
                            JOIN SaleItemAddons sia ON si2.SaleItemID = sia.SaleItemID
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE si2.SaleID = cs.SaleID
                        ), 0) - 
                        ISNULL((SELECT TotalDiscountAmount FROM Sales WHERE SaleID = cs.SaleID), 0) - 
                        ISNULL((SELECT PromotionalDiscountAmount FROM Sales WHERE SaleID = cs.SaleID), 0) AS GrossAmount,
                        -- Get total refund amount for this sale
                        ISNULL((
                            SELECT SUM(ro.RefundAmount)
                            FROM RefundedOrders ro
                            WHERE ro.SaleID = cs.SaleID
                        ), 0) AS RefundAmount
                    FROM CompletedSales cs
                ),
                SaleItemsDetail AS (
                    SELECT 
                        si.SaleItemID,
                        si.SaleID,
                        si.Quantity,
                        ISNULL((
                            SELECT SUM(ri.RefundedQuantity)
                            FROM RefundedItems ri
                            WHERE ri.SaleItemID = si.SaleItemID
                        ), 0) AS RefundedQty
                    FROM SaleItems si
                    JOIN CompletedSales cs ON si.SaleID = cs.SaleID
                    WHERE 1=1
                        {product_type_condition}
                ),
                NetSales AS (
                    SELECT 
                        swr.PaymentMethod,
                        swr.GrossAmount - swr.RefundAmount AS NetAmount
                    FROM SaleWithRefunds swr
                    WHERE (swr.GrossAmount - swr.RefundAmount) > 0
                ),
                ItemsSoldCalc AS (
                    SELECT 
                        SUM(Quantity - RefundedQty) AS ItemsSold
                    FROM SaleItemsDetail
                )
                SELECT 
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales), 0) AS TotalSales,
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales WHERE PaymentMethod = 'Cash'), 0) AS CashSales,
                    ISNULL((SELECT SUM(NetAmount) FROM NetSales WHERE PaymentMethod IN ('GCash', 'E-Wallet')), 0) AS GcashSales,
                    ISNULL((SELECT ItemsSold FROM ItemsSoldCalc), 0) AS ItemsSold
            """
            
            params = (request.cashierName, request.date)
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
        logger.error(f"Error fetching sales metrics for date {request.date}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales metrics by date.")
    finally:
        if conn: await conn.close()

@router_sales_metrics.post(
    "/report",
    response_model=AlignedSalesReportResponse,
    summary="Generate a comprehensive sales report for a specific period"
)
async def get_sales_report(
    request: AlignedSalesReportRequest, 
    current_user: dict = Depends(get_current_active_user),
    token: str = Depends(oauth2_scheme)
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

    # Build cashier filter condition
    cashier_condition = ""
    cashier_params = []
    if request.cashierName and request.cashierName.lower() != "all":
        cashier_condition = "AND s.CashierName = ?"
        cashier_params.append(request.cashierName)

    base_query_cte = f"""
        WITH SaleItemTotals AS (
            SELECT 
                s.SaleID, s.OrderType, s.CreatedAt, s.PaymentMethod, s.CashierName,
                si.SaleItemID, si.ItemName, si.Category, si.Quantity,
                (si.UnitPrice * si.Quantity) AS ItemSubtotal,
                ISNULL((SELECT SUM(a.Price * sia.Quantity) FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = si.SaleItemID), 0) AS AddonsTotal,
                ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0) AS TotalSaleDiscount
            FROM Sales s 
            JOIN SaleItems si ON s.SaleID = si.SaleID 
            WHERE s.Status = 'completed' 
                AND CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
                {cashier_condition}
        ),
        RefundedAmounts AS (
            SELECT 
                ri.SaleItemID,
                SUM(ri.RefundAmount) AS TotalRefunded,
                SUM(ri.RefundedQuantity) AS RefundedQty
            FROM RefundedItems ri
            GROUP BY ri.SaleItemID
        ),
        SaleTotalsBeforeDiscount AS (
            SELECT SaleID, SUM(ItemSubtotal + AddonsTotal) as GrossTotal
            FROM SaleItemTotals GROUP BY SaleID
        ),
        FinalSales AS (
            SELECT 
                sit.SaleID, sit.OrderType, sit.CreatedAt, sit.PaymentMethod, sit.CashierName, 
                sit.SaleItemID, sit.ItemName, sit.Category, 
                sit.Quantity - ISNULL(ra.RefundedQty, 0) AS NetQuantity,
                (sit.ItemSubtotal + sit.AddonsTotal) - 
                ( (sit.ItemSubtotal + sit.AddonsTotal) / NULLIF(st.GrossTotal, 0) * sit.TotalSaleDiscount ) - 
                ISNULL(ra.TotalRefunded, 0) as LineTotal
            FROM SaleItemTotals sit
            JOIN SaleTotalsBeforeDiscount st ON sit.SaleID = st.SaleID
            LEFT JOIN RefundedAmounts ra ON sit.SaleItemID = ra.SaleItemID
            WHERE ((sit.ItemSubtotal + sit.AddonsTotal) - 
                   ((sit.ItemSubtotal + sit.AddonsTotal) / NULLIF(st.GrossTotal, 0) * sit.TotalSaleDiscount) - 
                   ISNULL(ra.TotalRefunded, 0)) > 0
        )
    """
    
    params = [start_date, end_date] + cashier_params
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
            columns = [column[0] for column in cursor.description]
            summary_row = await cursor.fetchone()
            summary_row_dict = dict(zip(columns, summary_row)) if summary_row else {}

        # 2. Fetch Category Breakdown
        category_query = base_query_cte + "SELECT Category AS category, SUM(NetQuantity) AS quantity, SUM(LineTotal) AS sales FROM FinalSales GROUP BY Category ORDER BY sales DESC;"
        async with conn.cursor() as cursor:
            await cursor.execute(category_query, tuple(params))
            columns = [column[0] for column in cursor.description]
            category_rows = await cursor.fetchall()
            category_breakdown = [dict(zip(columns, row)) for row in category_rows]

        # 3. Fetch Product Breakdown
        product_query = base_query_cte + "SELECT ItemName AS product, Category AS category, SUM(NetQuantity) AS units, SUM(LineTotal) AS total FROM FinalSales GROUP BY ItemName, Category ORDER BY total DESC;"
        async with conn.cursor() as cursor:
            await cursor.execute(product_query, tuple(params))
            columns = [column[0] for column in cursor.description]
            product_rows = await cursor.fetchall()
            product_breakdown = [dict(zip(columns, row)) for row in product_rows]

        # 4. Fetch Payment Methods Breakdown
        payment_methods_query = base_query_cte + "SELECT CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN 'GCash' ELSE PaymentMethod END as type, COUNT(DISTINCT SaleID) as transactions, SUM(LineTotal) as amount FROM FinalSales GROUP BY CASE WHEN PaymentMethod IN ('GCash', 'E-Wallet') THEN 'GCash' ELSE PaymentMethod END;"
        async with conn.cursor() as cursor:
            await cursor.execute(payment_methods_query, tuple(params))
            columns = [column[0] for column in cursor.description]
            payment_rows = await cursor.fetchall()
            payment_methods = [dict(zip(columns, row)) for row in payment_rows]

        # 5. Fetch Refunds List (with cashier filter)
        refunds_base_condition = "WHERE CAST(ro.RefundedAt AS DATE) BETWEEN ? AND ?"
        refunds_params = [start_date, end_date]
        if request.cashierName and request.cashierName.lower() != "all":
            refunds_base_condition += " AND s.CashierName = ?"
            refunds_params.append(request.cashierName)
            
        refunds_query = f"SELECT CAST(ro.SaleID AS VARCHAR) as id, si.ItemName as product, ri.RefundAmount as amount, ro.RefundReason as reason, s.CashierName as cashier, FORMAT(ro.RefundedAt, 'MM/dd/yyyy') as date FROM RefundedOrders ro JOIN Sales s ON ro.SaleID = s.SaleID JOIN RefundedItems ri ON ro.RefundID = ri.RefundID JOIN SaleItems si ON ri.SaleItemID = si.SaleItemID {refunds_base_condition};"
        
        async with conn.cursor() as cursor:
            await cursor.execute(refunds_query, tuple(refunds_params))
            columns = [column[0] for column in cursor.description]
            refund_rows = await cursor.fetchall()
            refunds_list = [dict(zip(columns, row)) for row in refund_rows]
            total_refund_amount = sum(float(item.get('amount', 0.0)) for item in refunds_list)

        # 6. Fetch Cash Drawer Summary (FIXED VERSION)
        cash_drawer_base_condition = "WHERE cs.Status = 'Closed' AND CAST(cs.SessionEnd AS DATE) BETWEEN ? AND ?"
        cash_drawer_params = [start_date, end_date]
        
        if request.cashierName and request.cashierName.lower() != "all":
            cash_drawer_base_condition += " AND cs.CashierName = ?"
            cash_drawer_params.append(request.cashierName)
        
        # Updated query to show ALL closed sessions (not just those with discrepancies)
        cash_drawer_query = f"""
            WITH SessionRefunds AS (
                SELECT 
                    cs.SessionID,
                    cs.InitialCash,
                    cs.CashSalesAtClose,
                    cs.ClosingCash,
                    cs.CashierName,
                    cs.SessionStart,
                    cs.SessionEnd,
                    cs.CheckedBy,
                    ISNULL(cd.DiscrepancyAmount, 0) as DiscrepancyAmount,
                    -- Calculate total refunds for cash transactions in this session's timeframe
                    ISNULL((
                        SELECT SUM(ri.RefundAmount)
                        FROM RefundedOrders ro
                        JOIN RefundedItems ri ON ro.RefundID = ri.RefundID
                        JOIN Sales s ON ro.SaleID = s.SaleID
                        WHERE s.PaymentMethod = 'Cash'
                            AND s.CashierName = cs.CashierName
                            AND ro.RefundedAt BETWEEN cs.SessionStart AND ISNULL(cs.SessionEnd, GETDATE())
                    ), 0) AS TotalRefunds
                FROM CashierSessions cs
                LEFT JOIN CashDiscrepancies cd ON cs.SessionID = cd.SessionID
                {cash_drawer_base_condition}
            )
            SELECT TOP 1
                InitialCash as opening,
                CashSalesAtClose as grossCashSales,
                TotalRefunds as refunds,
                ClosingCash as actual,
                CashierName as reportedBy,
                CheckedBy as verifiedBy,
                DiscrepancyAmount as discrepancy
            FROM SessionRefunds
            ORDER BY SessionEnd DESC;
        """
        
        async with conn.cursor() as cursor:
            await cursor.execute(cash_drawer_query, tuple(cash_drawer_params))
            columns = [column[0] for column in cursor.description]
            cash_drawer_row = await cursor.fetchone()
            cash_drawer_row_dict = dict(zip(columns, cash_drawer_row)) if cash_drawer_row else {}
        
        # Fetch full names for reportedBy and verifiedBy
        reported_by_name = "N/A"
        verified_by_name = "N/A"
        
        if cash_drawer_row_dict:
            reported_by_username = cash_drawer_row_dict.get('reportedBy')
            verified_by_username = cash_drawer_row_dict.get('verifiedBy')
            
            # Fetch reported by full name
            if reported_by_username:
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            f"http://localhost:4000/users/employee_name?username={reported_by_username}",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        if response.status_code == 200:
                            data = response.json()
                            reported_by_name = data.get('employee_name', reported_by_username)
                        else:
                            reported_by_name = reported_by_username
                except Exception as e:
                    logger.warning(f"Could not fetch employee name for {reported_by_username}: {e}")
                    reported_by_name = reported_by_username
            
            # Fetch verified by full name
            if verified_by_username:
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            f"http://localhost:4000/users/employee_name?username={verified_by_username}",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        if response.status_code == 200:
                            data = response.json()
                            verified_by_name = data.get('employee_name', verified_by_username)
                        else:
                            verified_by_name = verified_by_username
                except Exception as e:
                    logger.warning(f"Could not fetch employee name for {verified_by_username}: {e}")
                    verified_by_name = verified_by_username
        
        # Build the CashDrawerSummary with corrected calculations
        cash_drawer = CashDrawerSummary()
        if cash_drawer_row_dict:
            opening_bal = float(cash_drawer_row_dict.get('opening') or 0.0)
            gross_cash_sales = float(cash_drawer_row_dict.get('grossCashSales') or 0.0)
            total_refunds = float(cash_drawer_row_dict.get('refunds') or 0.0)
            actual = float(cash_drawer_row_dict.get('actual') or 0.0)
            stored_discrepancy = float(cash_drawer_row_dict.get('discrepancy') or 0.0)
            
            # Calculate net cash sales (gross - refunds)
            net_cash_sales = gross_cash_sales - total_refunds
            
            # Calculate expected cash (opening + net cash sales)
            expected = opening_bal + net_cash_sales
            
            # Verify discrepancy calculation
            calculated_discrepancy = actual - expected
            
            cash_drawer = CashDrawerSummary(
                opening=opening_bal,              # InitialCash
                cashSales=net_cash_sales,         # CashSalesAtClose - TotalRefunds
                refunds=total_refunds,            # Sum of all RefundAmount
                expected=expected,                # Opening + Net Cash Sales
                actual=actual,                    # ClosingCash
                discrepancy=stored_discrepancy,   # From CashDiscrepancies table
                reportedBy=reported_by_name,      # CashierName (full name)
                verifiedBy=verified_by_name       # CheckedBy (full name)
            )
            
            logger.info(f"=== Cash Drawer Summary ===")
            logger.info(f"Opening Balance: ₱{opening_bal}")
            logger.info(f"Gross Cash Sales: ₱{gross_cash_sales}")
            logger.info(f"Total Refunds: ₱{total_refunds}")
            logger.info(f"Net Cash Sales: ₱{net_cash_sales}")
            logger.info(f"Expected Cash: ₱{expected}")
            logger.info(f"Actual Cash: ₱{actual}")
            logger.info(f"Discrepancy: ₱{stored_discrepancy}")
            logger.info(f"Reported By: {reported_by_name}")
            logger.info(f"Verified By: {verified_by_name}")
            logger.info(f"==========================")

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
        
        logger.info(f"=== Sales Report Summary ===")
        logger.info(f"Total Sales: ₱{summary.totalSales}")
        logger.info(f"Transactions: {summary.transactions}")
        logger.info(f"Total Refunds: ₱{summary.refunds}")
        logger.info(f"Cash In Drawer: ₱{summary.cashInDrawer}")
        logger.info(f"Discrepancy: ₱{summary.discrepancy}")
        logger.info(f"===========================")
        
        return AlignedSalesReportResponse(
            summary=summary, 
            paymentSummary=payment_summary, 
            categoryBreakdown=category_breakdown,
            productBreakdown=product_breakdown, 
            cashDrawer=cash_drawer,
            paymentMethods=payment_methods, 
            refundsList=refunds_list
        )
    except Exception as e:
        logger.error(f"Error generating aligned sales report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate sales report.")
    finally:
        if conn: 
            await conn.close()


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
                date_condition = "AND s.CreatedAt >= DATEADD(day, -DATEPART(weekday, GETDATE()) + 1, CAST(GETDATE() AS DATE))"
            elif request.dateRange == 'month':
                date_condition = "AND s.CreatedAt >= DATEADD(day, 1 - DAY(GETDATE()), CAST(GETDATE() AS DATE))"
            
            cashier_condition = ""
            category_condition = ""
            params = []
            
            if request.selectedCashier and request.selectedCashier != 'all':
                cashier_condition = "AND s.CashierName = ?"
                params.append(request.selectedCashier)
            
            if request.selectedCategory and request.selectedCategory != 'all':
                category_condition = "AND si.Category = ?"
                params.append(request.selectedCategory)
            
            sql = f"""
                WITH SaleItemTotals AS (
                    SELECT 
                        s.SaleID, si.SaleItemID, si.ItemName, si.Category, si.Quantity, si.UnitPrice,
                        s.OrderType, s.CreatedAt, s.CashierName,
                        (si.UnitPrice * si.Quantity + ISNULL((
                            SELECT SUM(a.Price * sia.Quantity)
                            FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE sia.SaleItemID = si.SaleItemID
                        ), 0)) AS ItemTotalWithAddons,
                        (ISNULL(s.TotalDiscountAmount, 0) + ISNULL(s.PromotionalDiscountAmount, 0)) AS TotalDiscount
                    FROM Sales s JOIN SaleItems si ON s.SaleID = si.SaleID
                    WHERE s.Status = 'completed'
                    {date_condition} {cashier_condition} {category_condition}
                ),
                RefundedAmounts AS (
                    SELECT 
                        ri.SaleItemID,
                        SUM(ri.RefundAmount) AS TotalRefunded,
                        SUM(ri.RefundedQuantity) AS RefundedQty
                    FROM RefundedItems ri
                    GROUP BY ri.SaleItemID
                ),
                SaleTotalsBeforeDiscount AS (
                    SELECT SaleID, SUM(ItemTotalWithAddons) AS SaleTotal
                    FROM SaleItemTotals GROUP BY SaleID
                ),
                FinalCalculations AS (
                    SELECT 
                        sit.SaleItemID, sit.SaleID, sit.ItemName, sit.Category, 
                        sit.Quantity - ISNULL(ra.RefundedQty, 0) AS NetQuantity,
                        sit.OrderType, sit.CreatedAt, sit.ItemTotalWithAddons, sit.CashierName,
                        CASE 
                            WHEN st.SaleTotal > 0 THEN (sit.ItemTotalWithAddons / st.SaleTotal) * sit.TotalDiscount
                            ELSE 0
                        END AS ProportionalDiscount,
                        ISNULL(ra.TotalRefunded, 0) AS RefundedAmount
                    FROM SaleItemTotals sit 
                    JOIN SaleTotalsBeforeDiscount st ON sit.SaleID = st.SaleID
                    LEFT JOIN RefundedAmounts ra ON sit.SaleItemID = ra.SaleItemID
                )
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY SUM(ItemTotalWithAddons - ProportionalDiscount - RefundedAmount) DESC) as id,
                    ItemName as product, Category as category,
                    SUM(ItemTotalWithAddons - ProportionalDiscount - RefundedAmount) as revenue,
                    SUM((ItemTotalWithAddons - ProportionalDiscount - RefundedAmount) * 0.60) as profit,
                    SUM(NetQuantity) as quantity,
                    CAST(CreatedAt AS DATE) as date,
                    CashierName as cashier
                FROM FinalCalculations
                WHERE (ItemTotalWithAddons - ProportionalDiscount - RefundedAmount) > 0
                GROUP BY ItemName, Category, CashierName, CAST(CreatedAt AS DATE)
                ORDER BY revenue DESC
            """
            
            await cursor.execute(sql, tuple(params))
            rows = await cursor.fetchall()
            
            sales_data = []
            total_revenue = 0.0
            total_profit = 0.0
            total_quantity = 0
            
            # Get transaction count
            count_sql = f"""
                SELECT COUNT(DISTINCT s.SaleID)
                FROM Sales s
                JOIN SaleItems si ON s.SaleID = si.SaleID
                WHERE s.Status = 'completed'
                {date_condition} {cashier_condition} {category_condition}
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
                    cashier=row.cashier
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