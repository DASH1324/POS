# FILE: purchase_order_router.py

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Literal, Union, Any
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

# --- Authorization Helper Function (No changes needed) ---
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
class AddonItem(BaseModel):
    addonId: int
    addonName: str
    price: float
    quantity: int

class ProcessingSaleItem(BaseModel):
    id: int # Add SaleItemID to uniquely identify items
    name: str
    quantity: int
    price: float
    category: str
    addons: List[AddonItem] = []

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

class OnlineAddonItem(BaseModel):
    addon_id: int
    addon_name: str
    price: float

class OnlineSaleItem(BaseModel):
    name: str
    quantity: int
    price: float
    category: Optional[str] = None  # Changed: Removed default "Online"
    addons: List[OnlineAddonItem] = []

class OnlineOrderRequest(BaseModel):
    online_order_id: int
    customer_name: str
    cashier_name: str
    order_type: str
    payment_method: str
    subtotal: float
    total_amount: float
    status: str
    items: List[OnlineSaleItem]
    reference_number: Optional[str] = None

class CancelDetails(BaseModel):
    managerUsername: str

class UpdateOrderStatusRequest(BaseModel):
    newStatus: Literal["completed", "cancelled", "processing", "refunded"]
    cancelDetails: Optional[CancelDetails] = None

