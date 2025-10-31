# SalesServices/routers/pos_router.py

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
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
    promotionalDiscountAmount: Optional[float] = 0.0
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
        async with httpx.AsyncClient(timeout=30.0) as client:
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

# --- Background task to handle inventory deductions ---
async def process_inventory_deductions_background(products: List[SaleItem], merchandise: List[SaleItem], token: str):
    """Process inventory deductions in the background after sale is confirmed"""
    try:
        if products:
            await trigger_inventory_deduction(INGREDIENTS_DEDUCT_URL, cart_items=products, token=token, inventory_type="Ingredient")
            await trigger_inventory_deduction(MATERIALS_DEDUCT_URL, cart_items=products, token=token, inventory_type="Material")
        if merchandise:
            await trigger_inventory_deduction(MERCHANDISE_DEDUCT_URL, cart_items=merchandise, token=token, inventory_type="Merchandise")
    except Exception as e:
        logger.error(f"Background inventory deduction error: {e}", exc_info=True)

# --- New helper function to separate items by type ---
def separate_cart_items_by_type(cart_items: List[SaleItem]):
    products = []
    merchandise = []
    
    for item in cart_items:
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

@router_sales.post("/", status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale: Sale, 
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create a sale.")

    conn = None
    try:
        conn = await get_db_connection()
        conn.autocommit = False 
        
        async with conn.cursor() as cursor:
            subtotal, manual_discount, discount_details = await calculate_totals_and_discounts(sale, cursor)
            promo_discount = Decimal(str(sale.promotionalDiscountAmount or 0.0))
            cashier_name = current_user.get("username", "SystemUser")

            sql_sale = """
                DECLARE @InsertedSales TABLE (SaleID INT);
                
                INSERT INTO Sales (
                    OrderType, PaymentMethod, CashierName, 
                    TotalDiscountAmount, PromotionalDiscountAmount, 
                    GCashReferenceNumber, Status
                ) 
                OUTPUT INSERTED.SaleID INTO @InsertedSales
                VALUES (?, ?, ?, ?, ?, ?, 'processing');
                
                SELECT SaleID FROM @InsertedSales;
            """
            
            await cursor.execute(
                sql_sale, 
                sale.orderType, sale.paymentMethod, cashier_name, 
                manual_discount, promo_discount, 
                sale.gcashReference
            )
            
            while not cursor.description:
                if not await cursor.nextset():
                    break

            sale_id_row = await cursor.fetchone()
            if not sale_id_row or not sale_id_row[0]:
                raise HTTPException(status_code=500, detail="Failed to create sale record, starting rollback.")
            sale_id = sale_id_row[0]

            for item in sale.cartItems:
                sql_item = """
                    DECLARE @InsertedItems TABLE (SaleItemID INT);
                    
                    INSERT INTO SaleItems (SaleID, ItemName, Quantity, UnitPrice, Category) 
                    OUTPUT INSERTED.SaleItemID INTO @InsertedItems
                    VALUES (?, ?, ?, ?, ?);
                    
                    SELECT SaleItemID FROM @InsertedItems;
                """
                await cursor.execute(sql_item, sale_id, item.name, item.quantity, Decimal(str(item.price)), item.category)
                
                while not cursor.description:
                    if not await cursor.nextset():
                        break
                
                sale_item_id_row = await cursor.fetchone()
                if not sale_item_id_row or not sale_item_id_row[0]:
                    raise HTTPException(status_code=500, detail=f"Failed to insert sale item: {item.name}")
                sale_item_id = sale_item_id_row[0]
                
                if item.addons:
                    for addon in item.addons:
                        await cursor.execute("SELECT 1 FROM Addons WHERE AddonID = ?", addon.addonId)
                        if not await cursor.fetchone():
                            await cursor.execute("SET IDENTITY_INSERT dbo.Addons ON;")
                            await cursor.execute("INSERT INTO Addons (AddonID, AddonName, Price) VALUES (?, ?, ?)", addon.addonId, addon.addonName, Decimal(str(addon.price)))
                            await cursor.execute("SET IDENTITY_INSERT dbo.Addons OFF;")
                        
                        await cursor.execute("INSERT INTO SaleItemAddons (SaleItemID, AddonID, Quantity) VALUES (?, ?, ?)", sale_item_id, addon.addonId, addon.quantity)

            for discount in discount_details:
                sql_sale_discount = "INSERT INTO SaleDiscounts (SaleID, DiscountID, DiscountAppliedAmount) VALUES (?, ?, ?)"
                await cursor.execute(sql_sale_discount, sale_id, discount['id'], discount['amount'])

            await conn.commit()
            
        # Schedule inventory deductions as background task
        products, merchandise = separate_cart_items_by_type(sale.cartItems)
        background_tasks.add_task(process_inventory_deductions_background, products, merchandise, token)
        
        # Return immediately without waiting for inventory deductions
        total_combined_discount = manual_discount + promo_discount
        final_total = subtotal - total_combined_discount
        return {
            "saleId": sale_id,
            "subtotal": float(subtotal),
            "discountAmount": float(total_combined_discount),
            "finalTotal": float(final_total)
        }

    except Exception as e:
        if conn: await conn.rollback()
        logger.error(f"Error processing sale: {e}", exc_info=True)
        raise e if isinstance(e, HTTPException) else HTTPException(status_code=500, detail="An unexpected error occurred.")

    finally:
        if conn:
            conn.autocommit = True 
            await conn.close()
            

@router_sales.get("/status/{status}")
async def get_orders_by_status(
    status: str,
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_active_user)
):
    if current_user.get("userRole") not in ["admin", "manager", "cashier"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    
    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            sql_sales = """
                SELECT s.SaleID, s.OrderType, s.PaymentMethod, s.CreatedAt, s.CashierName, 
                       s.TotalDiscountAmount, s.PromotionalDiscountAmount, 
                       s.Status, s.GCashReferenceNumber
                FROM Sales s 
                WHERE s.Status = ?
                ORDER BY s.CreatedAt DESC
            """
            await cursor.execute(sql_sales, status)
            sales = await cursor.fetchall()
            
            orders = []
            for sale in sales:
                sale_id = sale.SaleID
                sql_items = "SELECT si.ItemName, si.Quantity, si.UnitPrice, si.Category, si.SaleItemID FROM SaleItems si WHERE si.SaleID = ?"
                await cursor.execute(sql_items, sale_id)
                items = await cursor.fetchall()
                
                item_subtotal = Decimal('0.0')
                order_items = []
                total_addons_cost = Decimal('0.0')
                
                for item in items:
                    item_total = Decimal(str(item.UnitPrice)) * item.Quantity
                    item_subtotal += item_total
                    
                    sql_addons = "SELECT a.AddonName, a.Price, sia.Quantity FROM SaleItemAddons sia JOIN Addons a ON sia.AddonID = a.AddonID WHERE sia.SaleItemID = ?"
                    await cursor.execute(sql_addons, item.SaleItemID)
                    item_addons = await cursor.fetchall()
                    
                    addons_list = []
                    for addon in item_addons:
                        addon_cost = Decimal(str(addon.Price)) * addon.Quantity
                        total_addons_cost += addon_cost
                        addons_list.append({'name': addon.AddonName, 'price': float(addon.Price), 'quantity': addon.Quantity})
                    
                    order_items.append({'name': item.ItemName, 'quantity': item.Quantity, 'price': float(item.UnitPrice), 'category': item.Category, 'addons': addons_list})
                
                manual_discount = Decimal(str(sale.TotalDiscountAmount or 0))
                promo_discount = Decimal(str(sale.PromotionalDiscountAmount or 0))
                total_combined_discount = manual_discount + promo_discount

                full_subtotal = item_subtotal + total_addons_cost
                final_total = full_subtotal - total_combined_discount
                
                orders.append({
                    'id': sale_id,
                    'orderType': sale.OrderType,
                    'paymentMethod': sale.PaymentMethod,
                    'date': sale.CreatedAt.isoformat(),
                    'status': sale.Status,
                    'cashierName': sale.CashierName,
                    'gcashReference': sale.GCashReferenceNumber,
                    'orderItems': order_items,
                    'subtotal': float(full_subtotal),
                    'addOns': float(total_addons_cost),
                    'promotionalDiscount': float(promo_discount),
                    'manualDiscount': float(manual_discount),
                    'total': float(final_total)
                })
            
            return orders
            
    except Exception as e:
        logger.error(f"Error fetching orders by status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch orders")
    finally:
        if conn:
            await conn.close()