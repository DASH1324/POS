# SalesServices/routers/pos_router.py

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
import json
import sys
import os
import httpx
import logging 

# --- Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth and Service URL Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# --- URLs for Inventory Deduction Endpoints ---
INGREDIENTS_DEDUCT_URL = "http://127.0.0.1:8002/ingredients/deduct-from-sale"
MATERIALS_DEDUCT_URL = "http://127.0.0.1:8002/materials/deduct-from-sale"
MERCHANDISE_DEDUCT_URL = "http://127.0.0.1:8002/merchandise/deduct-from-sale"

router_sales = APIRouter(prefix="/auth/sales", tags=["sales"])

# --- Pydantic Models ---
class AddonDetail(BaseModel):
    addonId: int
    addonName: str
    price: float
    quantity: int

class SaleItem(BaseModel):
    id: int 
    name: str
    quantity: int
    price: float
    category: str
    addons: List[AddonDetail]
    type: Optional[str] = "product"  

class Sale(BaseModel):
    cartItems: List[SaleItem]
    orderType: str
    paymentMethod: str
    appliedDiscounts: List[str]
    gcashReference: Optional[str] = None

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Invalid token or user not found: {e.response.text}")
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not connect to the authentication service.")

# --- Helper to call Inventory Services ---
async def trigger_inventory_deduction(url: str, cart_items: List[SaleItem], token: str, inventory_type: str):
    logger.info(f"Triggering {inventory_type.upper()} deduction.")
    payload = {
        "cartItems": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "addons": [addon.dict() for addon in item.addons]
            }
            for item in cart_items
        ]
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"Successfully requested {inventory_type.upper()} deduction.")
    except Exception as e:
        error_text = str(e)
        if hasattr(e, 'response') and e.response:
            try:
                error_text = e.response.json().get('detail', e.response.text)
            except:
                error_text = e.response.text
        logger.critical(f"{inventory_type.upper()}-SYNC-FAILURE: Sale processed, but failed to deduct. Error: {error_text}")

# --- New helper function to separate items by type ---
def separate_cart_items_by_type(cart_items: List[SaleItem]):
    """Separates cart items into products and merchandise"""
    products = []
    merchandise = []
    
    for item in cart_items:
        # Check if item type is explicitly set to merchandise or if category indicates merchandise
        if hasattr(item, 'type') and item.type == 'merchandise' or item.category == 'Merchandise':
            merchandise.append(item)
        else:
            products.append(item)
    
    return products, merchandise

# --- Helper function for calculations ---
async def calculate_totals_and_discounts(sale_data: Sale, cursor):
    subtotal = Decimal('0.0')
    for item in sale_data.cartItems:
        item_price = Decimal(str(item.price))
        addons_price = Decimal('0.0')
        if item.addons:
            for addon in item.addons:
                addons_price += Decimal(str(addon.price)) * addon.quantity
        subtotal += (item_price + addons_price) * item.quantity

    total_discount_amount = Decimal('0.0')
    applied_discounts_details = []
    if not sale_data.appliedDiscounts:
        return subtotal, total_discount_amount, applied_discounts_details

    placeholders = ','.join(['?' for _ in sale_data.appliedDiscounts])
    sql_fetch_discounts = f"SELECT id, discount_type, discount_value, minimum_spend FROM discounts WHERE name IN ({placeholders}) AND status = 'active'"
    await cursor.execute(sql_fetch_discounts, sale_data.appliedDiscounts)
    valid_discounts = await cursor.fetchall()

    for discount in valid_discounts:
        min_spend = discount.minimum_spend or Decimal('0.0')
        if subtotal >= min_spend:
            discount_value = Decimal('0.0')
            if discount.discount_type == 'percentage' and discount.discount_value is not None:
                discount_value = (subtotal * Decimal(str(discount.discount_value))) / Decimal('100')
            elif discount.discount_type == 'fixed_amount' and discount.discount_value is not None:
                discount_value = Decimal(str(discount.discount_value))
            total_discount_amount += discount_value
            applied_discounts_details.append({"id": discount.id, "amount": discount_value})
    
    final_discount = min(total_discount_amount, subtotal)
    return subtotal, final_discount, applied_discounts_details

