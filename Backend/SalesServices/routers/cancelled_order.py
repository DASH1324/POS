# FILE: cancelled_orders.py - UPDATED WITH PRODUCT/MERCHANDISE FILTER

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Dict, Optional
from decimal import Decimal
import json
import sys
import os
import httpx
import logging
from datetime import datetime

# --- Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth and Service URL Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

router_cancelled_order = APIRouter(
    prefix="/auth/cancelled_orders",
    tags=["Cancelled Orders"]
)

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            user_data = response.json()
            user_data['access_token'] = token 
            return user_data
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Invalid token or user not found: {e.response.text}", headers={"WWW-Authenticate": "Bearer"})
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not connect to the authentication service.")

# --- Pydantic Models ---
class ProcessingSaleItem(BaseModel):
    name: str
    quantity: int
    price: float
    category: str
    addons: Optional[dict] = {}

class ProcessingOrder(BaseModel):
    id: str
    date: str
    items: int
    total: float
    status: str
    orderType: str
    paymentMethod: str
    cashierName: str
    GCashReferenceNumber: Optional[str] = None
    orderItems: List[ProcessingSaleItem]

class CancelledOrderRequest(BaseModel):
    cashierName: str
    orderType: Optional[str] = "All"
    productType: Optional[str] = "All"  # NEW: Product type filter

# --- Helper to generate WHERE clause for product types ---
def get_product_type_condition(product_type: str) -> str:
    if product_type == "Products":
        return "AND si.Category != 'merchandise'"
    elif product_type == "Merchandise":
        return "AND si.Category = 'merchandise'"
    return ""  # For 'All'

# --- Endpoint to Get Today's Cancelled Orders for a Cashier ---
@router_cancelled_order.post(
    "/today",
    response_model=List[ProcessingOrder],
    summary="Get Today's Cancelled Orders for a Specific Cashier, with optional order type and product type filters"
)
async def get_todays_cancelled_orders(
    request: CancelledOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this data."
        )
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            
            base_sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.Status, s.GCashReferenceNumber,
                    si.SaleItemID, si.ItemName, si.Quantity, si.UnitPrice, si.Category
                FROM Sales AS s
                JOIN CancelledOrders AS co ON s.SaleID = co.SaleID
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                WHERE s.Status = 'cancelled'
                AND s.CashierName = ?
                AND CAST(co.CancelledAt AS DATE) = CAST(GETDATE() AS DATE)
            """
            
            params = [request.cashierName]
            
            # Add order type filter condition
            if request.orderType == "Store":
                base_sql += " AND s.OrderType IN ('Dine in', 'Take out')"
            elif request.orderType == "Online":
                base_sql += " AND s.OrderType IN ('Pick up', 'Delivery')"
            
            # NEW: Add product type filter condition
            product_type_condition = get_product_type_condition(request.productType)
            base_sql += product_type_condition
                
            final_sql = base_sql + " ORDER BY co.CancelledAt DESC;"
            
            await cursor.execute(final_sql, *params)
            rows = await cursor.fetchall()
            
            orders_dict: Dict[int, dict] = {}
            item_subtotals: Dict[int, Decimal] = {}
            
            for row in rows:
                sale_id = row.SaleID
                if sale_id not in orders_dict:
                    item_subtotals[sale_id] = Decimal('0.0')
                    orders_dict[sale_id] = {
                        "id": f"SO-{sale_id}",
                        "date": row.CreatedAt.strftime("%B %d, %Y %I:%M %p"),
                        "status": row.Status,
                        "orderType": row.OrderType,
                        "paymentMethod": row.PaymentMethod,
                        "cashierName": row.CashierName,
                        "GCashReferenceNumber": row.GCashReferenceNumber,
                        "items": 0,
                        "orderItems": [],
                        "_totalDiscount": row.TotalDiscountAmount,
                    }
                
                if row.SaleItemID:
                    item_quantity = row.Quantity or 0
                    item_price = row.UnitPrice or Decimal('0.0')
                    orders_dict[sale_id]["items"] += item_quantity
                    item_total = item_price * item_quantity
                    
                    addons_data = {}
                    addons_total_price = Decimal('0.0')
                    
                    addons_sql = """
                        SELECT a.AddonName, a.Price, sia.Quantity
                        FROM SaleItemAddons sia
                        JOIN Addons a ON sia.AddonID = a.AddonID
                        WHERE sia.SaleItemID = ?
                    """
                    await cursor.execute(addons_sql, row.SaleItemID)
                    addon_rows = await cursor.fetchall()
                    
                    for addon_row in addon_rows:
                        addon_price = Decimal(str(addon_row.Price)) * addon_row.Quantity
                        addons_total_price += addon_price
                        addons_data[addon_row.AddonName] = {
                            "price": float(addon_row.Price),
                            "quantity": addon_row.Quantity
                        }
                    
                    item_subtotals[sale_id] += item_total + addons_total_price
                    
                    orders_dict[sale_id]["orderItems"].append(
                        ProcessingSaleItem(
                            name=row.ItemName,
                            quantity=item_quantity,
                            price=float(item_price),
                            category=row.Category,
                            addons=addons_data
                        )
                    )

            response_list = []
            for sale_id, order_data in orders_dict.items():
                subtotal = item_subtotals.get(sale_id, Decimal('0.0'))
                total_discount = order_data.pop("_totalDiscount", Decimal('0.0'))
                final_total = subtotal - total_discount
                order_data["total"] = float(final_total)
                response_list.append(ProcessingOrder(**order_data))
            
            return response_list

    except Exception as e:
        logger.error(f"Error fetching today's cancelled orders for {request.cashierName}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch today's cancelled orders.")
    finally:
        if conn: await conn.close()