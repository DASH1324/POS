from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, validator
from typing import Optional, List
from decimal import Decimal
import logging
from datetime import datetime
import sys
import os

# --- Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Ensure the database module can be found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"
BLOCKCHAIN_LOG_URL = "http://localhost:9005/blockchain/log"

# --- Define the refund router ---
router_refund = APIRouter(
    prefix="/auth/purchase_orders",
    tags=["Refunds"]
)

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    import httpx
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

# --- Blockchain Logging Helper ---
async def log_to_blockchain(
    service_identifier: str,
    action: str,
    entity_type: str,
    entity_id: int,
    actor_username: str,
    change_description: str,
    data: dict,
    token: str
):
    """Send activity logs to the blockchain service asynchronously."""
    import httpx
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

# --- Pydantic Models ---
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

# --- REFUND ENDPOINTS ---

@router_refund.post(
    "/{order_id}/refund",
    status_code=status.HTTP_200_OK,
    summary="Process a full refund for a completed order (within 30 minutes)"
)
async def refund_order(
    order_id: str,
    request: RefundOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process a full refund for a completed order.
    Only allows refunding orders that have status 'completed'.
    Refunds must be processed within 30 minutes of order completion.
    Requires manager authorization.
    Creates entries in both RefundedOrders and RefundedItems tables.
    """
    allowed_roles = ["cashier", "admin", "manager"]
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
        conn.autocommit = False
        
        async with conn.cursor() as cursor:
            # Check order exists and is completed
            await cursor.execute(
                "SELECT Status, CashierName, TotalDiscountAmount, UpdatedAt, CreatedAt FROM Sales WHERE SaleID = ?", 
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
            
            # Check refund time window (30 minutes)
            completion_time = order_result.UpdatedAt or order_result.CreatedAt
            from datetime import timedelta
            
            if completion_time:
                time_since_completion = datetime.now() - completion_time
                if time_since_completion > timedelta(minutes=30):
                    raise HTTPException(
                        status_code=400,
                        detail="Refund window expired. Orders can only be refunded within 30 minutes of completion."
                    )
            
            # Get all items from the order to calculate total refund amount
            await cursor.execute("""
                SELECT 
                    si.SaleItemID,
                    si.ItemName,
                    si.Quantity,
                    si.UnitPrice,
                    COALESCE((
                        SELECT SUM(a.Price * sia.Quantity)
                        FROM SaleItemAddons sia
                        JOIN Addons a ON sia.AddonID = a.AddonID
                        WHERE sia.SaleItemID = si.SaleItemID
                    ), 0) as AddonTotal
                FROM SaleItems si
                WHERE si.SaleID = ?
            """, parsed_id)
            
            order_items = await cursor.fetchall()
            
            if not order_items:
                raise HTTPException(
                    status_code=400,
                    detail="No items found for this order."
                )
            
            # Calculate total refund amount (items + addons - discount)
            total_refund_amount = Decimal('0.0')
            refund_details = []
            
            for item in order_items:
                item_total = (item.UnitPrice * item.Quantity) + item.AddonTotal
                total_refund_amount += item_total
                
                refund_details.append({
                    'sale_item_id': item.SaleItemID,
                    'item_name': item.ItemName,
                    'quantity': item.Quantity,
                    'refund_amount': item_total
                })
            
            # Subtract discount from total refund
            discount = order_result.TotalDiscountAmount or Decimal('0.0')
            total_refund_amount -= discount
            
            try:
                # Update order status to refunded
                await cursor.execute(
                    "UPDATE Sales SET Status = 'refunded', UpdatedAt = GETDATE() WHERE SaleID = ?", 
                    parsed_id
                )
                
                # Create RefundedOrders record with OUTPUT clause
                await cursor.execute("""
                    INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                    OUTPUT INSERTED.RefundID
                    VALUES (?, ?, ?, GETDATE(), 'full', ?)
                """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
                
                refund_id_row = await cursor.fetchone()
                
                if not refund_id_row:
                    # Fallback method
                    await cursor.execute("""
                        INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                        VALUES (?, ?, ?, GETDATE(), 'full', ?);
                        SELECT @@IDENTITY AS RefundID;
                    """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
                    refund_id_row = await cursor.fetchone()
                
                refund_id = int(refund_id_row[0]) if refund_id_row else None
                
                if not refund_id:
                    await conn.rollback()
                    raise Exception("Failed to create refund record.")
                
                # Insert all items into RefundedItems table
                for detail in refund_details:
                    await cursor.execute("""
                        INSERT INTO RefundedItems (RefundID, SaleItemID, RefundedQuantity, RefundAmount, CreatedAt)
                        VALUES (?, ?, ?, ?, GETDATE())
                    """, refund_id, detail['sale_item_id'], detail['quantity'], detail['refund_amount'])
                
                await conn.commit()
                
                # Blockchain Logging (FULL REFUND)
                refund_data = {
                    "refund_id": refund_id,
                    "refund_type": "full",
                    "total_amount": float(total_refund_amount),
                    "refunded_items": refund_details,
                    "manager": request.managerUsername
                }
                await log_to_blockchain(
                    service_identifier="PURCHASE_ORDER_SERVICE",
                    action="REFUND",
                    entity_type="PurchaseOrder",
                    entity_id=parsed_id,
                    actor_username=request.managerUsername,
                    change_description=f"Full refund processed for order {order_id} by {request.managerUsername}.",
                    data=refund_data,
                    token=current_user['access_token']
                )

                logger.info(
                    f"Full refund processed for order {order_id} by {request.managerUsername}. "
                    f"Refund ID: {refund_id}, Total Amount: {total_refund_amount}, Items: {len(refund_details)}"
                )
                
                return {
                    "message": "Order has been successfully refunded (full refund).",
                    "order_id": order_id,
                    "refund_id": refund_id,
                    "refund_type": "full",
                    "total_refund_amount": float(total_refund_amount),
                    "refunded_items": [
                        {
                            "item_name": detail['item_name'],
                            "quantity": detail['quantity'],
                            "amount": float(detail['refund_amount'])
                        }
                        for detail in refund_details
                    ],
                    "refunded_by": request.managerUsername,
                    "refund_reason": request.refundReason
                }
                
            except Exception as db_exc:
                await conn.rollback()
                logger.error(f"DB error during full refund for order {order_id}: {db_exc}", exc_info=True)
                raise HTTPException(status_code=500, detail="Failed to process refund in database.")
    
    except HTTPException:
        if conn:
            await conn.rollback()
        raise
    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Unexpected error during full refund for order {order_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred while processing the refund: {str(e)}"
        )
    
    finally:
        if conn:
            conn.autocommit = True
            await conn.close()


@router_refund.post(
    "/{order_id}/partial-refund",
    status_code=status.HTTP_200_OK,
    summary="Process a partial refund for specific items (within 30 minutes)"
)
async def partial_refund_order(
    order_id: str,
    request: PartialRefundOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process a partial refund for specific items in a completed order.
    Only allows refunding orders that have status 'completed'.
    Refunds must be processed within 30 minutes of order completion.
    Requires manager authorization.
    """
    allowed_roles = ["cashier", "admin", "manager"]
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
        conn.autocommit = False
        
        async with conn.cursor() as cursor:
            # Check order exists and is completed
            await cursor.execute(
                "SELECT Status, CashierName, TotalDiscountAmount, UpdatedAt, CreatedAt FROM Sales WHERE SaleID = ?", 
                parsed_id
            )
            order_result = await cursor.fetchone()
            
            if not order_result:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Order '{order_id}' not found."
                )
            
            current_status = order_result.Status.lower()
            if current_status not in ['completed', 'refunded']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only completed orders can be refunded. Current status: {current_status}"
                )
            
            # Check refund time window (30 minutes)
            completion_time = order_result.UpdatedAt or order_result.CreatedAt
            from datetime import timedelta
            
            if completion_time:
                time_since_completion = datetime.now() - completion_time
                if time_since_completion > timedelta(minutes=30):
                    raise HTTPException(
                        status_code=400,
                        detail="Refund window expired. Orders can only be refunded within 30 minutes of completion."
                    )
            
            # Validate all items belong to this sale
            sale_item_ids = [item.saleItemId for item in request.items]
            placeholders = ','.join(['?' for _ in sale_item_ids])
            
            await cursor.execute(
                f"SELECT SaleItemID, ItemName, Quantity, UnitPrice FROM SaleItems WHERE SaleID = ? AND SaleItemID IN ({placeholders})",
                parsed_id, *sale_item_ids
            )
            valid_items = await cursor.fetchall()
            
            if len(valid_items) != len(request.items):
                raise HTTPException(
                    status_code=400,
                    detail="One or more items do not belong to this order."
                )
            
            # Check if items were already refunded
            await cursor.execute("""
                SELECT ri.SaleItemID, SUM(ri.RefundedQuantity) as TotalRefunded
                FROM RefundedOrders ro
                JOIN RefundedItems ri ON ro.RefundID = ri.RefundID
                WHERE ro.SaleID = ? AND ri.SaleItemID IN ({})
                GROUP BY ri.SaleItemID
            """.format(placeholders), parsed_id, *sale_item_ids)
            
            already_refunded = {row.SaleItemID: row.TotalRefunded for row in await cursor.fetchall()}
            
            # Calculate refund amounts and validate quantities
            total_refund_amount = Decimal('0.0')
            refund_details = []
            
            for req_item in request.items:
                matching_item = next((item for item in valid_items if item.SaleItemID == req_item.saleItemId), None)
                
                if not matching_item:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Item {req_item.itemName} not found in order."
                    )
                
                # Check remaining quantity
                original_qty = matching_item.Quantity
                already_refunded_qty = already_refunded.get(req_item.saleItemId, 0)
                remaining_qty = original_qty - already_refunded_qty
                
                if req_item.refundQuantity > remaining_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot refund {req_item.refundQuantity} of {req_item.itemName}. Only {remaining_qty} remaining."
                    )
                
                # Calculate refund amount (including addons proportionally)
                unit_price = Decimal(str(matching_item.UnitPrice))
                
                # Get addon cost for this item
                await cursor.execute("""
                    SELECT SUM(a.Price * sia.Quantity) as AddonTotal
                    FROM SaleItemAddons sia
                    JOIN Addons a ON sia.AddonID = a.AddonID
                    WHERE sia.SaleItemID = ?
                """, req_item.saleItemId)
                addon_result = await cursor.fetchone()
                addon_total = addon_result.AddonTotal or Decimal('0.0')
                
                # Total cost per unit (item + addons divided by quantity)
                total_unit_cost = unit_price + (addon_total / original_qty if original_qty > 0 else Decimal('0.0'))
                item_refund_amount = total_unit_cost * Decimal(str(req_item.refundQuantity))
                
                total_refund_amount += item_refund_amount
                refund_details.append({
                    'sale_item_id': req_item.saleItemId,
                    'refund_quantity': req_item.refundQuantity,
                    'refund_amount': item_refund_amount,
                    'item_name': req_item.itemName
                })
            
            # Create refund record
            await cursor.execute("""
                INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                OUTPUT INSERTED.RefundID
                VALUES (?, ?, ?, GETDATE(), 'partial', ?)
            """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
            
            refund_id_row = await cursor.fetchone()
            if not refund_id_row:
                # Fallback method
                await cursor.execute("""
                    INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                    VALUES (?, ?, ?, GETDATE(), 'partial', ?);
                    SELECT @@IDENTITY AS RefundID;
                """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
                refund_id_row = await cursor.fetchone()
            
            refund_id = int(refund_id_row[0]) if refund_id_row else None
            
            if not refund_id:
                await conn.rollback()
                raise Exception("Failed to create refund record.")
            
            # Insert refunded items
            for detail in refund_details:
                await cursor.execute("""
                    INSERT INTO RefundedItems (RefundID, SaleItemID, RefundedQuantity, RefundAmount, CreatedAt)
                    VALUES (?, ?, ?, ?, GETDATE())
                """, refund_id, detail['sale_item_id'], detail['refund_quantity'], detail['refund_amount'])
            
            # Check if all items are fully refunded
            await cursor.execute("""
                SELECT si.SaleItemID, si.Quantity, ISNULL(SUM(ri.RefundedQuantity), 0) as TotalRefunded
                FROM SaleItems si
                LEFT JOIN RefundedItems ri ON si.SaleItemID = ri.SaleItemID
                WHERE si.SaleID = ?
                GROUP BY si.SaleItemID, si.Quantity
            """, parsed_id)

            all_items_check = await cursor.fetchall()
            all_fully_refunded = all(item.Quantity == item.TotalRefunded for item in all_items_check)

            # Update sale status
            if all_fully_refunded:
                await cursor.execute(
                    "UPDATE Sales SET Status = 'refunded', UpdatedAt = GETDATE() WHERE SaleID = ?",
                    parsed_id
                )
                status_message = "All items have been refunded. Order marked as fully refunded."
            else:
                await cursor.execute(
                    "UPDATE Sales SET UpdatedAt = GETDATE() WHERE SaleID = ?",
                    parsed_id
                )
                status_message = "Partial refund processed successfully."
            
            await conn.commit()
            
            # Blockchain Logging (PARTIAL REFUND)
            refund_data = {
                "refund_id": refund_id,
                "refund_type": "partial",
                "total_amount": float(total_refund_amount),
                "refunded_items": refund_details,
                "manager": request.managerUsername
            }
            await log_to_blockchain(
                service_identifier="PURCHASE_ORDER_SERVICE",
                action="REFUND",
                entity_type="PurchaseOrder",
                entity_id=parsed_id,
                actor_username=request.managerUsername,
                change_description=f"Partial refund processed for order {order_id} by {request.managerUsername}.",
                data=refund_data,
                token=current_user['access_token']
            )

            logger.info(f"Partial refund processed for order {order_id} by {request.managerUsername}. Refund ID: {refund_id}, Amount: {total_refund_amount}")
            
            return {
                "message": status_message,
                "order_id": order_id,
                "refund_id": refund_id,
                "refund_type": "full" if all_fully_refunded else "partial",
                "total_refund_amount": float(total_refund_amount),
                "refunded_items": [
                    {
                        "item_name": detail['item_name'],
                        "quantity": detail['refund_quantity'],
                        "amount": float(detail['refund_amount'])
                    }
                    for detail in refund_details
                ],
                "refunded_by": request.managerUsername,
                "refund_reason": request.refundReason
            }
    
    except HTTPException:
        if conn:
            await conn.rollback()
        raise
    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Unexpected error during partial refund for order {order_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred while processing the partial refund: {str(e)}"
        )
    
    finally:
        if conn:
            conn.autocommit = True
            await conn.close()


@router_refund.post(
    "/{order_id}/refund-today",
    status_code=status.HTTP_200_OK,
    summary="Process a full refund (same day only) for a completed order"
)
async def refund_order_today(
    order_id: str,
    request: RefundOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process a full refund for a completed order.
    Only allows refunding orders that have status 'completed'.
    Refunds must be processed on the SAME CALENDAR DAY as order completion.
    Requires manager authorization.
    """
    allowed_roles = ["cashier", "manager"]
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
        conn.autocommit = False
        
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT Status, CashierName, TotalDiscountAmount, UpdatedAt, CreatedAt FROM Sales WHERE SaleID = ?", 
                parsed_id
            )
            order_result = await cursor.fetchone()
            
            if not order_result:
                raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
            
            if order_result.Status.lower() != 'completed':
                raise HTTPException(
                    status_code=400,
                    detail=f"Only completed orders can be refunded. Current status: {order_result.Status}"
                )
            
            # Check if the order was completed today
            completion_time = order_result.UpdatedAt or order_result.CreatedAt
            if completion_time:
                if completion_time.date() != datetime.now().date():
                    raise HTTPException(
                        status_code=400,
                        detail="Refund window expired. Orders can only be refunded on the same day they were completed."
                    )

            await cursor.execute("""
                SELECT si.SaleItemID, si.ItemName, si.Quantity, si.UnitPrice,
                       COALESCE((SELECT SUM(a.Price * sia.Quantity) FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = si.SaleItemID), 0) as AddonTotal
                FROM SaleItems si WHERE si.SaleID = ?
            """, parsed_id)
            order_items = await cursor.fetchall()
            
            if not order_items:
                raise HTTPException(status_code=400, detail="No items found for this order.")

            total_refund_amount = sum((item.UnitPrice * item.Quantity) + item.AddonTotal for item in order_items)
            total_refund_amount -= (order_result.TotalDiscountAmount or Decimal('0.0'))
            
            try:
                await cursor.execute("UPDATE Sales SET Status = 'refunded', UpdatedAt = GETDATE() WHERE SaleID = ?", parsed_id)
                
                await cursor.execute("""
                    INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                    OUTPUT INSERTED.RefundID
                    VALUES (?, ?, ?, GETDATE(), 'full', ?)
                """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
                refund_id = (await cursor.fetchone())[0]

                for item in order_items:
                    item_total = (item.UnitPrice * item.Quantity) + item.AddonTotal
                    await cursor.execute("""
                        INSERT INTO RefundedItems (RefundID, SaleItemID, RefundedQuantity, RefundAmount, CreatedAt)
                        VALUES (?, ?, ?, ?, GETDATE())
                    """, refund_id, item.SaleItemID, item.Quantity, item_total)
                
                await conn.commit()
                
                # Blockchain Logging (FULL SAME-DAY REFUND)
                refund_data = {
                    "refund_id": refund_id,
                    "refund_type": "full",
                    "total_amount": float(total_refund_amount),
                    "refunded_items": [
                        {
                            "sale_item_id": item.SaleItemID,
                            "item_name": item.ItemName,
                            "quantity": item.Quantity,
                            "refund_amount": float((item.UnitPrice * item.Quantity) + item.AddonTotal)
                        }
                        for item in order_items
                    ],
                    "manager": request.managerUsername
                }
                await log_to_blockchain(
                    service_identifier="PURCHASE_ORDER_SERVICE",
                    action="REFUND",
                    entity_type="PurchaseOrder",
                    entity_id=parsed_id,
                    actor_username=request.managerUsername,
                    change_description=f"Same-day full refund processed for order {order_id} by {request.managerUsername}.",
                    data=refund_data,
                    token=current_user['access_token']
                )

                logger.info(f"Full refund (today) processed for order {order_id} by {request.managerUsername}.")
                
                return {"message": "Order has been successfully refunded (full refund).", "order_id": order_id}
                
            except Exception as db_exc:
                await conn.rollback()
                logger.error(f"DB error during full refund (today) for order {order_id}: {db_exc}", exc_info=True)
                raise HTTPException(status_code=500, detail="Failed to process refund in database.")
    finally:
        if conn:
            conn.autocommit = True
            await conn.close()


@router_refund.post(
    "/{order_id}/partial-refund-today",
    status_code=status.HTTP_200_OK,
    summary="Process a partial refund (same day only) for specific items"
)
async def partial_refund_order_today(
    order_id: str,
    request: PartialRefundOrderRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process a partial refund for specific items in a completed order.
    Only allows refunding orders that have status 'completed' or are already partially refunded.
    Refunds must be processed on the SAME CALENDAR DAY as order completion.
    """
    allowed_roles = ["cashier", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to process refunds.")
    
    try:
        parsed_id = int(order_id.split('-')[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    
    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False
        
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT Status, UpdatedAt, CreatedAt FROM Sales WHERE SaleID = ?", parsed_id
            )
            order_result = await cursor.fetchone()
            
            if not order_result:
                raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
            
            if order_result.Status.lower() not in ['completed', 'refunded']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only completed or partially refunded orders can be refunded. Current status: {order_result.Status}"
                )
            
            # Check if the order was completed today
            completion_time = order_result.UpdatedAt or order_result.CreatedAt
            if completion_time:
                if completion_time.date() != datetime.now().date():
                    raise HTTPException(
                        status_code=400,
                        detail="Refund window expired. Orders can only be refunded on the same day they were completed."
                    )

            sale_item_ids = [item.saleItemId for item in request.items]
            placeholders = ','.join(['?' for _ in sale_item_ids])
            
            await cursor.execute(
                f"SELECT SaleItemID, Quantity, UnitPrice FROM SaleItems WHERE SaleID = ? AND SaleItemID IN ({placeholders})",
                parsed_id, *sale_item_ids
            )
            valid_items = await cursor.fetchall()
            
            if len(valid_items) != len(request.items):
                raise HTTPException(status_code=400, detail="One or more items do not belong to this order.")
            
            await cursor.execute(f"""
                SELECT ri.SaleItemID, SUM(ri.RefundedQuantity) as TotalRefunded
                FROM RefundedOrders ro JOIN RefundedItems ri ON ro.RefundID = ri.RefundID
                WHERE ro.SaleID = ? AND ri.SaleItemID IN ({placeholders}) GROUP BY ri.SaleItemID
            """, parsed_id, *sale_item_ids)
            already_refunded = {row.SaleItemID: row.TotalRefunded for row in await cursor.fetchall()}
            
            total_refund_amount = Decimal('0.0')
            refund_details = []
            
            for req_item in request.items:
                db_item = next((item for item in valid_items if item.SaleItemID == req_item.saleItemId), None)
                remaining_qty = db_item.Quantity - already_refunded.get(req_item.saleItemId, 0)
                
                if req_item.refundQuantity > remaining_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot refund {req_item.refundQuantity} of {req_item.itemName}. Only {remaining_qty} remaining."
                    )
                
                await cursor.execute("SELECT SUM(a.Price * sia.Quantity) as AddonTotal FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = ?", req_item.saleItemId)
                addon_total = (await cursor.fetchone()).AddonTotal or Decimal('0.0')
                
                total_unit_cost = db_item.UnitPrice + (addon_total / db_item.Quantity if db_item.Quantity > 0 else Decimal('0.0'))
                item_refund_amount = total_unit_cost * Decimal(req_item.refundQuantity)
                total_refund_amount += item_refund_amount
                
                refund_details.append({
                    'sale_item_id': req_item.saleItemId,
                    'refund_quantity': req_item.refundQuantity,
                    'refund_amount': item_refund_amount,
                    'item_name': req_item.itemName
                })
            
            await cursor.execute("""
                INSERT INTO RefundedOrders (SaleID, ManagerUsername, RefundReason, RefundedAt, RefundType, RefundAmount)
                OUTPUT INSERTED.RefundID
                VALUES (?, ?, ?, GETDATE(), 'partial', ?)
            """, parsed_id, request.managerUsername, request.refundReason, total_refund_amount)
            refund_id = (await cursor.fetchone())[0]
            
            for detail in refund_details:
                await cursor.execute("INSERT INTO RefundedItems (RefundID, SaleItemID, RefundedQuantity, RefundAmount) VALUES (?, ?, ?, ?)", refund_id, detail['sale_item_id'], detail['refund_quantity'], detail['refund_amount'])

            await cursor.execute("UPDATE Sales SET UpdatedAt = GETDATE() WHERE SaleID = ?", parsed_id)
            await conn.commit()
            
            refund_data = {
                "refund_id": refund_id,
                "refund_type": "partial",
                "total_amount": float(total_refund_amount),
                "refunded_items": refund_details,
                "manager": request.managerUsername
            }
            await log_to_blockchain(
                service_identifier="PURCHASE_ORDER_SERVICE",
                action="REFUND",
                entity_type="PurchaseOrder",
                entity_id=parsed_id,
                actor_username=request.managerUsername,
                change_description=f"Same-day partial refund processed for order {order_id} by {request.managerUsername}.",
                data=refund_data,
                token=current_user['access_token']
            )

            logger.info(f"Partial refund (today) processed for order {order_id} by {request.managerUsername}.")
            
            return {
                "message": "Partial refund processed successfully.",
                "order_id": order_id,
                "refund_id": refund_id,
                "refund_type": "partial",
                "total_refund_amount": float(total_refund_amount),
                "refunded_items": [
                    {
                        "item_name": detail['item_name'],
                        "quantity": detail['refund_quantity'],
                        "amount": float(detail['refund_amount'])
                    }
                    for detail in refund_details
                ],
                "refunded_by": request.managerUsername,
                "refund_reason": request.refundReason
            }

    except HTTPException:
        if conn:
            await conn.rollback()
        raise
    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Unexpected error during partial refund (today) for order {order_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while processing the partial refund: {str(e)}"
        )
    
    finally:
        if conn:
            conn.autocommit = True
            await conn.close()


@router_refund.get(
    "/{order_id}/refunds",
    status_code=status.HTTP_200_OK,
    summary="Get refund history for a specific order"
)
async def get_order_refunds(
    order_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Retrieve all refunds (full and partial) for a specific order.
    """
    allowed_roles = ["cashier", "admin", "manager"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view refund history."
        )
    
    try:
        parsed_id = int(order_id.split('-')[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            await cursor.execute("""
                SELECT 
                    ro.RefundID,
                    ro.RefundType,
                    ro.RefundAmount,
                    ro.ManagerUsername,
                    ro.RefundReason,
                    ro.RefundedAt,
                    ri.SaleItemID,
                    si.ItemName,
                    ri.RefundedQuantity,
                    ri.RefundAmount as ItemRefundAmount
                FROM RefundedOrders ro
                LEFT JOIN RefundedItems ri ON ro.RefundID = ri.RefundID
                LEFT JOIN SaleItems si ON ri.SaleItemID = si.SaleItemID
                WHERE ro.SaleID = ?
                ORDER BY ro.RefundedAt DESC
            """, parsed_id)
            
            rows = await cursor.fetchall()
            
            if not rows:
                return {
                    "order_id": order_id,
                    "refunds": []
                }
            
            # Group refunds
            refunds_dict = {}
            for row in rows:
                refund_id = row.RefundID
                if refund_id not in refunds_dict:
                    refunds_dict[refund_id] = {
                        "refund_id": refund_id,
                        "refund_type": row.RefundType,
                        "total_amount": float(row.RefundAmount or 0),
                        "manager_username": row.ManagerUsername,
                        "reason": row.RefundReason,
                        "refunded_at": row.RefundedAt.strftime("%B %d, %Y %I:%M %p"),
                        "items": []
                    }
                
                if row.SaleItemID:
                    refunds_dict[refund_id]["items"].append({
                        "item_name": row.ItemName,
                        "quantity": row.RefundedQuantity,
                        "amount": float(row.ItemRefundAmount or 0)
                    })
            
            return {
                "order_id": order_id,
                "refunds": list(refunds_dict.values())
            }
    
    except Exception as e:
        logger.error(f"Error fetching refund history for order {order_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch refund history."
        )
    
    finally:
        if conn:
            await conn.close()