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
    online_order_id: Optional[int] = None  # Made optional since POS generates its own ID
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
    """
    Saves an online order to POS. Can accept orders with 'pending' or 'processing' status.
    - 'pending': Order is saved but inventory not deducted yet (done during payment confirmation)
    - 'processing': Order is being prepared (cashier accepted it)
    
    Note: POS automatically generates its own SaleID using IDENTITY.
    """
    # Allow both cashier and system to save orders
    allowed_roles = ["cashier", "admin", "manager", "user"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create orders.")
        
    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False 

        async with conn.cursor() as cursor:
            discount_amount = Decimal('0.0')
            
            # Accept both 'pending' and 'processing' status
            pos_order_status = order_data.status.lower()
            if pos_order_status not in ['pending', 'processing', 'cancelled']:
                logger.warning(f"Unexpected status '{pos_order_status}' for reference {order_data.reference_number}. Defaulting to 'pending'.")
                pos_order_status = 'pending'

            # Handle payment method correction
            corrected_payment_method = order_data.payment_method
            if order_data.order_type.lower() in ["delivery", "pick-up"] and corrected_payment_method.lower() == 'cash':
                logger.warning(f"Received 'Cash' payment method for online order (ref: {order_data.reference_number}). Overriding to 'GCash'.")
                corrected_payment_method = 'GCash'
            
            # Handle reference number
            final_reference_number = order_data.reference_number
            if not final_reference_number:
                # Use online_order_id if available, otherwise generate timestamp-based reference
                if order_data.online_order_id:
                    final_reference_number = f"ONLINE-{order_data.online_order_id}"
                else:
                    from datetime import datetime
                    final_reference_number = f"REF-{int(datetime.now().timestamp())}"
                logger.warning(f"No 'reference_number' provided. Using fallback: '{final_reference_number}'")

            logger.info(f"=== SAVING ORDER TO POS ===")
            if order_data.online_order_id:
                logger.info(f"Online Order ID: {order_data.online_order_id}")
            logger.info(f"Status: {pos_order_status}")
            logger.info(f"Reference: {final_reference_number}")
            logger.info(f"Cashier: {order_data.cashier_name}")

            # Method 1: Try with table variable and OUTPUT
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
                # Fallback: Use @@IDENTITY if OUTPUT doesn't work
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

            # Insert items and their addons
            for item in order_data.items:
                item_category = item.category or 'Online'
                
                # Insert SaleItem - separated into two calls
                sql_insert_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category)
                    VALUES (?, ?, ?, ?, ?)
                """
                
                await cursor.execute(
                    sql_insert_item, 
                    new_sale_id, item.name, item.quantity, 
                    Decimal(str(item.price)), item_category
                )
                
                # Get the last inserted identity in a separate call
                await cursor.execute("SELECT CAST(@@IDENTITY AS INT)")
                sale_item_result = await cursor.fetchone()
                new_sale_item_id = int(sale_item_result[0]) if sale_item_result and sale_item_result[0] else None
                
                if not new_sale_item_id:
                    await conn.rollback()
                    raise Exception(f"Failed to insert sale item: {item.name}")
                
                logger.info(f"✅ Created SaleItem '{item.name}' with auto-generated SaleItemID: {new_sale_item_id}")
                
                # Insert addons for this item
                for addon in item.addons:
                    await cursor.execute("SELECT AddonID FROM Addons WHERE AddonName = ?", addon.addon_name)
                    addon_id_row = await cursor.fetchone()
                    
                    if not addon_id_row:
                        logger.info(f"Addon '{addon.addon_name}' not found in POS. Creating it with price {addon.price}")
                        
                        # Insert addon - separated into two calls
                        sql_insert_addon = "INSERT INTO Addons (AddonName, Price) VALUES (?, ?)"
                        
                        await cursor.execute(
                            sql_insert_addon,
                            addon.addon_name, Decimal(str(addon.price))
                        )
                        
                        # Get the last inserted identity
                        await cursor.execute("SELECT CAST(@@IDENTITY AS INT)")
                        addon_creation_result = await cursor.fetchone()
                        correct_pos_addon_id = int(addon_creation_result[0]) if addon_creation_result and addon_creation_result[0] else None
                        
                        if not correct_pos_addon_id:
                            await conn.rollback()
                            raise Exception(f"Failed to create addon: {addon.addon_name}")
                        
                        logger.info(f"✅ Created Addon '{addon.addon_name}' with auto-generated AddonID: {correct_pos_addon_id}")
                    else:
                        correct_pos_addon_id = addon_id_row.AddonID

                    sql_insert_sale_item_addon = "INSERT INTO SaleItemAddons (SaleItemID, AddonID, Quantity) VALUES (?, ?, ?)"
                    await cursor.execute(sql_insert_sale_item_addon, new_sale_item_id, correct_pos_addon_id, 1)

            await conn.commit()
            
            log_msg = f"✅ Successfully saved online order"
            if order_data.online_order_id:
                log_msg += f" (OOS ID: {order_data.online_order_id})"
            log_msg += f" as POS SaleID {new_sale_id} with status '{pos_order_status}'"
            logger.info(log_msg)
            
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
    "/online/{reference_number}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a POS sale linked to an online order"
)
async def update_pos_status_for_online_order(
    reference_number: str,
    request: UpdateOrderStatusRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Updates the status of a POS order that was created from an online order.
    Uses the GCash reference number to find and update the correct POS record.
    
    This endpoint is called AFTER the online order service updates its own database.
    It ensures the POS database stays in sync with the online order status.
    """
    allowed_roles = ["cashier", "rider"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Permission denied."
        )

    # Validate that only certain statuses can be synced
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
            # Log the incoming request
            logger.info(f"=== POS STATUS UPDATE REQUEST ===")
            logger.info(f"Reference Number: {reference_number}")
            logger.info(f"New Status: {request.newStatus}")
            logger.info(f"Cashier Name from Request: {request.cashier_name}")
            
            # First, check if the order exists
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
            
            # Use cashier_name from request if provided, otherwise use current user's username
            cashier_to_update = request.cashier_name or current_user.get('username')
            
            logger.info(f"Will update CashierName to: {cashier_to_update}")
            
            # Update the status AND cashier name
            update_sql = """
                UPDATE Sales 
                SET Status = ?, 
                    CashierName = ?, 
                    UpdatedAt = GETDATE() 
                WHERE GCashReferenceNumber = ?
            """
            await cursor.execute(update_sql, request.newStatus, cashier_to_update, reference_number)
            
            if cursor.rowcount == 0:
                # This shouldn't happen since we just checked, but just in case
                logger.error(f"Update affected 0 rows for reference '{reference_number}'")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to update the order status."
                )
            
            await conn.commit()
            
            logger.info(
                f"✅ Successfully updated POS status for reference '{reference_number}' "
                f"from '{existing_order.Status}' to '{request.newStatus}' "
                f"and cashier from '{existing_order.CashierName}' to '{cashier_to_update}'"
            )
            
            return {
                "message": f"POS status successfully updated to '{request.newStatus}'.",
                "reference_number": reference_number,
                "sale_id": existing_order.SaleID,
                "previous_status": existing_order.Status,
                "new_status": request.newStatus,
                "cashier_name": cashier_to_update
            }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
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