class RefundOrderRequest(BaseModel):
    managerUsername: str
    refundReason: Optional[str] = "Customer requested refund"

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
    allowed_roles = ["admin", "manager", "cashier"]
    user_role = current_user.get("userRole")
    if user_role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view orders.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            logged_in_username = current_user.get("username")
            
           
            sql = """
                SELECT
                    s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName,
                    s.TotalDiscountAmount, s.Status,
                    si.SaleItemID, si.ItemName, si.Quantity AS ItemQuantity, si.UnitPrice, si.Category,
                    a.AddonID, a.AddonName, a.Price AS AddonPrice, sia.Quantity AS AddonQuantity
                FROM Sales AS s
                LEFT JOIN SaleItems AS si ON s.SaleID = si.SaleID
                LEFT JOIN SaleItemAddons AS sia ON si.SaleItemID = sia.SaleItemID
                LEFT JOIN Addons AS a ON sia.AddonID = a.AddonID
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
            sql += " ORDER BY s.CreatedAt ASC, s.SaleID ASC, si.SaleItemID ASC;"
            
            await cursor.execute(sql, *params)
            rows = await cursor.fetchall()
            
            orders_dict: Dict[int, dict] = {}
            
            for row in rows:
                sale_id = row.SaleID
                if sale_id not in orders_dict:
                    orders_dict[sale_id] = {
                        "id": f"SO-{sale_id}", "date": row.CreatedAt.strftime("%B %d, %Y %I:%M %p"),
                        "status": row.Status, "orderType": row.OrderType,
                        "paymentMethod": row.PaymentMethod, "cashierName": row.CashierName,
                        "items": 0, "orderItems": [], "total": 0, "_totalDiscount": row.TotalDiscountAmount,
                        "_subtotal": Decimal('0.0'), "_processed_items": set()
                    }

                if row.SaleItemID:
                    # Add item's base price to subtotal only once
                    if row.SaleItemID not in orders_dict[sale_id]["_processed_items"]:
                        item_quantity = row.ItemQuantity or 0
                        item_price = row.UnitPrice or Decimal('0.0')
                        orders_dict[sale_id]["items"] += item_quantity
                        orders_dict[sale_id]["_subtotal"] += item_price * item_quantity
                        
                        orders_dict[sale_id]["orderItems"].append(
                            ProcessingSaleItem(
                                id=row.SaleItemID, name=row.ItemName, quantity=item_quantity,
                                price=float(item_price), category=row.Category, addons=[]
                            )
                        )
                        orders_dict[sale_id]["_processed_items"].add(row.SaleItemID)
                    
                    # If there's an addon in this row, add its price and details
                    if row.AddonID:
                        addon_price = row.AddonPrice or Decimal('0.0')
                        addon_quantity = row.AddonQuantity or 0
                        # Add addon cost to the order subtotal
                        orders_dict[sale_id]["_subtotal"] += addon_price * addon_quantity
                        
                        # Find the correct item to append the addon to
                        for item in orders_dict[sale_id]["orderItems"]:
                            if item.id == row.SaleItemID:
                                item.addons.append(
                                    AddonItem(addonId=row.AddonID, addonName=row.AddonName,
                                              price=float(addon_price), quantity=addon_quantity)
                                )
                                break
            
            response_list = []
            for sale_id, order_data in orders_dict.items():
                final_total = order_data["_subtotal"] - order_data["_totalDiscount"]
                order_data["total"] = float(final_total)
                # Clean up temporary fields before creating the final Pydantic model
                del order_data["_subtotal"]
                del order_data["_processed_items"]
                del order_data["_totalDiscount"]
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
    # Role validation
    allowed_roles = ["cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create orders.")
        
    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False 

        async with conn.cursor() as cursor:
            discount_amount = Decimal('0.0')
            pos_order_status = 'processing'

            # --- START: DATA CORRECTION AND HANDLING LOGIC ---
            
            # 1. Correct the Payment Method
            # If the frontend sends 'Cash' for a delivery/pick-up order, override it to 'GCash'
            corrected_payment_method = order_data.payment_method
            if order_data.order_type.lower() in ["delivery", "pick-up"] and corrected_payment_method.lower() == 'cash':
                logger.warning(f"Received 'Cash' payment method for online order {order_data.online_order_id}. Overriding to 'GCash'.")
                corrected_payment_method = 'GCash'
            
            # 2. Handle the GCash Reference Number
            # Prioritize the actual reference number passed from the frontend.
            # If it's missing, create a fallback link for internal tracking.
            final_reference_number = order_data.reference_number
            if not final_reference_number:
                final_reference_number = f"ONLINE-{order_data.online_order_id}"
                logger.warning(
                    f"No 'reference_number' provided for online order {order_data.online_order_id}. "
                    f"Using fallback internal link: '{final_reference_number}'"
                )
            else:
                logger.info(
                    f"Received and using actual reference number for online order "
                    f"{order_data.online_order_id}: '{final_reference_number}'"
                )
            # --- END: DATA CORRECTION AND HANDLING LOGIC ---

            # Insert the main sale record
            sql_insert_sale = """
                INSERT INTO Sales (
                    OrderType, PaymentMethod, CashierName, CustomerName, 
                    TotalDiscountAmount, Status, GCashReferenceNumber
                )
                OUTPUT INSERTED.SaleID
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            
            await cursor.execute(
                sql_insert_sale, 
                order_data.order_type,
                corrected_payment_method,
                order_data.cashier_name,
                order_data.customer_name,
                discount_amount,
                pos_order_status, 
                final_reference_number  # Use the prioritized reference number
            )
            
            sale_id_row = await cursor.fetchone()
            if not sale_id_row:
                await conn.rollback()
                raise Exception("Failed to create sale record and retrieve new SaleID.")
            new_sale_id = sale_id_row.SaleID

            # Insert items and their addons
            for item in order_data.items:
                sql_insert_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category)
                    OUTPUT INSERTED.SaleItemID
                    VALUES (?, ?, ?, ?, ?)
                """
                item_category = item.category or 'Online'
                
                await cursor.execute(
                    sql_insert_item, 
                    new_sale_id, item.name, item.quantity, 
                    Decimal(str(item.price)), item_category
                )
                
                sale_item_result = await cursor.fetchone()
                if not sale_item_result:
                    await conn.rollback()
                    raise Exception(f"Failed to insert sale item: {item.name}")
                
                new_sale_item_id = sale_item_result.SaleItemID
                
                # Insert addons for this item
                for addon in item.addons:
                    await cursor.execute("SELECT AddonID FROM Addons WHERE AddonName = ?", addon.addon_name)
                    addon_id_row = await cursor.fetchone()
                    
                    if not addon_id_row:
                        logger.info(f"Addon '{addon.addon_name}' not found in POS. Creating it now with price {addon.price}")
                        await cursor.execute(
                            "INSERT INTO Addons (AddonName, Price) OUTPUT INSERTED.AddonID VALUES (?, ?)",
                            addon.addon_name, Decimal(str(addon.price))
                        )
                        addon_creation_result = await cursor.fetchone()
                        if not addon_creation_result:
                            await conn.rollback()
                            raise Exception(f"Failed to create addon: {addon.addon_name}")
                        correct_pos_addon_id = addon_creation_result.AddonID
                    else:
                        correct_pos_addon_id = addon_id_row.AddonID

                    sql_insert_addon = "INSERT INTO SaleItemAddons (SaleItemID, AddonID, Quantity) VALUES (?, ?, ?)"
                    await cursor.execute(sql_insert_addon, new_sale_item_id, correct_pos_addon_id, 1)

            await conn.commit()
            
            logger.info(f"Successfully saved online order {order_data.online_order_id} as POS SaleID {new_sale_id}")
            return {
                "message": "Online order successfully saved to POS",
                "pos_sale_id": new_sale_id
            }
            
    except Exception as e:
        if conn: await conn.rollback()
        logger.error(f"Failed to save online order to POS: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while saving the online order: {e}")
        
    finally:
        if conn:
            conn.autocommit = True 
            await conn.close()
            
            
# Get all orders endpoint
@router_purchase_order.get(
    "/all",
    response_model=List[ProcessingOrder],
    summary="Get All Orders (Admin/Manager Only)"
)
async def get_all_orders(current_user: dict = Depends(get_current_active_user)):
    allowed_roles = ["admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view all orders.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
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
                WHERE s.Status IN ('completed', 'processing', 'cancelled')
                ORDER BY s.CreatedAt DESC, s.SaleID DESC, si.SaleItemID ASC;
            """
            await cursor.execute(sql)
            rows = await cursor.fetchall()
            
            orders_dict: Dict[int, dict] = {}
            
            for row in rows:
                sale_id = row.SaleID
                if sale_id not in orders_dict:
                    orders_dict[sale_id] = {
                        "id": f"SO-{sale_id}", "date": row.CreatedAt.strftime("%B %d, %Y %I:%M %p"),
                        "status": row.Status, "orderType": row.OrderType,
                        "paymentMethod": row.PaymentMethod, "cashierName": row.CashierName,
                        "GCashReferenceNumber": row.GCashReferenceNumber, "items": 0, "orderItems": [],
                        "total": 0, "_totalDiscount": row.TotalDiscountAmount,
                        "_subtotal": Decimal('0.0'), "_processed_items": set()
                    }

                if row.SaleItemID:
                    if row.SaleItemID not in orders_dict[sale_id]["_processed_items"]:
                        item_quantity = row.ItemQuantity or 0
                        item_price = row.UnitPrice or Decimal('0.0')
                        orders_dict[sale_id]["items"] += item_quantity
                        orders_dict[sale_id]["_subtotal"] += item_price * item_quantity
                        
                        orders_dict[sale_id]["orderItems"].append(
                            ProcessingSaleItem(
                                id=row.SaleItemID, name=row.ItemName, quantity=item_quantity,
                                price=float(item_price), category=row.Category, addons=[]
                            )
                        )
                        orders_dict[sale_id]["_processed_items"].add(row.SaleItemID)
                    
                    if row.AddonID:
                        addon_price = row.AddonPrice or Decimal('0.0')
                        addon_quantity = row.AddonQuantity or 0
                        orders_dict[sale_id]["_subtotal"] += addon_price * addon_quantity
                        
                        for item in orders_dict[sale_id]["orderItems"]:
                            if item.id == row.SaleItemID:
                                item.addons.append(
                                    AddonItem(addonId=row.AddonID, addonName=row.AddonName,
                                              price=float(addon_price), quantity=addon_quantity)
                                )
                                break
            
            response_list = []
            for sale_id, order_data in orders_dict.items():
                final_total = order_data["_subtotal"] - order_data["_totalDiscount"]
                order_data["total"] = float(final_total)
                del order_data["_subtotal"]
                del order_data["_processed_items"]
                del order_data["_totalDiscount"]
                response_list.append(ProcessingOrder(**order_data))
                
            return response_list
            
    except Exception as e:
        logger.error(f"Error fetching all orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch all orders.")
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
    allowed_roles = ["cashier"]
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
                addons_to_restock = []
                
                try:
                    await cursor.execute("UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", (request.newStatus, parsed_id))
                    if cursor.rowcount == 0:
                        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
                    
                    await cursor.execute("INSERT INTO CancelledOrders (SaleID, ManagerUsername, CancelledAt) VALUES (?, ?, GETDATE())", (parsed_id, request.cancelDetails.managerUsername))
                    
                    await cursor.execute("SELECT SaleItemID, ItemName, Quantity, Category FROM SaleItems WHERE SaleID = ?", parsed_id)
                    items_to_restock = await cursor.fetchall()

                    # Loop through each main item to find its addons
                    for item in items_to_restock:
                        await cursor.execute("""
                            SELECT a.AddonName, sia.Quantity AS AddonQuantity
                            FROM SaleItemAddons sia
                            JOIN Addons a ON sia.AddonID = a.AddonID
                            WHERE sia.SaleItemID = ?
                        """, item.SaleItemID)
                        item_addons = await cursor.fetchall()
                        
                        for addon in item_addons:
                            total_addon_quantity = item.Quantity * addon.AddonQuantity
                            addons_to_restock.append({
                                "addon_name": addon.AddonName,
                                "quantity": total_addon_quantity
                            })

                    await conn.commit()
                    logger.info(f"Order {order_id} successfully cancelled by {request.cancelDetails.managerUsername}.")
                except Exception as db_exc:
                    await conn.rollback()
                    logger.error(f"DB error during cancellation for order {order_id}: {db_exc}", exc_info=True)
                    raise HTTPException(status_code=500, detail="Failed to save cancellation to DB.")
                
                if items_to_restock:
                    product_items = []
                    merchandise_items = []
                    
                    for item in items_to_restock:
                        if item.Category == 'Merchandise':
                            merchandise_items.append({"name": item.ItemName, "quantity": item.Quantity})
                        else:
                            product_items.append({"product_name": item.ItemName, "quantity": item.Quantity, "category": item.Category})
                    
                    token = current_user['access_token']
                    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                    
                    async with httpx.AsyncClient() as client:
                        tasks = []
                        service_names = []
                        
                        if product_items or addons_to_restock:
                            product_payload = {
                                "cancelled_items": product_items,
                                "cancelled_addons": addons_to_restock
                            }
                            ingredients_url = "http://127.0.0.1:8002/ingredients/restock-from-cancelled-order"
                            materials_url = "http://127.0.0.1:8002/materials/restock-from-cancelled-order"
                            
                            tasks.extend([
                                client.post(ingredients_url, json=product_payload, headers=headers),
                                client.post(materials_url, json=product_payload, headers=headers)
                            ])
                            service_names.extend(["Ingredients", "Materials"])
                        
                        if merchandise_items:
                            merchandise_payload = {"cartItems": merchandise_items}
                            merchandise_url = "http://127.0.0.1:8002/merchandise/restock-from-cancelled-order"
                            tasks.append(client.post(merchandise_url, json=merchandise_payload, headers=headers))
                            service_names.append("Merchandise")
                        
                        if tasks:
                            results = await asyncio.gather(*tasks, return_exceptions=True)
                            
                            for i, res in enumerate(results):
                                service = service_names[i]
                                if isinstance(res, Exception):
                                    logger.error(f"Restock call to {service} service failed for order {order_id}: {res}")
                                elif res.status_code != 200:
                                    logger.error(f"Restock to {service} service for order {order_id} failed: {res.status_code} - {res.text}")
                                else:
                                    logger.info(f"Successfully restocked {service} for order {order_id}")
                
                return {"message": "Order has been cancelled and inventory restock initiated for all item types."}
            
            else:
                await cursor.execute("UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", (request.newStatus, parsed_id))
                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
                await conn.commit()
                return {"message": f"Order status successfully updated to '{request.newStatus}'."}
    
    finally:
        if conn: 
            await conn.close()


