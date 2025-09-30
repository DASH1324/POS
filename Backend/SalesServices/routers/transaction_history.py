from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Literal, Union, Any
from decimal import Decimal
import json
import sys
import os
import httpx
import logging
from datetime import datetime, date, timedelta
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure the database module can be found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# Auth Configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# Define the transaction history router
router_transaction_history = APIRouter(
    prefix="/auth/transaction_history",
    tags=["Transaction History"]
)

# Authorization Helper Function
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            user_data = response.json()
            user_data['access_token'] = token
            return user_data
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code, 
                detail=f"Invalid token or user not found: {e.response.text}",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to the authentication service."
            )

# Pydantic Models for Transaction History
class AddonItem(BaseModel):
    addonId: int
    addonName: str
    price: float
    quantity: int

class TransactionItem(BaseModel):
    name: str
    quantity: int
    price: float
    details: Optional[str] = None

class TransactionRecord(BaseModel):
    id: str
    date: str  # ISO format string
    orderType: str
    items: List[TransactionItem]
    total: float
    subtotal: float
    discount: float
    status: str
    paymentMethod: str
    type: str  # "Store" or "Online"
    discountsAndPromotions: str
    cashierName: str
    GCashReferenceNumber: Optional[str] = None

# Pydantic Models for Transaction Reports
class TransactionDataPoint(BaseModel):
    date: str
    transactions: int

class StatusDataPoint(BaseModel):
    name: str
    transactions: int

class StoreVsOnlineDataPoint(BaseModel):
    date: str
    store: int
    online: int

class DiscountPromoDataPoint(BaseModel):
    name: str
    value: int

class TransactionReportResponse(BaseModel):
    totalTransactions: List[TransactionDataPoint]
    statusData: List[StatusDataPoint]
    storeVsOnline: List[StoreVsOnlineDataPoint]
    discountPromoData: List[DiscountPromoDataPoint]
    summary: Dict[str, Any]