# --- API Endpoint to Create a Sale ---
@router_sales.post("/", status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale: Sale, 
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Processes a new sale, records it in the database with an initial 'processing' status,
    and triggers inventory deduction for ingredients, materials, and merchandise as needed.
    """
    if current_user.get("userRole") not in ["cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create a sale.")

    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False # Start manual transaction control
        
        async with conn.cursor() as cursor:
            subtotal, total_discount, discount_details = await calculate_totals_and_discounts(sale, cursor)
            cashier_name = current_user.get("username", "SystemUser")

            # Create sale record with processing status
            sql_sale = """
                INSERT INTO Sales (OrderType, PaymentMethod, CashierName, TotalDiscountAmount, GCashReferenceNumber, Status) 
                OUTPUT INSERTED.SaleID 
                VALUES (?, ?, ?, ?, ?, 'processing') 
            """
            await cursor.execute(sql_sale, sale.orderType, sale.paymentMethod, cashier_name, total_discount, sale.gcashReference)
            sale_id_row = await cursor.fetchone()
            if not sale_id_row or not sale_id_row[0]:
                raise HTTPException(status_code=500, detail="Failed to create sale record, starting rollback.")
            sale_id = sale_id_row[0]

            # Step 2: Loop through cart items and insert them and their addons
            for item in sale.cartItems:
                # 2a: Insert into SaleItems
                sql_item = """
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category) 
                    OUTPUT INSERTED.SaleItemID
                    VALUES (?, ?, ?, ?, ?)
                """
                await cursor.execute(sql_item, sale_id, item.name, item.quantity, Decimal(str(item.price)), item.category)
                sale_item_id_row = await cursor.fetchone()
                if not sale_item_id_row or not sale_item_id_row[0]:
                    raise HTTPException(status_code=500, detail=f"Failed to insert sale item: {item.name}")
                sale_item_id = sale_item_id_row[0]
                
                # 2b: Get or Create Addons, then link them to the SaleItem
                if item.addons:
                    for addon in item.addons:
                        sql_check_addon = "SELECT 1 FROM Addons WHERE AddonID = ?"
                        await cursor.execute(sql_check_addon, addon.addonId)
                        addon_exists = await cursor.fetchone()

                        if not addon_exists:
                            logger.info(f"New addon detected. ID: {addon.addonId}, Name: {addon.addonName}. Saving to POS database.")
                            await cursor.execute("SET IDENTITY_INSERT dbo.Addons ON;")
                            sql_create_addon = "INSERT INTO Addons (AddonID, AddonName, Price) VALUES (?, ?, ?)"
                            await cursor.execute(sql_create_addon, addon.addonId, addon.addonName, Decimal(str(addon.price)))
                            await cursor.execute("SET IDENTITY_INSERT dbo.Addons OFF;")
                        
                        sql_link_addon = "INSERT INTO SaleItemAddons (SaleItemID, AddonID, Quantity) VALUES (?, ?, ?)"
                        await cursor.execute(sql_link_addon, sale_item_id, addon.addonId, addon.quantity)

            # Step 3: Insert records for applied discounts
            for discount in discount_details:
                sql_sale_discount = "INSERT INTO SaleDiscounts (SaleID, DiscountID, DiscountAppliedAmount) VALUES (?, ?, ?)"
                await cursor.execute(sql_sale_discount, sale_id, discount['id'], discount['amount'])

            # Step 4: If all DB operations are successful, commit the transaction
            await conn.commit()
            
        # Step 5: Separate items by type and trigger appropriate deductions
        products, merchandise = separate_cart_items_by_type(sale.cartItems)
        
        # Trigger deductions for products (ingredients and materials)
        if products:
            await trigger_inventory_deduction(INGREDIENTS_DEDUCT_URL, cart_items=products, token=token, inventory_type="Ingredient")
            await trigger_inventory_deduction(MATERIALS_DEDUCT_URL, cart_items=products, token=token, inventory_type="Material")
        
        # Trigger deductions for merchandise
        if merchandise:
            await trigger_inventory_deduction(MERCHANDISE_DEDUCT_URL, cart_items=merchandise, token=token, inventory_type="Merchandise")
            
        final_total = subtotal - total_discount
        return {
            "saleId": sale_id,
            "subtotal": float(subtotal),
            "discountAmount": float(total_discount),
            "finalTotal": float(final_total)
        }

    except Exception as e:
        if conn:
            logger.warning("An error occurred. Rolling back database transaction.")
            await conn.rollback()
        
        logger.error(f"Error processing sale: {e}", exc_info=True)
        
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the sale.")

    finally:
        if conn:
            conn.autocommit = True # Reset autocommit for the connection pool
            await conn.close()


@router_sales.get("/status/{status}")
async def get_orders_by_status(
    status: str,
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Fetch orders by status with proper add-ons and discount calculations
    """
    if current_user.get("userRole") not in ["admin", "manager", "cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # Main query to get sales with basic info
            sql_sales = """
                SELECT s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName, 
                       s.TotalDiscountAmount, s.Status, s.GCashReferenceNumber
                FROM Sales s 
                WHERE s.Status = ?
                ORDER BY s.CreatedAt DESC
            """
            await cursor.execute(sql_sales, status)
            sales = await cursor.fetchall()
            
            orders = []
            for sale in sales:
                sale_id = sale.SaleID
                
                # Get sale items
                sql_items = """
                    SELECT si.ItemName, si.Quantity, si.UnitPrice, si.Category, si.SaleItemID
                    FROM SaleItems si
                    WHERE si.SaleID = ?
                """
                await cursor.execute(sql_items, sale_id)
                items = await cursor.fetchall()
                
                # Calculate subtotal from items (base prices only)
                item_subtotal = Decimal('0.0')
                order_items = []
                total_addons_cost = Decimal('0.0')
                
                for item in items:
                    item_total = Decimal(str(item.UnitPrice)) * item.Quantity
                    item_subtotal += item_total
                    
                    # Get add-ons for this item
                    sql_addons = """
                        SELECT a.AddonName, a.Price, sia.Quantity
                        FROM SaleItemAddons sia
                        JOIN Addons a ON sia.AddonID = a.AddonID
                        WHERE sia.SaleItemID = ?
                    """
                    await cursor.execute(sql_addons, item.SaleItemID)
                    item_addons = await cursor.fetchall()
                    
                    # Calculate add-ons cost for this item
                    item_addons_cost = Decimal('0.0')
                    addons_list = []
                    for addon in item_addons:
                        addon_cost = Decimal(str(addon.Price)) * addon.Quantity
                        item_addons_cost += addon_cost
                        total_addons_cost += addon_cost
                        addons_list.append({
                            'name': addon.AddonName,
                            'price': float(addon.Price),
                            'quantity': addon.Quantity
                        })
                    
                    order_items.append({
                        'name': item.ItemName,
                        'quantity': item.Quantity,
                        'price': float(item.UnitPrice),
                        'category': item.Category,
                        'addons': addons_list
                    })
                
                # Get actual discount amount (already stored in Sales table)
                total_discount = Decimal(str(sale.TotalDiscountAmount))
                
                # Calculate final total
                final_total = item_subtotal + total_addons_cost - total_discount
                
                orders.append({
                    'id': sale_id,
                    'orderType': sale.OrderType,
                    'paymentMethod': sale.PaymentMethod,
                    'date': sale.CreatedAt.isoformat(),
                    'status': sale.Status,
                    'cashierName': sale.CashierName,
                    'gcashReference': sale.GCashReferenceNumber,
                    'orderItems': order_items,
                    'subtotal': float(item_subtotal),
                    'addOns': float(total_addons_cost),  # Actual add-ons cost
                    'discount': float(total_discount),   # Actual discount amount
                    'total': float(final_total)
                })
            
            return orders
            
    except Exception as e:
        logger.error(f"Error fetching orders by status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch orders")
    finally:
        if conn:
            await conn.close()