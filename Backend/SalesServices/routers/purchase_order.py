# FILE: purchase_order_router.py

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
from decimal import Decimal
import json
import sys
import os
import httpx
import logging
from datetime import datetime
import asyncio

# --- Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Ensure the database module can be found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth and Service URL Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# --- Define the new router ---
router_purchase_order = APIRouter(
    prefix="/auth/purchase_orders",
    tags=["Purchase Orders"]
)

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    """
    Validates the token, fetches user data, and attaches the raw
    token to the returned user dictionary for inter-service calls.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            
            # --- THIS IS THE FIX ---
            user_data = response.json()
            # Add the original token to the user data dictionary before returning it.
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

class OnlineSaleItem(BaseModel):
    name: str
    quantity: int
    price: float
    category: Optional[str] = "Online"
    addons: Optional[dict] = {}

class OnlineOrderRequest(BaseModel):
    online_order_id: int
    customer_name: str
    order_type: str
    payment_method: str
    subtotal: float
    total_amount: float
    status: str
    items: List[OnlineSaleItem]

class CancelDetails(BaseModel):
    managerUsername: str

class UpdateOrderStatusRequest(BaseModel):
    newStatus: Literal["completed", "cancelled", "processing"]
    cancelDetails: Optional[CancelDetails] = None

# --- API Endpoint to Get Processing Orders ---
@router_purchase_order.get(
    "/status/processing",
    response_model=List[ProcessingOrder],
    summary="Get Processing Orders with Optional Cashier Filter"
)
async def get_processing_orders(
    cashierName: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "staff", "cashier"]
    user_role = current_user.get("userRole")
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view orders."
        )
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            logged_in_username = current_user.get("username")
            sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.Status,
                    si.SaleItemID, si.ItemName, si.Quantity, si.UnitPrice, si.Category, si.Addons
                FROM Sales AS s
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                WHERE s.Status IN ('processing', 'completed', 'cancelled')
            """
            params = []
            if user_role in ["admin", "manager"]:
                if cashierName:
                    sql += " AND s.CashierName = ? "
                    params.append(cashierName)
            else:
                sql += " AND s.CashierName = ? "
                params.append(logged_in_username)
            sql += " ORDER BY s.CreatedAt ASC, s.SaleID ASC;"
            await cursor.execute(sql, *params)
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
                        "items": 0,
                        "orderItems": [],
                        "_totalDiscount": row.TotalDiscountAmount,
                    }
                if row.SaleItemID:
                    item_quantity = row.Quantity or 0
                    item_price = row.UnitPrice or Decimal('0.0')
                    orders_dict[sale_id]["items"] += item_quantity
                    item_subtotals[sale_id] += item_price * item_quantity
                    orders_dict[sale_id]["orderItems"].append(
                        ProcessingSaleItem(
                            name=row.ItemName,
                            quantity=item_quantity,
                            price=float(item_price),
                            category=row.Category,
                            addons=json.loads(row.Addons) if row.Addons else {}
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
        logger.error(f"Error fetching processing orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch processing orders.")
    finally:
        if conn: await conn.close()

# --- Endpoint to receive and save an online order ---
@router_purchase_order.post(
    "/online-order",
    status_code=status.HTTP_201_CREATED,
    summary="Save an online order to the POS system"
)
async def save_online_order(
    order_data: OnlineOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "staff", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create orders."
        )
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            discount_amount = Decimal(order_data.subtotal) - Decimal(order_data.total_amount)
            sql_insert_sale = """
                INSERT INTO Sales (
                    OrderType, PaymentMethod, CashierName, TotalDiscountAmount, Status,
                    GCashReferenceNumber, CreatedAt
                )
                OUTPUT INSERTED.SaleID
                VALUES (?, ?, ?, ?, ?, ?, GETDATE())
            """
            await cursor.execute(
                sql_insert_sale,
                (
                    order_data.order_type,
                    order_data.payment_method,
                    order_data.customer_name,
                    discount_amount,
                    order_data.status,
                    f"ONLINE-{order_data.online_order_id}"
                )
            )
            sale_id_row = await cursor.fetchone()
            if not sale_id_row:
                raise Exception("Failed to create sale record and retrieve new SaleID.")
            new_sale_id = sale_id_row.SaleID
            sql_insert_item = """
                INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category, Addons)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            for item in order_data.items:
                await cursor.execute(
                    sql_insert_item,
                    (
                        new_sale_id,
                        item.name,
                        item.quantity,
                        Decimal(item.price),
                        item.category,
                        json.dumps(item.addons) if item.addons else None
                    )
                )
            await conn.commit()
            logger.info(f"Successfully saved online order {order_data.online_order_id} as POS SaleID {new_sale_id}")
            return {
                "message": "Online order successfully saved to POS",
                "pos_sale_id": new_sale_id
            }
    except Exception as e:
        if conn: await conn.rollback()
        logger.error(f"Failed to save online order to POS: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while saving the online order: {e}"
        )
    finally:
        if conn: await conn.close()

# --- Function to change the status of an order ---
@router_purchase_order.patch(
    "/{order_id}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a specific order"
)
async def update_order_status(
    order_id: str,
    request: UpdateOrderStatusRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "staff", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    try:
        parsed_id = int(order_id.split('-')[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            if request.newStatus == 'cancelled':
                if not request.cancelDetails or not request.cancelDetails.managerUsername:
                    raise HTTPException(status_code=400, detail="Manager username required for cancellation.")
                items_to_restock = []
                try:
                    await cursor.execute("UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", (request.newStatus, parsed_id))
                    if cursor.rowcount == 0:
                        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
                    await cursor.execute("INSERT INTO CancelledOrders (SaleID, ManagerUsername, CancelledAt) VALUES (?, ?, GETDATE())", (parsed_id, request.cancelDetails.managerUsername))
                    await cursor.execute("SELECT ItemName, Quantity, Category FROM SaleItems WHERE SaleID = ?", parsed_id)
                    items_to_restock = await cursor.fetchall()
                    await conn.commit()
                    logger.info(f"Order {order_id} successfully cancelled by {request.cancelDetails.managerUsername}.")
                except Exception as db_exc:
                    await conn.rollback()
                    logger.error(f"DB error during cancellation for order {order_id}: {db_exc}", exc_info=True)
                    raise HTTPException(status_code=500, detail="Failed to save cancellation to DB.")
                if items_to_restock:
                    cancelled_items_payload = {"cancelled_items": [{"product_name": item.ItemName, "quantity": item.Quantity, "category": item.Category} for item in items_to_restock]}
                    token = current_user['access_token']
                    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                    ingredients_url = "http://127.0.0.1:8002/ingredients/restock-from-cancelled-order"
                    materials_url = "http://127.0.0.1:8002/materials/restock-from-cancelled-order"
                    async with httpx.AsyncClient() as client:
                        tasks = [client.post(ingredients_url, json=cancelled_items_payload, headers=headers), client.post(materials_url, json=cancelled_items_payload, headers=headers)]
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        for i, res in enumerate(results):
                            service = "Ingredients" if i == 0 else "Materials"
                            if isinstance(res, Exception):
                                logger.error(f"Restock call to {service} service failed for order {order_id}: {res}")
                            elif res.status_code != 200:
                                logger.error(f"Restock to {service} service for order {order_id} failed: {res.status_code} - {res.text}")
                return {"message": "Order has been cancelled and inventory restock initiated."}
            else:
                await cursor.execute("UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", (request.newStatus, parsed_id))
                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
                await conn.commit()
                return {"message": f"Order status successfully updated to '{request.newStatus}'."}
    finally:
        if conn: await conn.close()

# --- Endpoint to Get All Orders ---
@router_purchase_order.get(
    "/all",
    response_model=List[ProcessingOrder],
    summary="Get All Orders (Admin/Manager Only)"
)
async def get_all_orders(current_user: dict = Depends(get_current_active_user)):
    allowed_roles = ["admin", "manager"]
    user_role = current_user.get("userRole")
    if user_role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view all orders.")
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.Status, s.GCashReferenceNumber,
                    si.SaleItemID, si.ItemName, si.Quantity, si.UnitPrice, si.Category, si.Addons
                FROM Sales AS s
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                WHERE s.Status IN ('completed', 'processing', 'cancelled')
                ORDER BY s.CreatedAt DESC, s.SaleID DESC;
            """
            await cursor.execute(sql)
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
                    item_subtotals[sale_id] += item_price * item_quantity
                    orders_dict[sale_id]["orderItems"].append(
                        ProcessingSaleItem(
                            name=row.ItemName,
                            quantity=item_quantity,
                            price=float(item_price),
                            category=row.Category,
                            addons=json.loads(row.Addons) if row.Addons else {}
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
        logger.error(f"Error fetching all orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch all orders.")
    finally:
        if conn: await conn.close()