@router_purchase_order.patch(
    "/online/{reference_number}/status",
    status_code=status.HTTP_200_OK,
    summary="Update the status of a POS sale linked to an online order"
)
async def update_pos_status_for_online_order(
    reference_number: str,
    request: UpdateOrderStatusRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Updates the status of a POS order that was created from an online order.
    Uses the GCash reference number to find and update the correct POS record.
    
    This endpoint is called AFTER the online order service updates its own database.
    It ensures the POS database stays in sync with the online order status.
    """
    allowed_roles = ["cashier", "rider"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Permission denied."
        )

    # Validate that only certain statuses can be synced
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
            # Log the incoming request
            logger.info(f"=== POS STATUS UPDATE REQUEST ===")
            logger.info(f"Reference Number: {reference_number}")
            logger.info(f"New Status: {request.newStatus}")
            
            # First, check if the order exists
            check_sql = "SELECT SaleID, Status FROM Sales WHERE GCashReferenceNumber = ?"
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
            
            logger.info(f"Found POS Sale - ID: {existing_order.SaleID}, Current Status: {existing_order.Status}")
            
            # Update the status
            update_sql = "UPDATE Sales SET Status = ?, UpdatedAt = GETDATE() WHERE GCashReferenceNumber = ?"
            await cursor.execute(update_sql, request.newStatus, reference_number)
            
            if cursor.rowcount == 0:
                # This shouldn't happen since we just checked, but just in case
                logger.error(f"Update affected 0 rows for reference '{reference_number}'")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to update the order status."
                )
            
            await conn.commit()
            
            logger.info(
                f"✅ Successfully updated POS status for reference '{reference_number}' "
                f"from '{existing_order.Status}' to '{request.newStatus}'"
            )
            
            return {
                "message": f"POS status successfully updated to '{request.newStatus}'.",
                "reference_number": reference_number,
                "sale_id": existing_order.SaleID,
                "previous_status": existing_order.Status,
                "new_status": request.newStatus
            }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
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