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

# Add new model for refunded item info
class RefundedItemInfo(BaseModel):
    refundedQuantity: int
    refundAmount: float

class TransactionItemWithRefund(BaseModel):
    name: str
    quantity: int
    price: float
    details: Optional[str] = None
    refundedQuantity: Optional[int] = 0
    refundAmount: Optional[float] = 0.0
    isFullyRefunded: Optional[bool] = False

# Update the TransactionRecord model
class TransactionRecordWithRefunds(BaseModel):
    id: str
    date: str
    orderType: str
    items: List[TransactionItemWithRefund]
    total: float
    subtotal: float
    discount: float
    promotionalDiscount: Optional[float] = 0.0
    discountName: Optional[str] = None
    promotionNames: Optional[str] = None
    status: str
    paymentMethod: str
    type: str
    discountsAndPromotions: str
    cashierName: str
    GCashReferenceNumber: Optional[str] = None
    refundInfo: Optional[Dict[str, Any]] = None

class RefundSummary(BaseModel):
    totalRefundAmount: float
    totalRefundedItems: int
    fullRefunds: int
    partialRefunds: int

class TransactionStatistics(BaseModel):
    total_transactions: int
    completed_transactions: int
    cancelled_transactions: int
    refunded_transactions: int
    transactions_with_discount: int
    total_sales: float
    total_items_sold: int
    refund_summary: RefundSummary

# Helper function to get discount/promotion text
def get_discount_promotion_text(discount, promo_discount, discount_name, promo_names):
    parts = []
    if discount and discount > 0 and discount_name:
        parts.append(f"Discount: {discount_name}")
    if promo_discount and promo_discount > 0 and promo_names:
        parts.append(f"Promotion: {promo_names}")
    return " | ".join(parts) if parts else "None"

