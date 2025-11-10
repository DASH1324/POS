# FILE: purchase_order_router.py

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
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
USER_EMPLOYEE_NAME_URL = "http://127.0.0.1:4000/users/employee_name"
NOTIFICATION_SERVICE_URL = "http://localhost:9004/notifications/"
BLOCKCHAIN_LOG_URL = "http://localhost:9005/blockchain/log"


# --- Define the new router ---
router_purchase_order = APIRouter(
    prefix="/auth/purchase_orders",
    tags=["Purchase Orders"]
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

# --- Helper: Get Full Name from Username ---
async def get_full_name_from_username(username: str, token: str) -> str:
    """Fetch the full name of a user given their username."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                USER_EMPLOYEE_NAME_URL,
                params={"username": username},
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            full_name = data.get("full_name", username)
            logger.info(f"✅ Retrieved full name for '{username}': {full_name}")
            return full_name
    except Exception as e:
        logger.error(f"❌ Failed to get full name for username '{username}': {e}")
        return username  # Fallback to username if service fails
        
async def trigger_notification(sale_id: int, message: str):
    """Sends a request to the notification service without blocking the main response."""
    try:
        async with httpx.AsyncClient() as client:
            payload = {"sale_id": sale_id, "message": message}
            response = await client.post(NOTIFICATION_SERVICE_URL, json=payload, timeout=5.0)
            response.raise_for_status()
            logger.info(f"Successfully triggered notification for SaleID {sale_id}.")
    except httpx.RequestError as e:
        logger.error(f"Could not connect to notification service for SaleID {sale_id}: {e}")
    except httpx.HTTPStatusError as e:
        logger.error(f"Notification service returned an error for SaleID {sale_id}: {e.response.status_code} - {e.response.text}")

# --- BACKGROUND TASK: Process inventory restocking asynchronously ---
async def process_inventory_restock_background(order_id: str, items_to_restock: list, token: str):
    """Process inventory restocking in the background after order cancellation"""
    try:
        if not items_to_restock:
            logger.info(f"No items to restock for order {order_id}")
            return

        cancelled_items_payload = {
            "cancelled_items": [
                {
                    "product_name": item.get('ItemName'),
                    "quantity": item.get('Quantity'),
                    "category": item.get('Category')
                } 
                for item in items_to_restock
            ]
        }
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        ingredients_url = "http://127.0.0.1:8002/ingredients/restock-from-cancelled-order"
        materials_url = "http://127.0.0.1:8002/materials/restock-from-cancelled-order"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [
                client.post(ingredients_url, json=cancelled_items_payload, headers=headers),
                client.post(materials_url, json=cancelled_items_payload, headers=headers)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, res in enumerate(results):
                service = "Ingredients" if i == 0 else "Materials"
                if isinstance(res, Exception):
                    logger.error(f"Restock call to {service} service failed for order {order_id}: {res}")
                elif res.status_code != 200:
                    logger.error(f"Restock to {service} service for order {order_id} failed: {res.status_code} - {res.text}")
                else:
                    logger.info(f"✅ Successfully restocked {service} for order {order_id}")
    
    except Exception as e:
        logger.error(f"Background inventory restock error for order {order_id}: {e}", exc_info=True)

# --- Blockchain Logging Helper ---
async def log_to_blockchain(
    service_identifier: str,
    action: str,
    entity_type: str,
    entity_id: Union[int, str],
    actor_username: str,
    change_description: str,
    data: dict,
    token: str
):
    """Send activity logs to the blockchain service asynchronously."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "service_identifier": service_identifier,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "actor_username": actor_username,
                "change_description": change_description,
                "data": data
            }
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            response = await client.post(BLOCKCHAIN_LOG_URL, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            logger.info(f"✅ Blockchain log created: TX {result.get('transaction_hash')} for {entity_type} ID {entity_id}")
    except Exception as e:
        logger.error(f"❌ Blockchain logging failed for {entity_type} {entity_id}: {e}", exc_info=True)

# For store orders - simple status change only
async def build_simple_update_description(
    old_status: str,
    new_status: str
) -> str:
    """
    Simple status update description for store orders.
    Since logs are grouped by order, no need to repeat order details.
    """
    return f"Status changed: {old_status} → {new_status}"

# For online orders - detailed description with items
async def build_detailed_update_description(
    cursor,
    order_id: int,
    old_status: str,
    new_status: str,
    actor_username: str,
    token: str
) -> str:
    """
    Builds a detailed description for online order status updates,
    including items, add-ons, and discounts.
    """
    # 1. Fetch items and their add-ons
    sql_items = """
        SELECT
            si.SaleItemID, si.ItemName, si.Quantity,
            a.AddonName, sia.Quantity AS AddonQuantity
        FROM SaleItems si
        LEFT JOIN SaleItemAddons sia ON si.SaleItemID = sia.SaleItemID
        LEFT JOIN Addons a ON sia.AddonID = a.AddonID
        WHERE si.SaleID = ?
        ORDER BY si.SaleItemID
    """
    await cursor.execute(sql_items, order_id)
    item_rows = await cursor.fetchall()

    # Group add-ons by item
    items_dict = {}
    for row in item_rows:
        if row.SaleItemID not in items_dict:
            items_dict[row.SaleItemID] = {
                "name": row.ItemName,
                "quantity": row.Quantity,
                "addons": []
            }
        if row.AddonName:
            items_dict[row.SaleItemID]["addons"].append(f"{row.AddonQuantity}x {row.AddonName}")

    # Format the item strings
    item_strings = []
    for item in items_dict.values():
        item_str = f"{item['quantity']}x {item['name']}"
        if item['addons']:
            addons_str = ", ".join(item['addons'])
            item_str += f" (with: {addons_str})"
        item_strings.append(item_str)
    
    product_list_str = " | ".join(item_strings)

    # 2. Fetch applied discounts
    sql_discounts = """
        SELECT
            s.PromotionalDiscountAmount,
            d.name AS DiscountName,
            sd.DiscountAppliedAmount
        FROM Sales s
        LEFT JOIN SaleDiscounts sd ON s.SaleID = sd.SaleID
        LEFT JOIN Discounts d ON sd.DiscountID = d.id
        WHERE s.SaleID = ?
    """
    await cursor.execute(sql_discounts, order_id)
    discount_rows = await cursor.fetchall()
    
    discount_parts = []
    if discount_rows:
        promo_amount = discount_rows[0].PromotionalDiscountAmount or Decimal('0.0')
        if promo_amount > 0:
            discount_parts.append(f"Promotion -₱{promo_amount:.2f}")

        seen_discounts = set()
        for row in discount_rows:
            if row.DiscountName and row.DiscountAppliedAmount:
                part = f"{row.DiscountName} -₱{row.DiscountAppliedAmount:.2f}"
                if part not in seen_discounts:
                    discount_parts.append(part)
                    seen_discounts.add(part)

    discount_str = ""
    if discount_parts:
        discount_str = f" (Discounts: {', '.join(discount_parts)})"

    # Build description with items
    final_description = (
        f"updated orders: \"{product_list_str}\"{discount_str} "
        f"status changed: {old_status} -> {new_status}."
    )
    
    return final_description

# --- Pydantic Models ---
class AddonItem(BaseModel):
    addonId: int
    addonName: str
    price: float
    quantity: int

class ProcessingSaleItem(BaseModel):
    id: int
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
    category: Optional[str] = None
    addons: List[OnlineAddonItem] = []

class OnlineOrderRequest(BaseModel):
    online_order_id: Optional[int] = None
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
    newStatus: Literal[
        "completed", 
        "cancelled", 
        "processing", 
        "refunded", 
        "ready for pick up", 
        "delivering",
        "picked up",
        "preparing",
        "waiting for pick up"
    ]
    cancelDetails: Optional[CancelDetails] = None
    cashier_name: Optional[str] = None  

class RefundOrderRequest(BaseModel):
    managerUsername: str
    refundReason: Optional[str] = "Customer requested refund"

class RefundItemRequest(BaseModel):
    saleItemId: int
    refundQuantity: int
    itemName: str
    originalQuantity: int
    unitPrice: float
    
    @validator('refundQuantity')
    def validate_refund_quantity(cls, v, values):
        if v <= 0:
            raise ValueError('Refund quantity must be greater than 0')
        if 'originalQuantity' in values and v > values['originalQuantity']:
            raise ValueError('Refund quantity cannot exceed original quantity')
        return v

class PartialRefundOrderRequest(BaseModel):
    managerUsername: str
    refundReason: Optional[str] = "Customer requested partial refund"
    items: List[RefundItemRequest]
    
    @validator('items')
    def validate_items(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one item must be selected for refund')
        return v


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
        logger.error(f"Error fetching processing orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch processing orders.")
    finally:
        if conn: await conn.close()

@router_purchase_order.post(
    "/online-order",
    status_code=status.HTTP_201_CREATED,
    summary="Save an online order to the POS system"
)
async def save_online_order(
    order_data: OnlineOrderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["cashier", "admin", "manager", "user"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create orders.")
        
    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False 

        async with conn.cursor() as cursor:
            discount_amount = Decimal('0.0')
            
            pos_order_status = order_data.status.lower()
            if pos_order_status not in ['pending', 'processing', 'cancelled']:
                logger.warning(f"Unexpected status '{pos_order_status}' for reference {order_data.reference_number}. Defaulting to 'pending'.")
                pos_order_status = 'pending'

            corrected_payment_method = order_data.payment_method
            if order_data.order_type.lower() in ["delivery", "pick-up"] and corrected_payment_method.lower() == 'cash':
                logger.warning(f"Received 'Cash' payment method for online order (ref: {order_data.reference_number}). Overriding to 'GCash'.")
                corrected_payment_method = 'GCash'
            
            final_reference_number = order_data.reference_number
            if not final_reference_number:
                if order_data.online_order_id:
                    final_reference_number = f"ONLINE-{order_data.online_order_id}"
                else:
                    final_reference_number = f"REF-{int(datetime.now().timestamp())}"
                logger.warning(f"No 'reference_number' provided. Using fallback: '{final_reference_number}'")

            logger.info(f"=== SAVING ORDER TO POS ===")
            if order_data.online_order_id:
                logger.info(f"Online Order ID: {order_data.online_order_id}")
            logger.info(f"Status: {pos_order_status}")
            logger.info(f"Reference: {final_reference_number}")
            logger.info(f"Cashier: {order_data.cashier_name}")

            try:
                sql_insert_sale = """
                    SET NOCOUNT ON;
                    DECLARE @InsertedSaleID TABLE (SaleID INT);
                    
                    INSERT INTO Sales (
                        OrderType, PaymentMethod, CashierName, CustomerName, 
                        TotalDiscountAmount, Status, GCashReferenceNumber
                    )
                    OUTPUT INSERTED.SaleID INTO @InsertedSaleID
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    
                    SELECT SaleID FROM @InsertedSaleID;
                """
                
                await cursor.execute(
                    sql_insert_sale, 
                    order_data.order_type,
                    corrected_payment_method,
                    order_data.cashier_name,
                    order_data.customer_name,
                    discount_amount,
                    pos_order_status, 
                    final_reference_number
                )
                
                sale_id_row = await cursor.fetchone()
                new_sale_id = sale_id_row[0] if sale_id_row else None
                
            except Exception as output_error:
                logger.warning(f"OUTPUT method failed: {output_error}. Trying @@IDENTITY method.")
                await conn.rollback()
                
                sql_insert_sale_fallback = """
                    INSERT INTO Sales (
                        OrderType, PaymentMethod, CashierName, CustomerName, 
                        TotalDiscountAmount, Status, GCashReferenceNumber
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    SELECT @@IDENTITY AS SaleID;
                """
                
                await cursor.execute(
                    sql_insert_sale_fallback,
                    order_data.order_type,
                    corrected_payment_method,
                    order_data.cashier_name,
                    order_data.customer_name,
                    discount_amount,
                    pos_order_status,
                    final_reference_number
                )
                
                sale_id_row = await cursor.fetchone()
                new_sale_id = int(sale_id_row[0]) if sale_id_row and sale_id_row[0] else None
            
            if not new_sale_id:
                await conn.rollback()
                raise Exception("Failed to create sale record and retrieve new SaleID.")
            
            logger.info(f"✅ Created Sale with auto-generated SaleID: {new_sale_id}")

            for item in order_data.items:
                # Map "All Items" to "Merchandise" category
                raw_category = (item.category or '').strip().lower()
                
                if raw_category in ['all items', 'allitems']:
                    item_category = 'Merchandise'
                elif item.category:
                    item_category = item.category
                else:
                    item_category = 'Online'
                
                sql_insert_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category)
                    VALUES (?, ?, ?, ?, ?)
                """
                
                await cursor.execute(
                    sql_insert_item, 
                    new_sale_id, item.name, item.quantity, 
                    Decimal(str(item.price)), item_category  # Use mapped category
                )
                
                await cursor.execute("SELECT CAST(@@IDENTITY AS INT)")
                sale_item_result = await cursor.fetchone()
                new_sale_item_id = int(sale_item_result[0]) if sale_item_result and sale_item_result[0] else None
                
                if not new_sale_item_id:
                    await conn.rollback()
                    raise Exception(f"Failed to insert sale item: {item.name}")
                
                logger.info(f"✅ Created SaleItem '{item.name}' with auto-generated SaleItemID: {new_sale_item_id}")
                
                for addon in item.addons:
                    await cursor.execute("SELECT AddonID FROM Addons WHERE AddonName = ?", addon.addon_name)
                    addon_id_row = await cursor.fetchone()
                    
                    if not addon_id_row:
                        logger.info(f"Addon '{addon.addon_name}' not found in POS. Creating it with price {addon.price}")
                        
                        # ✅ FIXED: Use OUTPUT clause method like the Sale creation
                        try:
                            sql_insert_addon = """
                                SET NOCOUNT ON;
                                DECLARE @InsertedAddonID TABLE (AddonID INT);
                                
                                INSERT INTO Addons (AddonName, Price)
                                OUTPUT INSERTED.AddonID INTO @InsertedAddonID
                                VALUES (?, ?);
                                
                                SELECT AddonID FROM @InsertedAddonID;
                            """
                            
                            await cursor.execute(
                                sql_insert_addon,
                                addon.addon_name, Decimal(str(addon.price))
                            )
                            
                            addon_id_row = await cursor.fetchone()
                            correct_pos_addon_id = addon_id_row[0] if addon_id_row else None
                            
                        except Exception as output_error:
                            # ✅ Fallback method if OUTPUT doesn't work
                            logger.warning(f"OUTPUT method failed for addon creation: {output_error}. Trying @@IDENTITY method.")
                            
                            sql_insert_addon_fallback = """
                                INSERT INTO Addons (AddonName, Price) VALUES (?, ?);
                                SELECT CAST(@@IDENTITY AS INT) AS AddonID;
                            """
                            
                            await cursor.execute(
                                sql_insert_addon_fallback,
                                addon.addon_name, Decimal(str(addon.price))
                            )
                            
                            addon_creation_result = await cursor.fetchone()
                            correct_pos_addon_id = int(addon_creation_result[0]) if addon_creation_result and addon_creation_result[0] else None
                        
                        if not correct_pos_addon_id:
                            await conn.rollback()
                            raise Exception(f"Failed to create addon: {addon.addon_name}")
                        
                        logger.info(f"✅ Created Addon '{addon.addon_name}' with auto-generated AddonID: {correct_pos_addon_id}")
                    else:
                        correct_pos_addon_id = addon_id_row.AddonID

            # Insert into SaleItemAddons
            sql_insert_sale_item_addon = "INSERT INTO SaleItemAddons (SaleItemID, AddonID, Quantity) VALUES (?, ?, ?)"
            await cursor.execute(sql_insert_sale_item_addon, new_sale_item_id, correct_pos_addon_id, 1)
            
            # Get customer's full name for blockchain logging
            customer_full_name = await get_full_name_from_username(
                order_data.customer_name, 
                current_user['access_token']
            )
            
            # Build detailed item description
            item_descriptions = []
            for item in order_data.items[:3]:  # Show up to 3 items
                item_desc = f"{item.quantity}x {item.name}"
                if item.addons:
                    addon_names = [addon.addon_name for addon in item.addons]
                    item_desc += f" (with: {', '.join(addon_names)})"
                item_descriptions.append(item_desc)
            
            items_text = " | ".join(item_descriptions)
            if len(order_data.items) > 3:
                items_text += f" +{len(order_data.items) - 3} more items"
            
            friendly_order_type = order_data.order_type.replace('-', ' ').title()
            
            # Create detailed blockchain description (without customer name, frontend will add it)
            blockchain_description = (
                f"created: Received an Online Order: "
                f"\"{items_text}\" - {friendly_order_type}"
            )
            
            # --- Blockchain Logging (CREATE) ---
            blockchain_payload = {
                "sale_id": new_sale_id,
                "order_type": order_data.order_type,
                "payment_method": corrected_payment_method,
                "cashier_name": order_data.cashier_name,
                "customer_name": order_data.customer_name,
                "customer_full_name": customer_full_name,
                "status": pos_order_status,
                "reference_number": final_reference_number,
                "total_items": len(order_data.items),
                "total_amount": float(order_data.total_amount)
            }
            
            background_tasks.add_task(
                log_to_blockchain,
                service_identifier="PURCHASE_ORDER_SERVICE",
                action="CREATE",
                entity_type="PurchaseOrder",
                entity_id=new_sale_id,
                actor_username=current_user.get("username"),
                change_description=blockchain_description,
                data=blockchain_payload,
                token=current_user['access_token']
            )
            
            log_msg = f"✅ Successfully saved online order"
            if order_data.online_order_id:
                log_msg += f" (OOS ID: {order_data.online_order_id})"
            log_msg += f" as POS SaleID {new_sale_id} with status '{pos_order_status}'"
            logger.info(log_msg)
            
            order_type_lower = order_data.order_type.lower()
            logger.info(f"Checking for notification trigger. Order type: '{order_type_lower}'")

            if order_type_lower in ["delivery", "pick-up"]:
                logger.info(f"✅ Condition met. Triggering notification for SaleID {new_sale_id}.")
                
                # Build notification message
                notification_items = []
                for item in order_data.items[:3]:
                    notification_items.append(f"{item.quantity} {item.name}")
                
                notification_text = ", ".join(notification_items)
                if len(order_data.items) > 3:
                    notification_text += f" +{len(order_data.items) - 3} more"
                
                notification_message = f"Online Order Received: {notification_text} - {friendly_order_type}"
                
                asyncio.create_task(trigger_notification(sale_id=new_sale_id, message=notification_message))
            else:
                logger.warning(f"❌ Condition NOT met. No notification sent for SaleID {new_sale_id} because order type is '{order_type_lower}'.")
            
            return {
                "message": f"Online order successfully saved to POS with status '{pos_order_status}'",
                "pos_sale_id": new_sale_id,
                "status": pos_order_status,
                "reference_number": final_reference_number
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

@router_purchase_order.patch(
    "/{order_id}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a specific order"
)
async def update_order_status(
    order_id: str,
    request: UpdateOrderStatusRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "staff", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    
    try:
        parsed_id = int(order_id.split('-')[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # Step 1: Check if the order exists and get its current status
            await cursor.execute("SELECT Status FROM Sales WHERE SaleID = ?", parsed_id)
            current_order = await cursor.fetchone()
            if not current_order:
                raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
            
            old_status = current_order.Status
            actor = current_user.get("username")
            action_type = "UPDATE"
            
            # Step 2: Generate the detailed description BEFORE committing the database changes
            try:
                detailed_description = await build_simple_update_description(
                    cursor,
                    parsed_id,
                    old_status,
                    request.newStatus,
                    actor,
                    current_user['access_token']
                )
            except Exception as desc_error:
                logger.error(f"Error building description: {desc_error}", exc_info=True)
                # Fallback description
                detailed_description = f"updated order status from {old_status} to {request.newStatus}"
            
            # Step 3: Perform the database update
            if request.newStatus == 'cancelled':
                # Allow cancellation if:
                # 1. User is admin/manager OR
                # 2. User is cashier but provides valid manager authorization
                user_role = current_user.get("userRole")
                
                if user_role not in ["admin", "manager", "cashier"]:
                    raise HTTPException(
                        status_code=403, 
                        detail="You do not have permission to cancel orders."
                    )
                
                # Cashiers MUST provide manager authorization
                if user_role == "cashier":
                    if not request.cancelDetails or not request.cancelDetails.managerUsername:
                        raise HTTPException(
                            status_code=400, 
                            detail="Manager authorization required for cashier to cancel orders."
                        )
                
                # Admins/Managers can cancel without additional authorization, but still need to provide username
                if not request.cancelDetails or not request.cancelDetails.managerUsername:
                    raise HTTPException(
                        status_code=400, 
                        detail="Manager username required for cancellation."
                    )
                
                # Handle cancellation transaction
                conn.autocommit = False  # ✅ FIXED: Set as property, not call as method
                try:
                    await cursor.execute(
                        "UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", 
                        (request.newStatus, parsed_id)
                    )
                    await cursor.execute(
                        "INSERT INTO CancelledOrders (SaleID, ManagerUsername, CancelledAt) VALUES (?, ?, GETDATE())", 
                        (parsed_id, request.cancelDetails.managerUsername)
                    )
                    await conn.commit()
                    
                    # Fetch items to restock after commit
                    await cursor.execute(
                        "SELECT ItemName, Quantity, Category FROM SaleItems WHERE SaleID = ?", 
                        parsed_id
                    )
                    items_rows = await cursor.fetchall()
                    items_to_restock = [
                        {'ItemName': r.ItemName, 'Quantity': r.Quantity, 'Category': r.Category} 
                        for r in items_rows
                    ]
                    if items_to_restock:
                        background_tasks.add_task(
                            process_inventory_restock_background, 
                            order_id, 
                            items_to_restock, 
                            current_user['access_token']
                        )
                    
                    action_type = "CANCEL"
                    message = "Order has been cancelled. Inventory restock initiated."

                except Exception as db_exc:
                    await conn.rollback()
                    logger.error(f"DB error during cancellation for {order_id}: {db_exc}", exc_info=True)
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Failed to save cancellation to DB: {str(db_exc)}"
                    )
                finally:
                    conn.autocommit = True  # ✅ FIXED: Set as property, not call as method
            else:
                # Handle all other status updates
                try:
                    await cursor.execute(
                        "UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE SaleID = ?", 
                        (request.newStatus, parsed_id)
                    )
                    await conn.commit()
                    message = f"Order status successfully updated to '{request.newStatus}'."
                except Exception as update_exc:
                    await conn.rollback()
                    logger.error(f"DB error during status update for {order_id}: {update_exc}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to update order status: {str(update_exc)}"
                    )

            # Step 4: Schedule the blockchain log with the detailed description
            try:
                background_tasks.add_task(
                    log_to_blockchain,
                    service_identifier="POS_SALES",
                    action=action_type,
                    entity_type="Sale",
                    entity_id=parsed_id,
                    actor_username=actor,
                    change_description=detailed_description,
                    data={
                        "old_status": old_status, 
                        "new_status": request.newStatus, 
                        "manager_authorizer": request.cancelDetails.managerUsername if request.newStatus == 'cancelled' else None
                    },
                    token=current_user['access_token']
                )
            except Exception as blockchain_exc:
                logger.error(f"Failed to schedule blockchain logging: {blockchain_exc}", exc_info=True)
                # Don't fail the request if blockchain logging fails
            
            return {"message": message}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_order_status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        if conn: 
            await conn.close()

@router_purchase_order.patch(
    "/online/{reference_number}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a POS sale linked to an online order"
)
async def update_pos_status_for_online_order(
    reference_number: str,
    request: UpdateOrderStatusRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["cashier", "rider"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Permission denied."
        )

    valid_statuses = [
        'processing',
        'completed', 
        'cancelled', 
        'ready for pick up', 
        'delivering', 
        'picked up',
        'waiting for pick up'
    ]
    
    if request.newStatus not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status update. Allowed statuses: {', '.join(valid_statuses)}"
        )

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            logger.info(f"=== POS STATUS UPDATE REQUEST ===")
            logger.info(f"Reference Number: {reference_number}")
            logger.info(f"New Status: {request.newStatus}")
            logger.info(f"Cashier Name from Request: {request.cashier_name}")
            
            check_sql = "SELECT SaleID, Status, CashierName FROM Sales WHERE GCashReferenceNumber = ?"
            await cursor.execute(check_sql, reference_number)
            existing_order = await cursor.fetchone()
            
            if not existing_order:
                logger.warning(
                    f"No POS sale found with reference number '{reference_number}'. "
                    f"This could mean the online order was never accepted."
                )
                raise HTTPException(
                    status_code=404, 
                    detail=f"No POS sale found with reference number '{reference_number}'."
                )
            
            logger.info(f"Found POS Sale - ID: {existing_order.SaleID}, Current Status: {existing_order.Status}, Current Cashier: {existing_order.CashierName}")
            
            cashier_to_update = request.cashier_name or current_user.get('username')
            old_status = existing_order.Status
            actor = current_user.get("username")
            
            logger.info(f"Will update CashierName to: {cashier_to_update}")
            
            # Generate detailed description BEFORE updating
            detailed_description = await build_detailed_update_description(
                cursor,
                existing_order.SaleID,
                old_status,
                request.newStatus,
                actor,
                current_user['access_token']
            )
            
            update_sql = """
                UPDATE Sales 
                SET Status = ?, 
                    CashierName = ?, 
                    UpdatedAt = GETDATE() 
                WHERE GCashReferenceNumber = ?
            """
            await cursor.execute(update_sql, request.newStatus, cashier_to_update, reference_number)
            
            if cursor.rowcount == 0:
                logger.error(f"Update affected 0 rows for reference '{reference_number}'")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to update the order status."
                )
            
            await conn.commit()
            
            # Schedule blockchain logging
            background_tasks.add_task(
                log_to_blockchain,
                service_identifier="PURCHASE_ORDER_SERVICE",
                action="UPDATE",
                entity_type="PurchaseOrder",
                entity_id=existing_order.SaleID,
                actor_username=actor,
                change_description=detailed_description,
                data={
                    "old_status": old_status,
                    "new_status": request.newStatus,
                    "reference_number": reference_number,
                    "cashier_updated_to": cashier_to_update
                },
                token=current_user['access_token']
            )
            
            logger.info(
                f"✅ Successfully updated POS status for reference '{reference_number}' "
                f"from '{old_status}' to '{request.newStatus}' "
                f"and cashier from '{existing_order.CashierName}' to '{cashier_to_update}'"
            )
            
            return {
                "message": f"POS status successfully updated to '{request.newStatus}'.",
                "reference_number": reference_number,
                "sale_id": existing_order.SaleID,
                "previous_status": old_status,
                "new_status": request.newStatus,
                "cashier_name": cashier_to_update
            }

    except HTTPException:
        raise
    except Exception as e:
        if conn: 
            await conn.rollback()
        logger.error(
            f"❌ Error updating POS status for reference '{reference_number}': {e}", 
            exc_info=True
        )
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to update the order status in the POS: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()