# Main endpoint to get all transactions for transaction history
@router_transaction_history.get(
    "/all",
    response_model=List[TransactionRecord],
    summary="Get All Transaction History (Admin/Manager Only)"
)
async def get_all_transaction_history(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    status_filter: Optional[str] = Query(None, description="Status filter (completed, cancelled, etc.)"),
    order_type_filter: Optional[str] = Query(None, description="Order type filter (Store/Online)"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get all transaction history with optional filters.
    Determines Store vs Online based on OrderType:
    - Store: "Dine in", "Take Out"  
    - Online: "Delivery", "Pick Up"
    """
    # Role validation
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view all transaction history."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # Build the SQL query with filters
            sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.Status, s.GCashReferenceNumber,
                    si.SaleItemID, si.ItemName, si.Quantity AS ItemQuantity, si.UnitPrice, si.Category,
                    a.AddonID, a.AddonName, a.Price AS AddonPrice, sia.Quantity AS AddonQuantity
                FROM Sales AS s
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                LEFT JOIN SaleItemAddons AS sia ON si.SaleItemID = sia.SaleItemID
                LEFT JOIN Addons AS a ON sia.AddonID = a.AddonID
                WHERE 1=1
            """
            params = []

            # Add date filters
            if start_date:
                sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                params.append(start_date)
            
            if end_date:
                sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                params.append(end_date)
            
            # Add status filter
            if status_filter:
                sql += " AND s.Status = ?"
                params.append(status_filter)
            
            # Add order type filter (Store vs Online)
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            sql += " ORDER BY s.CreatedAt DESC, s.SaleID DESC, si.SaleItemID ASC;"
            
            await cursor.execute(sql, *params)
            rows = await cursor.fetchall()
            
            # Process the results into transaction records
            transactions_dict: Dict[int, dict] = {}
            
            for row in rows:
                sale_id = row.SaleID
                if sale_id not in transactions_dict:
                    # Determine if this is Store or Online based on OrderType
                    transaction_type = "Store" if row.OrderType in ["Dine in", "Take Out"] else "Online"
                    
                    transactions_dict[sale_id] = {
                        "id": f"SO-{sale_id}",
                        "date": row.CreatedAt.isoformat(),
                        "orderType": row.OrderType,
                        "status": row.Status.capitalize() if row.Status else "Unknown",
                        "paymentMethod": row.PaymentMethod,
                        "cashierName": row.CashierName or "",
                        "GCashReferenceNumber": row.GCashReferenceNumber,
                        "type": transaction_type,
                        "items": [],
                        "total": 0,
                        "subtotal": Decimal('0.0'),
                        "discount": row.TotalDiscountAmount or Decimal('0.0'),
                        "_processed_items": set()
                    }

                # Process items
                if row.SaleItemID and row.SaleItemID not in transactions_dict[sale_id]["_processed_items"]:
                    item_quantity = row.ItemQuantity or 0
                    item_price = row.UnitPrice or Decimal('0.0')
                    
                    # Calculate subtotal
                    item_total = item_price * item_quantity
                    transactions_dict[sale_id]["subtotal"] += item_total
                    
                    # Check if item has addons for details
                    has_addons = any(r.SaleItemID == row.SaleItemID and r.AddonID for r in rows)
                    
                    transactions_dict[sale_id]["items"].append({
                        "name": row.ItemName or "",
                        "quantity": item_quantity,
                        "price": float(item_price),
                        "details": "Includes add-ons" if has_addons else None
                    })
                    
                    transactions_dict[sale_id]["_processed_items"].add(row.SaleItemID)

                # Add addon costs to subtotal
                if row.AddonID:
                    addon_price = row.AddonPrice or Decimal('0.0')
                    addon_quantity = row.AddonQuantity or 0
                    transactions_dict[sale_id]["subtotal"] += addon_price * addon_quantity

            # Finalize the transaction records
            response_list = []
            for sale_id, transaction_data in transactions_dict.items():
                # Calculate final total (subtotal - discount)
                subtotal = transaction_data["subtotal"]
                discount = transaction_data["discount"]
                final_total = subtotal - discount
                
                transaction_record = TransactionRecord(
                    id=transaction_data["id"],
                    date=transaction_data["date"],
                    orderType=transaction_data["orderType"],
                    items=[TransactionItem(**item) for item in transaction_data["items"]],
                    total=float(final_total),
                    subtotal=float(subtotal),
                    discount=float(discount),
                    status=transaction_data["status"],
                    paymentMethod=transaction_data["paymentMethod"] or "N/A",
                    type=transaction_data["type"],
                    discountsAndPromotions="Discount Applied" if discount > 0 else "None",
                    cashierName=transaction_data["cashierName"],
                    GCashReferenceNumber=transaction_data["GCashReferenceNumber"]
                )
                response_list.append(transaction_record)
            
            return response_list
            
    except Exception as e:
        logger.error(f"Error fetching transaction history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch transaction history.")
    finally:
        if conn:
            await conn.close()

# Endpoint for transaction statistics
@router_transaction_history.get(
    "/statistics",
    summary="Get Transaction Statistics"
)
async def get_transaction_statistics(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get transaction statistics for the specified date range.
    """
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view transaction statistics."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            sql = """
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN s.Status = 'completed' THEN 1 ELSE 0 END) as completed_transactions,
                    SUM(CASE WHEN s.Status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_transactions,
                    SUM(CASE WHEN s.Status = 'refunded' THEN 1 ELSE 0 END) as refunded_transactions,
                    SUM(CASE WHEN s.TotalDiscountAmount > 0 THEN 1 ELSE 0 END) as transactions_with_discount,
                    COALESCE(SUM(
                        CASE WHEN s.Status = 'completed' 
                        THEN (
                            SELECT SUM(si.Quantity * si.UnitPrice) 
                            FROM SaleItems si 
                            WHERE si.SaleID = s.SaleID
                        ) - s.TotalDiscountAmount
                        ELSE 0 END
                    ), 0) as total_sales,
                    COALESCE(SUM(
                        SELECT SUM(si.Quantity) 
                        FROM SaleItems si 
                        WHERE si.SaleID = s.SaleID
                    ), 0) as total_items_sold
                FROM Sales s
                WHERE 1=1
            """
            params = []

            if start_date:
                sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                params.append(start_date)
            
            if end_date:
                sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                params.append(end_date)

            await cursor.execute(sql, *params)
            result = await cursor.fetchone()
            
            return {
                "total_transactions": result.total_transactions or 0,
                "completed_transactions": result.completed_transactions or 0,
                "cancelled_transactions": result.cancelled_transactions or 0,
                "refunded_transactions": result.refunded_transactions or 0,
                "transactions_with_discount": result.transactions_with_discount or 0,
                "total_sales": float(result.total_sales or 0),
                "total_items_sold": result.total_items_sold or 0
            }
            
    except Exception as e:
        logger.error(f"Error fetching transaction statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch transaction statistics.")
    finally:
        if conn:
            await conn.close()

# NEW ENDPOINT: Transaction Report Data for Charts
@router_transaction_history.get(
    "/report",
    response_model=TransactionReportResponse,
    summary="Get Transaction Report Data for Charts"
)
async def get_transaction_report(
    period: str = Query("daily", description="Period type: daily, weekly, monthly, yearly, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get aggregated transaction data for charts based on the selected period.
    Supports: daily, weekly, monthly, yearly, and custom date ranges.
    """
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view transaction reports."
        )

    # Calculate date range based on period
    today = datetime.now().date()
    
    if period == "daily":
        calc_start_date = today
        calc_end_date = today
    elif period == "weekly":
    # Last 7 days including today
        calc_end_date = today
        calc_start_date = today - timedelta(days=6)
    elif period == "monthly":
        calc_start_date = today.replace(day=1)
        # Last day of current month
        if today.month == 12:
            calc_end_date = today.replace(day=31)
        else:
            calc_end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
    elif period == "yearly":
        calc_start_date = today.replace(month=1, day=1)
        calc_end_date = today.replace(month=12, day=31)
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date and end date are required for custom period."
            )
        calc_start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        calc_end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid period type."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            
            # 1. Total Transactions Over Time
            total_transactions_sql = """
                SELECT 
                    CAST(s.CreatedAt AS DATE) as transaction_date,
                    COUNT(*) as transaction_count
                FROM Sales s
                WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
                GROUP BY CAST(s.CreatedAt AS DATE)
                ORDER BY transaction_date ASC
            """
            await cursor.execute(total_transactions_sql, str(calc_start_date), str(calc_end_date))
            total_trans_rows = await cursor.fetchall()
            
            total_transactions_data = [
                TransactionDataPoint(
                    date=row.transaction_date.strftime("%b %d") if period in ["daily", "weekly", "custom"] 
                         else row.transaction_date.strftime("%b") if period == "monthly"
                         else row.transaction_date.strftime("%b"),
                    transactions=row.transaction_count
                )
                for row in total_trans_rows
            ]
            
            # 2. Transaction Status Distribution
            status_sql = """
                SELECT 
                    s.Status,
                    COUNT(*) as status_count
                FROM Sales s
                WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
                GROUP BY s.Status
            """
            await cursor.execute(status_sql, str(calc_start_date), str(calc_end_date))
            status_rows = await cursor.fetchall()
            
            status_map = {
                'processing': 'Processing',
                'completed': 'Completed',
                'cancelled': 'Cancelled',
                'refunded': 'Refund'
            }
            
            status_data = [
                StatusDataPoint(
                    name=status_map.get(row.Status.lower(), row.Status.capitalize()),
                    transactions=row.status_count
                )
                for row in status_rows
            ]
            
            # 3. Store vs Online Transactions
            store_online_sql = """
                SELECT 
                    CAST(s.CreatedAt AS DATE) as transaction_date,
                    SUM(CASE WHEN s.OrderType IN ('Dine in', 'Take Out') THEN 1 ELSE 0 END) as store_count,
                    SUM(CASE WHEN s.OrderType IN ('Delivery', 'Pick Up') THEN 1 ELSE 0 END) as online_count
                FROM Sales s
                WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
                GROUP BY CAST(s.CreatedAt AS DATE)
                ORDER BY transaction_date ASC
            """
            await cursor.execute(store_online_sql, str(calc_start_date), str(calc_end_date))
            store_online_rows = await cursor.fetchall()
            
            store_vs_online_data = [
                StoreVsOnlineDataPoint(
                    date=row.transaction_date.strftime("%b %d") if period in ["daily", "weekly", "custom"] 
                         else row.transaction_date.strftime("%b") if period == "monthly"
                         else row.transaction_date.strftime("%b"),
                    store=row.store_count,
                    online=row.online_count
                )
                for row in store_online_rows
            ]
            
            # 4. Discount and Promotion Distribution
            discount_promo_sql = """
                SELECT 
                    SUM(CASE WHEN s.TotalDiscountAmount > 0 THEN 1 ELSE 0 END) as with_discount,
                    SUM(CASE WHEN s.TotalDiscountAmount = 0 THEN 1 ELSE 0 END) as no_discount
                FROM Sales s
                WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
            """
            await cursor.execute(discount_promo_sql, str(calc_start_date), str(calc_end_date))
            discount_row = await cursor.fetchone()
            
            discount_promo_data = [
                DiscountPromoDataPoint(name="With Discount", value=discount_row.with_discount or 0),
                DiscountPromoDataPoint(name="No Discount/Promo", value=discount_row.no_discount or 0)
            ]
            
            # 5. Summary Statistics - Use CTE to avoid nested aggregates
            summary_sql = """
                WITH SaleRevenue AS (
                    SELECT 
                        s.SaleID,
                        s.Status,
                        s.TotalDiscountAmount,
                        (
                            SELECT SUM(si.Quantity * si.UnitPrice)
                            FROM SaleItems si
                            WHERE si.SaleID = s.SaleID
                        ) +
                        COALESCE((
                            SELECT SUM(sia.Quantity * a.Price)
                            FROM SaleItems si
                            JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE si.SaleID = s.SaleID
                        ), 0) - s.TotalDiscountAmount as revenue
                    FROM Sales s
                    WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
                )
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                    COALESCE(SUM(CASE WHEN Status = 'completed' THEN revenue ELSE 0 END), 0) as total_revenue,
                    COALESCE(AVG(CASE WHEN Status = 'completed' THEN revenue ELSE NULL END), 0) as avg_transaction_value
                FROM SaleRevenue
            """
            await cursor.execute(summary_sql, str(calc_start_date), str(calc_end_date))
            summary_row = await cursor.fetchone()
            
            summary = {
                "totalTransactions": summary_row.total_transactions or 0,
                "completedTransactions": summary_row.completed_count or 0,
                "totalRevenue": float(summary_row.total_revenue or 0),
                "averageTransactionValue": float(summary_row.avg_transaction_value or 0),
                "period": period,
                "startDate": str(calc_start_date),
                "endDate": str(calc_end_date)
            }
            
            return TransactionReportResponse(
                totalTransactions=total_transactions_data,
                statusData=status_data,
                storeVsOnline=store_vs_online_data,
                discountPromoData=discount_promo_data,
                summary=summary
            )
            
    except Exception as e:
        logger.error(f"Error fetching transaction report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch transaction report: {str(e)}")
    finally:
        if conn:
            await conn.close()