# Update the get_all_transaction_history endpoint
@router_transaction_history.get(
    "/all",
    response_model=List[TransactionRecordWithRefunds],
    summary="Get All Transaction History with Refund Details"
)
async def get_all_transaction_history(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    status_filter: Optional[str] = Query(None, description="Status filter"),
    order_type_filter: Optional[str] = Query(None, description="Order type filter"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get all transaction history with comprehensive refund information.
    Includes individual item refund tracking and displays refund amounts properly.
    Now also includes discount and promotion information.
    """
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
            # Main query to get sales with refund, discount, and promotion information
            sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.PromotionalDiscountAmount, s.Status, s.GCashReferenceNumber,
                    si.SaleItemID, si.ItemName, si.Quantity AS ItemQuantity, si.UnitPrice, si.Category,
                    a.AddonID, a.AddonName, a.Price AS AddonPrice, sia.Quantity AS AddonQuantity,
                    ri.RefundedQuantity, ri.RefundAmount AS ItemRefundAmount,
                    ro.RefundType, ro.RefundAmount AS TotalRefundAmount, ro.RefundReason,
                    (SELECT TOP 1 d.name 
                     FROM SaleDiscounts sd 
                     JOIN discounts d ON sd.DiscountID = d.id 
                     WHERE sd.SaleID = s.SaleID) AS DiscountName,
                    (SELECT STRING_AGG(p.name, ', ')
                     FROM promotions p
                     WHERE p.id IN (
                         SELECT DISTINCT promotion_id 
                         FROM (
                             SELECT pap.promotion_id
                             FROM promotion_applicable_products pap
                             JOIN SaleItems si2 ON si2.ItemName = pap.product_name
                             WHERE si2.SaleID = s.SaleID
                             UNION
                             SELECT pac.promotion_id
                             FROM promotion_applicable_categories pac
                             JOIN SaleItems si2 ON si2.Category = pac.category_name
                             WHERE si2.SaleID = s.SaleID
                         ) AS applied_promos
                     )) AS PromotionNames
                FROM Sales AS s
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                LEFT JOIN SaleItemAddons AS sia ON si.SaleItemID = sia.SaleItemID
                LEFT JOIN Addons AS a ON sia.AddonID = a.AddonID
                LEFT JOIN RefundedItems AS ri ON si.SaleItemID = ri.SaleItemID
                LEFT JOIN RefundedOrders AS ro ON s.SaleID = ro.SaleID
                WHERE 1=1
            """
            params = []

            if start_date:
                sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                params.append(start_date)
            
            if end_date:
                sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                params.append(end_date)
            
            if status_filter:
                sql += " AND s.Status = ?"
                params.append(status_filter)
            
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            sql += " ORDER BY s.CreatedAt DESC, s.SaleID DESC, si.SaleItemID ASC;"
            
            await cursor.execute(sql, *params)
            rows = await cursor.fetchall()
            
            # Process results
            transactions_dict: Dict[int, dict] = {}
            
            for row in rows:
                sale_id = row.SaleID
                if sale_id not in transactions_dict:
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
                        "originalSubtotal": Decimal('0.0'),
                        "subtotal": Decimal('0.0'),
                        "discount": row.TotalDiscountAmount or Decimal('0.0'),
                        "promotionalDiscount": row.PromotionalDiscountAmount or Decimal('0.0'),
                        "discountName": row.DiscountName,
                        "promotionNames": row.PromotionNames,
                        "_processed_items": {},
                        "refundInfo": None,
                        "_item_refund_map": {}
                    }
                    
                    # Add refund info if exists
                    if row.RefundType:
                        transactions_dict[sale_id]["refundInfo"] = {
                            "refundType": row.RefundType,
                            "totalRefundAmount": float(row.TotalRefundAmount or 0),
                            "refundReason": row.RefundReason
                        }

                # Track item refunds
                if row.SaleItemID and row.RefundedQuantity:
                    item_key = row.SaleItemID
                    if item_key not in transactions_dict[sale_id]["_item_refund_map"]:
                        transactions_dict[sale_id]["_item_refund_map"][item_key] = {
                            "refundedQuantity": 0,
                            "refundAmount": Decimal('0.0')
                        }
                    transactions_dict[sale_id]["_item_refund_map"][item_key]["refundedQuantity"] += row.RefundedQuantity or 0
                    transactions_dict[sale_id]["_item_refund_map"][item_key]["refundAmount"] += row.ItemRefundAmount or Decimal('0.0')

                # Process items
                if row.SaleItemID:
                    if row.SaleItemID not in transactions_dict[sale_id]["_processed_items"]:
                        item_quantity = row.ItemQuantity or 0
                        item_price = row.UnitPrice or Decimal('0.0')
                        
                        # Get refund info for this specific item
                        refund_info = transactions_dict[sale_id]["_item_refund_map"].get(row.SaleItemID, {})
                        refunded_qty = refund_info.get("refundedQuantity", 0)
                        item_refund_amount = float(refund_info.get("refundAmount", Decimal('0.0')))
                        
                        # Calculate totals
                        item_total = item_price * item_quantity
                        transactions_dict[sale_id]["originalSubtotal"] += item_total
                        
                        # Effective quantity after refunds
                        effective_quantity = item_quantity - refunded_qty
                        transactions_dict[sale_id]["subtotal"] += item_price * effective_quantity
                        
                        # Check if item has addons
                        has_addons = any(r.SaleItemID == row.SaleItemID and r.AddonID for r in rows)
                        
                        transactions_dict[sale_id]["items"].append({
                            "name": row.ItemName or "",
                            "quantity": item_quantity,
                            "price": float(item_price),
                            "details": "Includes add-ons" if has_addons else None,
                            "refundedQuantity": refunded_qty,
                            "refundAmount": item_refund_amount,
                            "isFullyRefunded": refunded_qty >= item_quantity
                        })
                        
                        transactions_dict[sale_id]["_processed_items"][row.SaleItemID] = True

                    # Process addons
                    if row.AddonID:
                        addon_price = row.AddonPrice or Decimal('0.0')
                        addon_quantity = row.AddonQuantity or 0
                        item_quantity = row.ItemQuantity or 1
                        
                        addon_total = addon_price * addon_quantity
                        transactions_dict[sale_id]["originalSubtotal"] += addon_total
                        
                        # Get refund info
                        refund_info = transactions_dict[sale_id]["_item_refund_map"].get(row.SaleItemID, {})
                        refunded_qty = refund_info.get("refundedQuantity", 0)
                        
                        # Calculate proportion of addons that weren't refunded
                        effective_ratio = (item_quantity - refunded_qty) / item_quantity if item_quantity > 0 else 0
                        effective_addon_cost = addon_total * Decimal(str(effective_ratio))
                        
                        transactions_dict[sale_id]["subtotal"] += effective_addon_cost

            # Finalize transaction records
            response_list = []
            for sale_id, transaction_data in transactions_dict.items():
                subtotal = transaction_data["subtotal"]
                original_subtotal = transaction_data["originalSubtotal"]
                discount = transaction_data["discount"]
                promo_discount = transaction_data["promotionalDiscount"]
                
                # Calculate final total (subtotal after refunds - discount - promo discount)
                final_total = subtotal - discount - promo_discount
                
                # Update refund info with original amounts
                if transaction_data.get("refundInfo"):
                    total_refunded = original_subtotal - subtotal
                    transaction_data["refundInfo"]["totalRefundAmount"] = float(total_refunded)
                    transaction_data["refundInfo"]["originalSubtotal"] = float(original_subtotal)
                
                transaction_record = TransactionRecordWithRefunds(
                    id=transaction_data["id"],
                    date=transaction_data["date"],
                    orderType=transaction_data["orderType"],
                    items=[TransactionItemWithRefund(**item) for item in transaction_data["items"]],
                    total=float(final_total),
                    subtotal=float(original_subtotal),
                    discount=float(discount),
                    promotionalDiscount=float(promo_discount),
                    discountName=transaction_data["discountName"],
                    promotionNames=transaction_data["promotionNames"],
                    status=transaction_data["status"],
                    paymentMethod=transaction_data["paymentMethod"] or "N/A",
                    type=transaction_data["type"],
                    discountsAndPromotions=get_discount_promotion_text(
                        discount, 
                        promo_discount,
                        transaction_data["discountName"],
                        transaction_data["promotionNames"]
                    ),
                    cashierName=transaction_data["cashierName"],
                    GCashReferenceNumber=transaction_data["GCashReferenceNumber"],
                    refundInfo=transaction_data.get("refundInfo")
                )
                response_list.append(transaction_record)
            
            return response_list
            
    except Exception as e:
        logger.error(f"Error fetching transaction history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch transaction history.")
    finally:
        if conn:
            await conn.close()
            
@router_transaction_history.get(
    "/statistics",
    response_model=TransactionStatistics,
    summary="Get Transaction Statistics with Refund Details"
)
async def get_transaction_statistics(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    order_type_filter: Optional[str] = Query(None, description="Filter by Store or Online"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get comprehensive transaction statistics including detailed refund information.
    Calculates total refund amount from all refunded items and tracks full vs partial refunds.
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
            # Base SQL for general statistics (without nested aggregates)
            general_stats_sql = """
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN s.Status = 'completed' THEN 1 ELSE 0 END) as completed_transactions,
                    SUM(CASE WHEN s.Status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_transactions,
                    SUM(CASE WHEN s.Status = 'refunded' OR s.Status = 'refund' THEN 1 ELSE 0 END) as refunded_transactions,
                    SUM(CASE WHEN s.TotalDiscountAmount > 0 OR s.PromotionalDiscountAmount > 0 THEN 1 ELSE 0 END) as transactions_with_discount
                FROM Sales s
                WHERE 1=1
            """
            
            params = []
            
            # Add date filters
            if start_date:
                general_stats_sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                params.append(start_date)
            
            if end_date:
                general_stats_sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                params.append(end_date)
            
            # Add order type filter
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    general_stats_sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    general_stats_sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            await cursor.execute(general_stats_sql, *params)
            general_stats = await cursor.fetchone()
            
            # Calculate total sales separately using CTE to avoid nested aggregates
            total_sales_sql = """
                WITH SaleRevenue AS (
                    SELECT 
                        s.SaleID,
                        s.Status,
                        (
                            SELECT COALESCE(SUM(si.Quantity * si.UnitPrice), 0)
                            FROM SaleItems si
                            WHERE si.SaleID = s.SaleID
                        ) +
                        COALESCE((
                            SELECT SUM(sia.Quantity * a.Price)
                            FROM SaleItems si
                            JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE si.SaleID = s.SaleID
                        ), 0) - COALESCE(s.TotalDiscountAmount, 0) - COALESCE(s.PromotionalDiscountAmount, 0) as revenue
                    FROM Sales s
                    WHERE 1=1
            """
            
            sales_params = []
            if start_date:
                total_sales_sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                sales_params.append(start_date)
            
            if end_date:
                total_sales_sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                sales_params.append(end_date)
            
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    total_sales_sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    total_sales_sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            total_sales_sql += """
                )
                SELECT COALESCE(SUM(CASE WHEN Status = 'completed' THEN revenue ELSE 0 END), 0) as total_sales
                FROM SaleRevenue
            """
            
            await cursor.execute(total_sales_sql, *sales_params)
            sales_result = await cursor.fetchone()
            total_sales = sales_result.total_sales if sales_result else 0
            
            # Calculate total items sold
            items_sold_sql = """
                SELECT COALESCE(SUM(si.Quantity), 0) as total_items_sold
                FROM SaleItems si
                JOIN Sales s ON si.SaleID = s.SaleID
                WHERE s.Status = 'completed'
            """
            
            items_params = []
            if start_date:
                items_sold_sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                items_params.append(start_date)
            
            if end_date:
                items_sold_sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                items_params.append(end_date)
            
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    items_sold_sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    items_sold_sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            await cursor.execute(items_sold_sql, *items_params)
            items_result = await cursor.fetchone()
            
            # Calculate comprehensive refund statistics
            refund_stats_sql = """
                SELECT 
                    COALESCE(SUM(ri.RefundAmount), 0) as total_refund_amount,
                    COALESCE(SUM(ri.RefundedQuantity), 0) as total_refunded_items,
                    COUNT(DISTINCT CASE 
                        WHEN ro.RefundType = 'full' THEN ro.SaleID 
                    END) as full_refunds,
                    COUNT(DISTINCT CASE 
                        WHEN ro.RefundType = 'partial' THEN ro.SaleID 
                    END) as partial_refunds
                FROM RefundedItems ri
                JOIN SaleItems si ON ri.SaleItemID = si.SaleItemID
                JOIN Sales s ON si.SaleID = s.SaleID
                LEFT JOIN RefundedOrders ro ON s.SaleID = ro.SaleID
                WHERE 1=1
            """
            
            refund_params = []
            
            if start_date:
                refund_stats_sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                refund_params.append(start_date)
            
            if end_date:
                refund_stats_sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                refund_params.append(end_date)
            
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    refund_stats_sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    refund_stats_sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            await cursor.execute(refund_stats_sql, *refund_params)
            refund_stats = await cursor.fetchone()
            
            # Build response
            refund_summary = RefundSummary(
                totalRefundAmount=float(refund_stats.total_refund_amount or 0),
                totalRefundedItems=int(refund_stats.total_refunded_items or 0),
                fullRefunds=int(refund_stats.full_refunds or 0),
                partialRefunds=int(refund_stats.partial_refunds or 0)
            )
            
            return TransactionStatistics(
                total_transactions=general_stats.total_transactions or 0,
                completed_transactions=general_stats.completed_transactions or 0,
                cancelled_transactions=general_stats.cancelled_transactions or 0,
                refunded_transactions=general_stats.refunded_transactions or 0,
                transactions_with_discount=general_stats.transactions_with_discount or 0,
                total_sales=float(total_sales or 0),
                total_items_sold=items_result.total_items_sold or 0,
                refund_summary=refund_summary
            )
            
    except Exception as e:
        logger.error(f"Error fetching transaction statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch transaction statistics: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()
            
@router_transaction_history.get(
    "/refunds/summary",
    response_model=RefundSummary,
    summary="Get Refund Summary Only"
)
async def get_refunds_summary(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    order_type_filter: Optional[str] = Query(None, description="Filter by Store or Online"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get only refund summary statistics.
    Returns total refund amount calculated from all refunded items.
    """
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view refund statistics."
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            refund_stats_sql = """
                SELECT 
                    COALESCE(SUM(ri.RefundAmount), 0) as total_refund_amount,
                    COALESCE(SUM(ri.RefundedQuantity), 0) as total_refunded_items,
                    COUNT(DISTINCT CASE 
                        WHEN ro.RefundType = 'full' THEN ro.SaleID 
                    END) as full_refunds,
                    COUNT(DISTINCT CASE 
                        WHEN ro.RefundType = 'partial' THEN ro.SaleID 
                    END) as partial_refunds
                FROM RefundedItems ri
                JOIN SaleItems si ON ri.SaleItemID = si.SaleItemID
                JOIN Sales s ON si.SaleID = s.SaleID
                LEFT JOIN RefundedOrders ro ON s.SaleID = ro.SaleID
                WHERE 1=1
            """
            
            params = []
            
            if start_date:
                refund_stats_sql += " AND CAST(s.CreatedAt AS DATE) >= ?"
                params.append(start_date)
            
            if end_date:
                refund_stats_sql += " AND CAST(s.CreatedAt AS DATE) <= ?"
                params.append(end_date)
            
            if order_type_filter:
                if order_type_filter.lower() == "store":
                    refund_stats_sql += " AND s.OrderType IN ('Dine in', 'Take Out')"
                elif order_type_filter.lower() == "online":
                    refund_stats_sql += " AND s.OrderType IN ('Delivery', 'Pick Up')"
            
            await cursor.execute(refund_stats_sql, *params)
            result = await cursor.fetchone()
            
            return RefundSummary(
                totalRefundAmount=float(result.total_refund_amount or 0),
                totalRefundedItems=int(result.total_refunded_items or 0),
                fullRefunds=int(result.full_refunds or 0),
                partialRefunds=int(result.partial_refunds or 0)
            )
            
    except Exception as e:
        logger.error(f"Error fetching refund summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch refund summary: {str(e)}"
        )
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
        calc_end_date = today
        calc_start_date = today - timedelta(days=6)
    elif period == "monthly":
        calc_start_date = today.replace(day=1)
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
                    SUM(CASE WHEN s.TotalDiscountAmount > 0 OR s.PromotionalDiscountAmount > 0 THEN 1 ELSE 0 END) as with_discount,
                    SUM(CASE WHEN s.TotalDiscountAmount = 0 AND s.PromotionalDiscountAmount = 0 THEN 1 ELSE 0 END) as no_discount
                FROM Sales s
                WHERE CAST(s.CreatedAt AS DATE) BETWEEN ? AND ?
            """
            await cursor.execute(discount_promo_sql, str(calc_start_date), str(calc_end_date))
            discount_row = await cursor.fetchone()
            
            discount_promo_data = [
                DiscountPromoDataPoint(name="With Discount/Promo", value=discount_row.with_discount or 0),
                DiscountPromoDataPoint(name="No Discount/Promo", value=discount_row.no_discount or 0)
            ]
            
            # 5. Summary Statistics - Use CTE to avoid nested aggregates
            summary_sql = """
                WITH SaleRevenue AS (
                    SELECT 
                        s.SaleID,
                        s.Status,
                        s.TotalDiscountAmount,
                        s.PromotionalDiscountAmount,
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
                        ), 0) - s.TotalDiscountAmount - s.PromotionalDiscountAmount as revenue
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