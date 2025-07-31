# routers/discount.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from decimal import Decimal
from datetime import date
import httpx 

# --- Database Connection Import ---
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# =============================================================================
# CONFIGURATION
# =============================================================================
EXTERNAL_PRODUCTS_API_URL = "http://127.0.0.1:8001/is_products/products/details/" 
AUTH_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# =============================================================================
# ROUTER SETUP & OAUTH2 SCHEME
# =============================================================================
router = APIRouter() 
discounts_router = APIRouter(prefix="/discounts", tags=["Discounts"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:4000/auth/token")

# =============================================================================
# AUTHORIZATION HELPER
# =============================================================================
async def validate_token_and_roles(token: str, allowed_roles: List[str]):
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(AUTH_SERVICE_ME_URL, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Authentication service error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Authentication service is unavailable: {e}")

    user_data = response.json()
    user_role = user_data.get("userRole")

    if user_role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Access denied. Role '{user_role}' is not authorized.")
    
    return user_data

# =============================================================================
# PYDANTIC MODELS
# =============================================================================
class DiscountBase(BaseModel):
    discountName: str = Field(..., max_length=255)
    applicationType: Literal['all_products', 'specific_categories', 'specific_products']
    selectedCategories: Optional[List[str]] = []
    selectedProducts: Optional[List[str]] = []
    discountType: Literal['percentage', 'fixed_amount']
    discountValue: Decimal = Field(..., gt=0)
    minSpend: Optional[Decimal] = Field(0, ge=0)
    validFrom: date
    validTo: date
    status: Literal['active', 'inactive', 'expired']

class DiscountCreate(DiscountBase): pass
class DiscountUpdate(DiscountBase): pass

# --- MODIFIED: Added fields to send applicability rules to the frontend ---
class DiscountListOut(BaseModel):
    id: int
    name: str
    application: str
    discount: str
    minSpend: float
    validFrom: str
    validTo: str
    status: str
    type: str
    # --- NEW FIELDS FOR FRONTEND LOGIC ---
    application_type: str
    applicable_products: List[str]
    applicable_categories: List[str]

class DiscountDetailOut(DiscountBase):
    id: int

# =============================================================================
# HELPER FUNCTION FOR EXTERNAL DATA (Unchanged)
# =============================================================================
async def get_external_choices(token: str):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(EXTERNAL_PRODUCTS_API_URL, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            valid_products = {item['ProductName'] for item in data if 'ProductName' in item and item['ProductName']}
            valid_categories = {item['ProductCategory'] for item in data if 'ProductCategory' in item and item['ProductCategory']}
            return valid_products, valid_categories
    except httpx.RequestError as e:
        detail = f"Network error communicating with Products service: {e}"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    except httpx.HTTPStatusError as e:
        detail = f"Products service returned an error: Status {e.response.status_code} - Response: {e.response.text}"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

# =============================================================================
# DISCOUNT ENDPOINTS
# =============================================================================

@discounts_router.post("/", response_model=DiscountDetailOut, status_code=status.HTTP_201_CREATED)
async def create_discount(discount_data: DiscountCreate, token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager"])
    conn = await get_db_connection()
    try:
        conn.autocommit = False
        async with conn.cursor() as cursor:
            sql_insert = """
                INSERT INTO discounts (name, status, application_type, discount_type, discount_value, minimum_spend, valid_from, valid_to)
                OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """
            await cursor.execute(sql_insert, discount_data.discountName, discount_data.status, discount_data.applicationType,
                                 discount_data.discountType, discount_data.discountValue, discount_data.minSpend,
                                 discount_data.validFrom.isoformat(), discount_data.validTo.isoformat())
            new_id = (await cursor.fetchone())[0]

            if discount_data.applicationType == 'specific_products':
                for name in discount_data.selectedProducts: await cursor.execute("INSERT INTO discount_applicable_products (discount_id, product_name) VALUES (?, ?)", new_id, name)
            elif discount_data.applicationType == 'specific_categories':
                for name in discount_data.selectedCategories: await cursor.execute("INSERT INTO discount_applicable_categories (discount_id, category_name) VALUES (?, ?)", new_id, name)
            
            await conn.commit()
            return DiscountDetailOut(id=new_id, **discount_data.model_dump())
    except Exception as e:
        await conn.rollback()
        if "UNIQUE" in str(e).upper(): raise HTTPException(status_code=409, detail=f"A discount with the name '{discount_data.discountName}' already exists.")
        raise HTTPException(status_code=500, detail=f"Database error on create: {e}")
    finally:
        conn.autocommit = True
        if conn: await conn.close()

# --- MODIFIED: This is the key function that was updated ---
@discounts_router.get("/", response_model=List[DiscountListOut])
async def get_all_discounts(token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager", "staff", "cashier"])
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT id, name, status, application_type, discount_type, discount_value, minimum_spend, valid_from, valid_to FROM discounts ORDER BY id DESC")
            discounts_raw = await cursor.fetchall()
            discounts_map = {row.id: {"data": dict(zip([c[0] for c in cursor.description], row)), "products": [], "categories": []} for row in discounts_raw}
            
            await cursor.execute("SELECT discount_id, product_name FROM discount_applicable_products")
            for row in await cursor.fetchall():
                if row.discount_id in discounts_map: discounts_map[row.discount_id]["products"].append(row.product_name)
            
            await cursor.execute("SELECT discount_id, category_name FROM discount_applicable_categories")
            for row in await cursor.fetchall():
                if row.discount_id in discounts_map: discounts_map[row.discount_id]["categories"].append(row.category_name)
            
            results = []
            for _, item_data in discounts_map.items():
                d, prods, cats = item_data['data'], item_data['products'], item_data['categories']
                app_str = "All Products"
                if d['application_type'] == 'specific_products': app_str = f"{len(prods)} Product(s)"
                elif d['application_type'] == 'specific_categories': app_str = f"{len(cats)} Category(s)"
                disc_str = f"₱{d['discount_value']:.2f}"
                if d['discount_type'] == 'percentage': disc_str = f"{d['discount_value']:.1f}%"
                
                # --- MODIFIED: Populate the new fields in the response model ---
                results.append(DiscountListOut(
                    id=d['id'], 
                    name=d['name'], 
                    application=app_str, 
                    discount=disc_str, 
                    minSpend=float(d['minimum_spend']), 
                    validFrom=d['valid_from'].strftime('%Y-%m-%d'), 
                    validTo=d['valid_to'].strftime('%Y-%m-%d'), 
                    status=d['status'], 
                    type=d['discount_type'],
                    # --- ADDED THESE LINES ---
                    application_type=d['application_type'],
                    applicable_products=prods,
                    applicable_categories=cats
                ))
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error on get all: {e}")
    finally:
        if conn: await conn.close()

@discounts_router.get("/{discount_id}", response_model=DiscountDetailOut)
async def get_discount(discount_id: int, token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager", "staff", "cashier"])
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT * FROM discounts WHERE id=?", discount_id)
            d = await cursor.fetchone()
            if not d: raise HTTPException(status_code=404, detail="Discount not found")
            
            base_data = dict(zip([c[0] for c in cursor.description], d))
            await cursor.execute("SELECT product_name FROM discount_applicable_products WHERE discount_id=?", discount_id)
            products = [row.product_name for row in await cursor.fetchall()]
            await cursor.execute("SELECT category_name FROM discount_applicable_categories WHERE discount_id=?", discount_id)
            categories = [row.category_name for row in await cursor.fetchall()]

            return DiscountDetailOut(
                id=base_data['id'], discountName=base_data['name'], applicationType=base_data['application_type'],
                selectedProducts=products, selectedCategories=categories, discountType=base_data['discount_type'],
                discountValue=base_data['discount_value'], minSpend=base_data['minimum_spend'],
                validFrom=base_data['valid_from'], validTo=base_data['valid_to'], status=base_data['status'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error on get one: {e}")
    finally:
        if conn: await conn.close()

@discounts_router.put("/{discount_id}", response_model=DiscountDetailOut)
async def update_discount(discount_id: int, discount_data: DiscountUpdate, token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager"])
    conn = await get_db_connection()
    try:
        conn.autocommit = False
        async with conn.cursor() as cursor:
            sql_update = """
                UPDATE discounts SET name=?, status=?, application_type=?, discount_type=?, discount_value=?, minimum_spend=?, valid_from=?, valid_to=?, updated_at=GETDATE()
                WHERE id=?
            """
            await cursor.execute(sql_update, discount_data.discountName, discount_data.status, discount_data.applicationType,
                                 discount_data.discountType, discount_data.discountValue, discount_data.minSpend,
                                 discount_data.validFrom.isoformat(), discount_data.validTo.isoformat(), discount_id)
            if cursor.rowcount == 0: raise HTTPException(status_code=404, detail="Discount not found")

            await cursor.execute("DELETE FROM discount_applicable_products WHERE discount_id=?", discount_id)
            await cursor.execute("DELETE FROM discount_applicable_categories WHERE discount_id=?", discount_id)

            if discount_data.applicationType == 'specific_products':
                for name in discount_data.selectedProducts: await cursor.execute("INSERT INTO discount_applicable_products (discount_id, product_name) VALUES (?, ?)", discount_id, name)
            elif discount_data.applicationType == 'specific_categories':
                for name in discount_data.selectedCategories: await cursor.execute("INSERT INTO discount_applicable_categories (discount_id, category_name) VALUES (?, ?)", discount_id, name)

            await conn.commit()
            return DiscountDetailOut(id=discount_id, **discount_data.model_dump())
    except Exception as e:
        await conn.rollback()
        if "UNIQUE" in str(e).upper(): raise HTTPException(status_code=409, detail=f"A discount with the name '{discount_data.discountName}' already exists.")
        raise HTTPException(status_code=500, detail=f"Database error on update: {e}")
    finally:
        conn.autocommit = True
        if conn: await conn.close()

@discounts_router.delete("/{discount_id}", status_code=status.HTTP_200_OK)
async def delete_discount(discount_id: int, token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager"])
    conn = await get_db_connection()
    try:
        conn.autocommit = False
        async with conn.cursor() as cursor:
            await cursor.execute("DELETE FROM discount_applicable_products WHERE discount_id=?", discount_id)
            await cursor.execute("DELETE FROM discount_applicable_categories WHERE discount_id=?", discount_id)
            await cursor.execute("DELETE FROM discounts WHERE id=?", discount_id)
            if cursor.rowcount == 0: raise HTTPException(status_code=404, detail="Discount not found")
            await conn.commit()
            return {"message": "Discount deleted successfully."}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error on delete: {e}")
    finally:
        conn.autocommit = True
        if conn: await conn.close()

# =============================================================================
# EXTERNAL DATA ENDPOINTS
# =============================================================================
@router.get("/available-products", response_model=List[dict], tags=["External Data"])
async def get_available_products_for_frontend(token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager", "staff", "cashier"])
    valid_products, _ = await get_external_choices(token=token)
    return [{"ProductName": name} for name in sorted(list(valid_products))]

@router.get("/available-categories", response_model=List[dict], tags=["External Data"])
async def get_available_categories_for_frontend(token: str = Depends(oauth2_scheme)):
    await validate_token_and_roles(token, allowed_roles=["admin", "manager", "staff", "cashier"])
    _, valid_categories = await get_external_choices(token=token)
    return [{"name": name} for name in sorted(list(valid_categories))]

# =============================================================================
# FINAL ROUTER SETUP
# =============================================================================
router.include_router(discounts_router)