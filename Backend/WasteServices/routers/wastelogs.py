from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import httpx
from database import get_db_connection
import logging

# Configure logging
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
router = APIRouter()

# Blockchain service URL
BLOCKCHAIN_SERVICE_URL = "http://127.0.0.1:9005/blockchain/log"

# Auth validation
async def validate_token_and_roles(token: str, allowed_roles: List[str]):
    USER_SERVICE_ME_URL = "http://127.0.0.1:4000/auth/users/me"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                USER_SERVICE_ME_URL, 
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            error_detail = f"Spillage Auth service error: {e.response.status_code}"
            try:
                error_detail += f" - {e.response.json().get('detail', e.response.text)}"
            except:
                error_detail += f" - {e.response.text}"
            logger.error(error_detail)
            raise HTTPException(
                status_code=e.response.status_code, 
                detail=error_detail
            )
        except httpx.RequestError as e:
            logger.error(f"Spillage Auth service unavailable: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Spillage Auth service unavailable: {e}"
            )

    user_data = response.json()
    user_role = user_data.get("userRole")
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required role not met. User has role: '{user_role}'"
        )
    return user_data

# Background task for blockchain logging
async def log_to_blockchain_background(
    token: str,
    action: str,
    entity_id: int,
    actor_username: str,
    change_description: str,
    data: dict
):
    """Background task to log spillage activity to blockchain"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            blockchain_payload = {
                "service_identifier": "WASTE_MANAGEMENT",
                "action": action,
                "entity_type": "Spillage",
                "entity_id": entity_id,
                "actor_username": actor_username,
                "change_description": change_description,
                "data": data
            }
            
            response = await client.post(
                BLOCKCHAIN_SERVICE_URL,
                json=blockchain_payload,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 201:
                logger.info(f"✅ Blockchain log successful for spillage {entity_id}: {action}")
            else:
                logger.warning(f"⚠️  Blockchain logging failed: {response.status_code} - {response.text}")
                
    except Exception as e:
        logger.error(f"❌ Blockchain logging error: {e}")

# Background task for inventory deduction
async def deduct_inventory_background(
    token: str,
    spillage_data: dict,
    spillage_id: int
):
    """Background task to deduct inventory after spillage is logged"""
    try:
        category_lower = spillage_data['category'].lower()
        is_merchandise = category_lower in ['merchandise', 'all items']
        
        spillage_item = {
            "product_name": spillage_data['product_name'],
            "category": spillage_data['category'],
            "quantity": spillage_data['quantity']
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if is_merchandise:
                logger.info(f"📦 Deducting merchandise for spillage {spillage_id}")
                response = await client.post(
                    "http://localhost:8002/merchandise/deduct-from-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"❌ Merchandise deduction failed: {response.status_code} - {response.text}")
                else:
                    logger.info(f"✅ Merchandise deducted for spillage {spillage_id}")
            else:
                # Deduct from ingredients
                logger.info(f"🥫 Deducting ingredients for spillage {spillage_id}")
                ing_response = await client.post(
                    "http://127.0.0.1:8002/ingredients/deduct-from-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if ing_response.status_code != 200:
                    logger.error(f"❌ Ingredients deduction failed: {ing_response.status_code}")
                else:
                    logger.info(f"✅ Ingredients deducted for spillage {spillage_id}")
                
                # Deduct from materials
                logger.info(f"🔧 Deducting materials for spillage {spillage_id}")
                mat_response = await client.post(
                    "http://localhost:8002/materials/deduct-from-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if mat_response.status_code != 200:
                    logger.error(f"❌ Materials deduction failed: {mat_response.status_code}")
                else:
                    logger.info(f"✅ Materials deducted for spillage {spillage_id}")
                    
    except Exception as e:
        logger.error(f"❌ Inventory deduction error for spillage {spillage_id}: {e}")

# Background task for inventory restock (on delete)
async def restock_inventory_background(
    token: str,
    spillage_data: dict,
    spillage_id: int
):
    """Background task to restock inventory when spillage is deleted"""
    try:
        category_lower = spillage_data['category'].lower()
        is_merchandise = category_lower in ['merchandise', 'all items']
        
        spillage_item = {
            "product_name": spillage_data['product_name'],
            "category": spillage_data['category'],
            "quantity": spillage_data['quantity']
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if is_merchandise:
                logger.info(f"📦 Restocking merchandise for deleted spillage {spillage_id}")
                response = await client.post(
                    "http://localhost:8002/merchandise/restock-from-deleted-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"❌ Merchandise restock failed: {response.status_code}")
                else:
                    logger.info(f"✅ Merchandise restocked for spillage {spillage_id}")
            else:
                # Restock ingredients
                logger.info(f"🥫 Restocking ingredients for deleted spillage {spillage_id}")
                ing_response = await client.post(
                    "http://127.0.0.1:8002/ingredients/restock-from-deleted-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if ing_response.status_code != 200:
                    logger.error(f"❌ Ingredients restock failed: {ing_response.status_code}")
                else:
                    logger.info(f"✅ Ingredients restocked for spillage {spillage_id}")
                
                # Restock materials
                logger.info(f"🔧 Restocking materials for deleted spillage {spillage_id}")
                mat_response = await client.post(
                    "http://localhost:8002/materials/restock-from-deleted-spillage",
                    json={"spillage_item": spillage_item},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if mat_response.status_code != 200:
                    logger.error(f"❌ Materials restock failed: {mat_response.status_code}")
                else:
                    logger.info(f"✅ Materials restocked for spillage {spillage_id}")
                    
    except Exception as e:
        logger.error(f"❌ Inventory restock error for spillage {spillage_id}: {e}")

# Background task for inventory adjustment (on edit)
async def adjust_inventory_background(
    token: str,
    old_spillage: dict,
    new_spillage: dict,
    spillage_id: int
):
    """Background task to adjust inventory when spillage is edited"""
    try:
        old_category = old_spillage['category'].lower()
        new_category = new_spillage['category'].lower()
        old_is_merch = old_category in ['merchandise', 'all items']
        new_is_merch = new_category in ['merchandise', 'all items']
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if old_is_merch:
                # Use merchandise restock-and-deduct endpoint
                logger.info(f"📦 Adjusting merchandise inventory for spillage {spillage_id}")
                response = await client.post(
                    "http://localhost:8002/merchandise/restock-and-deduct-spillage-edit",
                    json={
                        "old_spillage": old_spillage,
                        "new_spillage": new_spillage
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"❌ Merchandise adjustment failed: {response.status_code}")
                else:
                    logger.info(f"✅ Merchandise adjusted for spillage {spillage_id}")
            else:
                # Use ingredients and materials endpoints
                logger.info(f"🥫 Adjusting ingredients for spillage {spillage_id}")
                ing_response = await client.post(
                    "http://127.0.0.1:8002/ingredients/restock-and-deduct-spillage-edit",
                    json={
                        "old_spillage": old_spillage,
                        "new_spillage": new_spillage
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if ing_response.status_code != 200:
                    logger.error(f"❌ Ingredients adjustment failed: {ing_response.status_code}")
                else:
                    logger.info(f"✅ Ingredients adjusted for spillage {spillage_id}")
                
                logger.info(f"🔧 Adjusting materials for spillage {spillage_id}")
                mat_response = await client.post(
                    "http://localhost:8002/materials/restock-and-deduct-spillage-edit",
                    json={
                        "old_spillage": old_spillage,
                        "new_spillage": new_spillage
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if mat_response.status_code != 200:
                    logger.error(f"❌ Materials adjustment failed: {mat_response.status_code}")
                else:
                    logger.info(f"✅ Materials adjusted for spillage {spillage_id}")
                    
    except Exception as e:
        logger.error(f"❌ Inventory adjustment error for spillage {spillage_id}: {e}")

# Pydantic Models
class ProductSoldInfo(BaseModel):
    product_name: str
    category: str

class SpillageCreate(BaseModel):
    session_id: int
    spillage_date: date
    product_name: str
    category: str
    quantity: int
    reason: str
    logged_by: str

class SpillageOut(BaseModel):
    spillage_id: int
    session_id: int
    cashier_name: str
    spillage_date: date
    product_name: str
    category: str
    quantity: int
    reason: str
    logged_by: str
    logged_at: datetime
    is_deleted: bool
    session_start: Optional[datetime] = None
    session_end: Optional[datetime] = None

@router.get("/products-sold", response_model=List[ProductSoldInfo])
async def get_products_sold_by_session(
    session_id: int,
    token: str = Depends(oauth2_scheme)
):
    """Get all products sold during a specific cashier session"""
    await validate_token_and_roles(token, ["admin", "manager", "staff", "cashier"])  # ✅ Added "cashier" role
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get session details
            session_query = """
                SELECT CashierName, SessionStart, SessionEnd
                FROM CashierSessions
                WHERE SessionID = ?
            """
            await cursor.execute(session_query, (session_id,))
            session = await cursor.fetchone()
            
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session {session_id} not found"
                )
            
           
            query = """
                SELECT DISTINCT 
                    si.ItemName AS product_name,
                    si.Category AS category
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE s.SessionID = ?
                    AND s.Status = 'completed'
                ORDER BY si.Category, si.ItemName
            """
            
            await cursor.execute(query, (session_id,))
            rows = await cursor.fetchall()
            
            return [
                ProductSoldInfo(
                    product_name=row.product_name,
                    category=row.category
                ) for row in rows
            ]
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching products sold: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching products: {str(e)}"
        )
    finally:
        await conn.close()

# Endpoint to log spillage
@router.post("/", response_model=SpillageOut)
async def log_spillage(
    spillage: SpillageCreate,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Log a new spillage entry.
    Inventory deduction and blockchain logging happen in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager", "cashier"])
    
    if spillage.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get session details
            await cursor.execute(
                """SELECT CashierName, SessionStart, SessionEnd 
                   FROM CashierSessions WHERE SessionID = ?""",
                (spillage.session_id,)
            )
            session = await cursor.fetchone()
            
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session {spillage.session_id} not found"
                )
            
            # Verify product was sold during this session using SessionID
            verify_query = """
                SELECT COUNT(*) as count
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE si.ItemName = ?
                    AND si.Category = ?
                    AND s.SessionID = ?
                    AND s.Status = 'completed'
            """
            
            await cursor.execute(
                verify_query,
                (spillage.product_name, spillage.category, spillage.session_id)
            )
            row = await cursor.fetchone()
            
            if row.count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{spillage.product_name}' was not sold during session {spillage.session_id}"
                )
            
            # Insert spillage record
            insert_query = """
                INSERT INTO ProductSpillage 
                    (SessionID, SpillageDate, ProductName, Category, Quantity, Reason, LoggedBy, LoggedAt, isDeleted)
                OUTPUT INSERTED.SpillageID, INSERTED.SessionID, INSERTED.SpillageDate,
                       INSERTED.ProductName, INSERTED.Category, INSERTED.Quantity, 
                       INSERTED.Reason, INSERTED.LoggedBy, INSERTED.LoggedAt, INSERTED.isDeleted
                VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), 0)
            """
            
            await cursor.execute(
                insert_query,
                (
                    spillage.session_id,
                    spillage.spillage_date,
                    spillage.product_name,
                    spillage.category,
                    spillage.quantity,
                    spillage.reason,
                    spillage.logged_by
                )
            )
            
            result = await cursor.fetchone()
            await conn.commit()
            
            spillage_out = SpillageOut(
                spillage_id=result.SpillageID,
                session_id=result.SessionID,
                cashier_name=session.CashierName,
                spillage_date=result.SpillageDate,
                product_name=result.ProductName,
                category=result.Category,
                quantity=result.Quantity,
                reason=result.Reason,
                logged_by=result.LoggedBy,
                logged_at=result.LoggedAt,
                is_deleted=bool(result.isDeleted),
                session_start=session.SessionStart,
                session_end=session.SessionEnd
            )
            
            # Schedule inventory deduction in background
            spillage_data = {
                "product_name": spillage.product_name,
                "category": spillage.category,
                "quantity": spillage.quantity
            }
            background_tasks.add_task(
                deduct_inventory_background,
                token=token,
                spillage_data=spillage_data,
                spillage_id=result.SpillageID
            )
            
            # Schedule blockchain logging in background
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="CREATE",
                entity_id=result.SpillageID,
                actor_username=user_data.get("username", spillage.logged_by),
                change_description=f"New spillage: {spillage.quantity} units of {spillage.product_name}",
                data={
                    "spillage_id": result.SpillageID,
                    "session_id": spillage.session_id,
                    "cashier_name": session.CashierName,
                    "product_name": spillage.product_name,
                    "category": spillage.category,
                    "quantity": spillage.quantity,
                    "reason": spillage.reason
                }
            )
            
            return spillage_out
            
    except HTTPException:
        raise
    except Exception as e:
        await conn.rollback()
        logger.error(f"Error logging spillage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error logging spillage: {str(e)}"
        )
    finally:
        await conn.close()


@router.get("/", response_model=List[SpillageOut])
async def get_spillage_logs(
    start_date: Optional[date] = None, 
    end_date: Optional[date] = None,
    session_id: Optional[int] = None,
    token: str = Depends(oauth2_scheme)
):
    """Get all spillage records with optional filtering"""
    await validate_token_and_roles(token, ["admin", "manager", "cashier"])

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            query = """
                SELECT 
                    ps.SpillageID, ps.SessionID, ps.SpillageDate, ps.ProductName, 
                    ps.Category, ps.Quantity, ps.Reason, ps.LoggedBy, ps.LoggedAt, ps.isDeleted,
                    cs.CashierName, cs.SessionStart, cs.SessionEnd
                FROM ProductSpillage ps
                INNER JOIN CashierSessions cs ON ps.SessionID = cs.SessionID
            """
            
            conditions = ["ps.isDeleted = 0"]
            params = []
            
            if start_date:
                conditions.append("CAST(ps.SpillageDate AS DATE) >= ?")
                params.append(start_date)
            
            if end_date:
                conditions.append("CAST(ps.SpillageDate AS DATE) <= ?")
                params.append(end_date)
                
            if session_id:
                conditions.append("ps.SessionID = ?")
                params.append(session_id)
            
            query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY ps.LoggedAt DESC"
            
            await cursor.execute(query, tuple(params))
            rows = await cursor.fetchall()
            
            return [
                SpillageOut(
                    spillage_id=row.SpillageID,
                    session_id=row.SessionID,
                    cashier_name=row.CashierName,
                    spillage_date=row.SpillageDate,
                    product_name=row.ProductName,
                    category=row.Category,
                    quantity=row.Quantity,
                    reason=row.Reason,
                    logged_by=row.LoggedBy,
                    logged_at=row.LoggedAt,
                    is_deleted=bool(row.isDeleted),
                    session_start=row.SessionStart,
                    session_end=row.SessionEnd
                ) for row in rows
            ]

    except Exception as e:
        logger.error(f"Error fetching spillage logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching spillage records: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.delete("/{spillage_id}")
async def delete_spillage(
    spillage_id: int,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Soft delete a spillage record.
    Inventory restock and blockchain logging happen in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get record details
            await cursor.execute(
                """SELECT ps.SpillageID, ps.SessionID, ps.SpillageDate, ps.ProductName, ps.Category, 
                          ps.Quantity, ps.Reason, ps.LoggedBy, ps.isDeleted, cs.CashierName
                   FROM ProductSpillage ps
                   INNER JOIN CashierSessions cs ON ps.SessionID = cs.SessionID
                   WHERE ps.SpillageID = ?""",
                (spillage_id,)
            )
            
            record = await cursor.fetchone()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record {spillage_id} not found"
                )
            
            if record.isDeleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Spillage record {spillage_id} is already deleted"
                )
            
            # Soft delete the record
            await cursor.execute(
                "UPDATE ProductSpillage SET isDeleted = 1 WHERE SpillageID = ?",
                (spillage_id,)
            )
            await conn.commit()
            
            # Schedule inventory restock in background
            spillage_data = {
                "product_name": record.ProductName,
                "category": record.Category,
                "quantity": record.Quantity
            }
            background_tasks.add_task(
                restock_inventory_background,
                token=token,
                spillage_data=spillage_data,
                spillage_id=spillage_id
            )
            
            # Schedule blockchain logging in background
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="DELETE",
                entity_id=spillage_id,
                actor_username=user_data.get("username", "system"),
                change_description=f"Deleted spillage: {record.ProductName} ({record.Quantity} units)",
                data={
                    "spillage_id": spillage_id,
                    "product_name": record.ProductName,
                    "quantity": record.Quantity
                }
            )
            
            return {"message": f"Spillage record {spillage_id} deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        await conn.rollback()
        logger.error(f"Error deleting spillage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting spillage: {str(e)}"
        )
    finally:
        await conn.close()

#edit log spillage
@router.put("/{spillage_id}", response_model=SpillageOut)
async def update_spillage(
    spillage_id: int,
    spillage: SpillageCreate,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Update a spillage record.
    Inventory adjustment and blockchain logging happen in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager"])
    
    if spillage.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get old record
            await cursor.execute(
                """SELECT ps.SpillageID, ps.SessionID, ps.SpillageDate, ps.ProductName, ps.Category, 
                          ps.Quantity, ps.Reason, ps.LoggedBy, ps.isDeleted, cs.CashierName
                   FROM ProductSpillage ps
                   INNER JOIN CashierSessions cs ON ps.SessionID = cs.SessionID
                   WHERE ps.SpillageID = ?""",
                (spillage_id,)
            )
            
            old_record = await cursor.fetchone()
            if not old_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record {spillage_id} not found"
                )
            
            if old_record.isDeleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot update deleted spillage record"
                )
            
            # Get new session details
            await cursor.execute(
                """SELECT CashierName, SessionStart, SessionEnd 
                   FROM CashierSessions WHERE SessionID = ?""",
                (spillage.session_id,)
            )
            new_session = await cursor.fetchone()
            
            if not new_session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session {spillage.session_id} not found"
                )
            
            # ✅ FIXED: Verify product was sold using SessionID
            verify_query = """
                SELECT COUNT(*) as count
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE si.ItemName = ?
                    AND si.Category = ?
                    AND s.SessionID = ?
                    AND s.Status = 'completed'
            """
            
            await cursor.execute(
                verify_query,
                (spillage.product_name, spillage.category, spillage.session_id)
            )
            row = await cursor.fetchone()
            
            if row.count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{spillage.product_name}' was not sold during session {spillage.session_id}"
                )
            
            # Update the record
            update_query = """
                UPDATE ProductSpillage
                SET SessionID = ?, SpillageDate = ?, ProductName = ?,
                    Category = ?, Quantity = ?, Reason = ?, LoggedBy = ?
                WHERE SpillageID = ?
            """
            
            await cursor.execute(
                update_query,
                (
                    spillage.session_id, spillage.spillage_date,
                    spillage.product_name, spillage.category,
                    spillage.quantity, spillage.reason,
                    spillage.logged_by, spillage_id
                )
            )
            
            await conn.commit()
            
            # Fetch updated record
            select_query = """
                SELECT ps.SpillageID, ps.SessionID, ps.SpillageDate, ps.ProductName,
                       ps.Category, ps.Quantity, ps.Reason, ps.LoggedBy, ps.LoggedAt, ps.isDeleted,
                       cs.CashierName, cs.SessionStart, cs.SessionEnd
                FROM ProductSpillage ps
                INNER JOIN CashierSessions cs ON ps.SessionID = cs.SessionID
                WHERE ps.SpillageID = ?
            """
            
            await cursor.execute(select_query, (spillage_id,))
            result = await cursor.fetchone()
            
            # Schedule inventory adjustment in background
            old_spillage_data = {
                "product_name": old_record.ProductName,
                "category": old_record.Category,
                "quantity": old_record.Quantity
            }
            new_spillage_data = {
                "product_name": spillage.product_name,
                "category": spillage.category,
                "quantity": spillage.quantity
            }
            
            background_tasks.add_task(
                adjust_inventory_background,
                token=token,
                old_spillage=old_spillage_data,
                new_spillage=new_spillage_data,
                spillage_id=spillage_id
            )
            
            # Build change description
            changes = []
            if old_record.ProductName != spillage.product_name:
                changes.append(f"Product: {old_record.ProductName} → {spillage.product_name}")
            if old_record.Quantity != spillage.quantity:
                changes.append(f"Quantity: {old_record.Quantity} → {spillage.quantity}")
            
            change_desc = "Updated: " + ", ".join(changes) if changes else "Spillage updated"
            
            # Schedule blockchain logging in background
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="UPDATE",
                entity_id=spillage_id,
                actor_username=user_data.get("username", spillage.logged_by),
                change_description=change_desc,
                data={
                    "spillage_id": spillage_id,
                    "old_data": old_spillage_data,
                    "new_data": new_spillage_data
                }
            )
            
            return SpillageOut(
                spillage_id=result.SpillageID,
                session_id=result.SessionID,
                cashier_name=result.CashierName,
                spillage_date=result.SpillageDate,
                product_name=result.ProductName,
                category=result.Category,
                quantity=result.Quantity,
                reason=result.Reason,
                logged_by=result.LoggedBy,
                logged_at=result.LoggedAt,
                is_deleted=bool(result.isDeleted),
                session_start=result.SessionStart,
                session_end=result.SessionEnd
            )
            
    except HTTPException:
        raise
    except Exception as e:
        await conn.rollback()
        logger.error(f"Error updating spillage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating spillage: {str(e)}"
        )
    finally:
        await conn.close()

@router.get("/sessions/active")
async def get_active_sessions(token: str = Depends(oauth2_scheme)):
    """Get all active cashier sessions for the spillage form dropdown"""
    await validate_token_and_roles(token, ["admin", "manager", "cashier"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            query = """
                SELECT SessionID, CashierName, SessionStart, SessionEnd
                FROM CashierSessions
                WHERE Status = 'Active'
                ORDER BY SessionStart DESC
            """
            
            await cursor.execute(query)
            rows = await cursor.fetchall()
            
            return [
                {
                    "session_id": row.SessionID,
                    "cashier_name": row.CashierName,
                    "session_start": row.SessionStart,
                    "session_end": row.SessionEnd
                } for row in rows
            ]
            
    except Exception as e:
        logger.error(f"Error fetching active sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching sessions: {str(e)}"
        )
    finally:
        await conn.close()