@router_purchase_order.patch(
    "/online/{online_order_id}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a POS sale linked to an online order"
)
async def update_pos_status_for_online_order(
    online_order_id: int,
    request: UpdateOrderStatusRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            g_cash_ref = f"ONLINE-{online_order_id}"
            
            if request.newStatus not in ['completed', 'cancelled']:
                 raise HTTPException(
                    status_code=400,
                    detail="Invalid status update for a linked online order. Only 'completed' or 'cancelled' is allowed."
                )

            sql = "UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE GCashReferenceNumber = ?"
            
            await cursor.execute(sql, request.newStatus, g_cash_ref)
            
            if cursor.rowcount == 0:
                # This could happen if the online order was never accepted into the POS
                logger.warning(f"Attempted to update status for online order ID {online_order_id}, but no matching POS sale was found.")
                raise HTTPException(status_code=404, detail=f"No POS sale found linked to online order ID '{online_order_id}'.")
            
            await conn.commit()
            
            logger.info(f"POS status for online order {online_order_id} updated to '{request.newStatus}'.")
            return {"message": f"POS status for online order successfully updated to '{request.newStatus}'."}

    except Exception as e:
        if conn: await conn.rollback()
        logger.error(f"Error updating POS status for online order {online_order_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update the order status in the POS.")
    finally:
        if conn:
            await conn.close()

# --- New Endpoint to Process Refunds ---
@router_purchase_order.post(
    "/{order_id}/refund",
    status_code=status.HTTP_200_OK,
    summary="Process a refund for a completed order"
)
async def refund_order(
    order_id: str,
    request: RefundOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process a refund for a completed order.
    Only allows refunding orders that have status 'completed'.
    Refunds must be processed within 30 minutes of order completion.
    Requires manager authorization.
    """
    allowed_roles = ["cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to process refunds."
        )
    
    try:
        parsed_id = int(order_id.split('-')[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # First, verify the order exists and is completed
            await cursor.execute(
                "SELECT Status, CashierName, TotalDiscountAmount, UpdatedAt FROM Sales WHERE SaleID = ?", 
                parsed_id
            )
            order_result = await cursor.fetchone()
            
            if not order_result:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Order '{order_id}' not found."
                )
            
            current_status = order_result.Status.lower()
            if current_status != 'completed':
                raise HTTPException(
                    status_code=400,
                    detail=f"Only completed orders can be refunded. Current status: {current_status}"
                )
            
            # Check if order was completed within the last 30 minutes
            completion_time = order_result.UpdatedAt
            from datetime import datetime, timedelta
            
            if completion_time:
                time_since_completion = datetime.now() - completion_time
                if time_since_completion > timedelta(minutes=30):
                    raise HTTPException(
                        status_code=400,
                        detail="Refund window expired. Orders can only be refunded within 30 minutes of completion."
                    )
            else:
                # If no UpdatedAt timestamp, check CreatedAt as fallback
                await cursor.execute(
                    "SELECT CreatedAt FROM Sales WHERE SaleID = ?", 
                    parsed_id
                )
                fallback_result = await cursor.fetchone()
                if fallback_result and fallback_result.CreatedAt:
                    time_since_completion = datetime.now() - fallback_result.CreatedAt
                    if time_since_completion > timedelta(minutes=30):
                        raise HTTPException(
                            status_code=400,
                            detail="Refund window expired. Orders can only be refunded within 30 minutes of completion."
                        )
            
            # --- START: Database transaction for refund ---
            try:
                # Update order status to refunded
                await cursor.execute(
                    "UPDATE Sales SET Status = 'refunded', UpdatedAt = GETDATE() WHERE SaleID = ?", 
                    parsed_id
                )
                
                # Insert into RefundedOrders table
                await cursor.execute("""
                    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RefundedOrders' AND xtype='U')
                    BEGIN
                        CREATE TABLE RefundedOrders (
                            RefundID int IDENTITY(1,1) PRIMARY KEY,
                            SaleID int NOT NULL,
                            ManagerUsername nvarchar(100) NOT NULL,
                            RefundReason nvarchar(500),
                            RefundedAt datetime2 DEFAULT GETDATE(),
                            FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
                        )
                    END
                """)
                
                await cursor.execute(
                    "INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt) VALUES (?, ?, ?, GETDATE())",
                    (parsed_id, request.managerUsername, request.refundReason)
                )
                
                await conn.commit()
                logger.info(f"Order {order_id} successfully refunded by {request.managerUsername}.")
                
            except Exception as db_exc:
                await conn.rollback()
                logger.error(f"DB error during refund for order {order_id}: {db_exc}", exc_info=True)
                raise HTTPException(status_code=500, detail="Failed to process refund in database.")
            # --- END: Database transaction for refund ---
            
            return {
                "message": "Order has been successfully refunded.",
                "order_id": order_id,
                "refunded_by": request.managerUsername,
                "refund_reason": request.refundReason
            }
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during refund for order {order_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the refund.")
    
    finally:
        if conn:
            await conn.close()