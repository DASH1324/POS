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
    """
    Background task to log spillage activity to blockchain
    Runs asynchronously without blocking the main response
    """
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
        # Log error but don't fail - this is a background task
        logger.error(f"❌ Blockchain logging error in background task: {e}")

# Pydantic Models
class ProductSoldInfo(BaseModel):
    product_name: str
    category: str

class SpillageCreate(BaseModel):
    cashier_name: str
    spillage_date: date
    product_name: str
    category: str
    quantity: int
    reason: str
    logged_by: str

class SpillageOut(BaseModel):
    spillage_id: int
    cashier_name: str
    spillage_date: date
    product_name: str
    category: str
    quantity: int
    reason: str
    logged_by: str
    logged_at: datetime
    is_deleted: bool

# API Endpoints

@router.get("/products-sold", response_model=List[ProductSoldInfo])
async def get_products_sold_by_cashier_and_date(
    spillage_date: date,
    cashier_name: str,
    token: str = Depends(oauth2_scheme)
):
    """
    Get all products (with their categories) that were sold by a specific cashier on a specific date.
    This endpoint is used to populate the product dropdown based on the selected date and cashier.
    """
    await validate_token_and_roles(token, ["admin", "manager", "staff"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            query = """
                SELECT DISTINCT 
                    si.ItemName AS product_name,
                    si.Category AS category
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE CAST(s.CreatedAt AS DATE) = ?
                    AND s.CashierName = ?
                ORDER BY si.Category, si.ItemName
            """
            
            await cursor.execute(query, (spillage_date, cashier_name))
            rows = await cursor.fetchall()
            
            return [
                ProductSoldInfo(
                    product_name=row.product_name,
                    category=row.category
                ) for row in rows
            ]
            
    except Exception as e:
        logger.error(f"Error fetching products sold on date by cashier: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching products: {str(e)}"
        )
    finally:
        await conn.close()


@router.post("/", response_model=SpillageOut)
async def log_spillage(
    spillage: SpillageCreate,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Log a new product spillage/waste entry.
    Blockchain logging happens in background for optimal performance.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager", "cashier"])
    
    # Validate quantity
    if spillage.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Verify that the product was actually sold by this cashier on that date
            verify_query = """
                SELECT COUNT(*) as count
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE si.ItemName = ?
                    AND si.Category = ?
                    AND s.CashierName = ?
                    AND CAST(s.CreatedAt AS DATE) = ?
            """
            
            await cursor.execute(
                verify_query,
                (spillage.product_name, spillage.category, spillage.cashier_name, spillage.spillage_date)
            )
            row = await cursor.fetchone()
            
            if row.count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{spillage.product_name}' was not sold by cashier '{spillage.cashier_name}' on {spillage.spillage_date}"
                )
            
            # Insert spillage record
            insert_query = """
                INSERT INTO ProductSpillage 
                    (CashierName, SpillageDate, ProductName, Category, Quantity, Reason, LoggedBy, LoggedAt, isDeleted)
                OUTPUT INSERTED.SpillageID, INSERTED.CashierName, INSERTED.SpillageDate,
                       INSERTED.ProductName, INSERTED.Category, INSERTED.Quantity, 
                       INSERTED.Reason, INSERTED.LoggedBy, INSERTED.LoggedAt, INSERTED.isDeleted
                VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), 0)
            """
            
            await cursor.execute(
                insert_query,
                (
                    spillage.cashier_name,
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
                cashier_name=result.CashierName,
                spillage_date=result.SpillageDate,
                product_name=result.ProductName,
                category=result.Category,
                quantity=result.Quantity,
                reason=result.Reason,
                logged_by=result.LoggedBy,
                logged_at=result.LoggedAt,
                is_deleted=bool(result.isDeleted)
            )
            
            # Schedule blockchain logging as background task
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="CREATE",
                entity_id=result.SpillageID,
                actor_username=user_data.get("username", spillage.logged_by),
                change_description=f"New spillage logged: {spillage.quantity} units of {spillage.product_name} - Reason: {spillage.reason}",
                data={
                    "spillage_id": result.SpillageID,
                    "cashier_name": spillage.cashier_name,
                    "spillage_date": str(spillage.spillage_date),
                    "product_name": spillage.product_name,
                    "category": spillage.category,
                    "quantity": spillage.quantity,
                    "reason": spillage.reason,
                    "logged_by": spillage.logged_by
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
    cashier_name: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """
    Get all spillage records with optional filtering by date range and/or cashier name.
    Only returns non-deleted records (isDeleted = 0).
    """
    await validate_token_and_roles(token, ["admin", "manager", "cashier"])

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            query = """
                SELECT 
                    SpillageID, CashierName, SpillageDate, ProductName, 
                    Category, Quantity, Reason, LoggedBy, LoggedAt, isDeleted
                FROM ProductSpillage
            """
            
            conditions = ["isDeleted = 0"]
            params = []
            
            if start_date:
                conditions.append("CAST(SpillageDate AS DATE) >= ?")
                params.append(start_date)
            
            if end_date:
                conditions.append("CAST(SpillageDate AS DATE) <= ?")
                params.append(end_date)
                
            if cashier_name:
                conditions.append("CashierName = ?")
                params.append(cashier_name)
            
            query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY LoggedAt DESC"
            
            await cursor.execute(query, tuple(params))
            rows = await cursor.fetchall()
            
            return [
                SpillageOut(
                    spillage_id=row.SpillageID,
                    cashier_name=row.CashierName,
                    spillage_date=row.SpillageDate,
                    product_name=row.ProductName,
                    category=row.Category,
                    quantity=row.Quantity,
                    reason=row.Reason,
                    logged_by=row.LoggedBy,
                    logged_at=row.LoggedAt,
                    is_deleted=bool(row.isDeleted)
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
    Soft delete a spillage record by setting isDeleted = 1 (admin/manager only).
    Blockchain logging happens in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get full record details before deletion
            await cursor.execute(
                """SELECT SpillageID, CashierName, SpillageDate, ProductName, Category, 
                          Quantity, Reason, LoggedBy, isDeleted 
                   FROM ProductSpillage WHERE SpillageID = ?""",
                (spillage_id,)
            )
            
            record = await cursor.fetchone()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record with ID {spillage_id} not found"
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
            
            # Schedule blockchain logging as background task
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="DELETE",
                entity_id=spillage_id,
                actor_username=user_data.get("username", "system"),
                change_description=f"Spillage record deleted: {record.ProductName} ({record.Quantity} units)",
                data={
                    "spillage_id": spillage_id,
                    "cashier_name": record.CashierName,
                    "spillage_date": str(record.SpillageDate),
                    "product_name": record.ProductName,
                    "category": record.Category,
                    "quantity": record.Quantity,
                    "reason": record.Reason,
                    "logged_by": record.LoggedBy,
                    "action": "soft_delete"
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


@router.put("/{spillage_id}/restore")
async def restore_spillage(
    spillage_id: int,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Restore a soft-deleted spillage record by setting isDeleted = 0 (admin/manager only).
    Blockchain logging happens in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get full record details
            await cursor.execute(
                """SELECT SpillageID, CashierName, SpillageDate, ProductName, Category, 
                          Quantity, Reason, LoggedBy, isDeleted 
                   FROM ProductSpillage WHERE SpillageID = ?""",
                (spillage_id,)
            )
            
            record = await cursor.fetchone()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record with ID {spillage_id} not found"
                )
            
            if not record.isDeleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Spillage record {spillage_id} is not deleted"
                )
            
            # Restore the record
            await cursor.execute(
                "UPDATE ProductSpillage SET isDeleted = 0 WHERE SpillageID = ?",
                (spillage_id,)
            )
            await conn.commit()
            
            # Schedule blockchain logging as background task
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="UPDATE",
                entity_id=spillage_id,
                actor_username=user_data.get("username", "system"),
                change_description=f"Spillage record restored: {record.ProductName} ({record.Quantity} units)",
                data={
                    "spillage_id": spillage_id,
                    "cashier_name": record.CashierName,
                    "spillage_date": str(record.SpillageDate),
                    "product_name": record.ProductName,
                    "category": record.Category,
                    "quantity": record.Quantity,
                    "reason": record.Reason,
                    "logged_by": record.LoggedBy,
                    "action": "restore"
                }
            )
            
            return {"message": f"Spillage record {spillage_id} restored successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        await conn.rollback()
        logger.error(f"Error restoring spillage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error restoring spillage: {str(e)}"
        )
    finally:
        await conn.close()


@router.put("/{spillage_id}", response_model=SpillageOut)
async def update_spillage(
    spillage_id: int,
    spillage: SpillageCreate,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """
    Update an existing spillage record (admin/manager only).
    Only non-deleted records can be updated.
    Blockchain logging happens in background.
    """
    user_data = await validate_token_and_roles(token, ["admin", "manager"])
    
    # Validate quantity
    if spillage.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Get old record for comparison
            await cursor.execute(
                """SELECT SpillageID, CashierName, SpillageDate, ProductName, Category, 
                          Quantity, Reason, LoggedBy, isDeleted 
                   FROM ProductSpillage WHERE SpillageID = ?""",
                (spillage_id,)
            )
            
            old_record = await cursor.fetchone()
            if not old_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record with ID {spillage_id} not found"
                )
            
            if old_record.isDeleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot update deleted spillage record. Please restore it first."
                )
            
            # Verify that the product was actually sold by this cashier on that date
            verify_query = """
                SELECT COUNT(*) as count
                FROM SaleItems si
                INNER JOIN Sales s ON si.SaleID = s.SaleID
                WHERE si.ItemName = ?
                    AND si.Category = ?
                    AND s.CashierName = ?
                    AND CAST(s.CreatedAt AS DATE) = ?
            """
            
            await cursor.execute(
                verify_query,
                (spillage.product_name, spillage.category, spillage.cashier_name, spillage.spillage_date)
            )
            row = await cursor.fetchone()
            
            if row.count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{spillage.product_name}' was not sold by cashier '{spillage.cashier_name}' on {spillage.spillage_date}"
                )
            
            # Update the spillage record
            update_query = """
                UPDATE ProductSpillage
                SET CashierName = ?,
                    SpillageDate = ?,
                    ProductName = ?,
                    Category = ?,
                    Quantity = ?,
                    Reason = ?,
                    LoggedBy = ?
                WHERE SpillageID = ?
            """
            
            await cursor.execute(
                update_query,
                (
                    spillage.cashier_name,
                    spillage.spillage_date,
                    spillage.product_name,
                    spillage.category,
                    spillage.quantity,
                    spillage.reason,
                    spillage.logged_by,
                    spillage_id
                )
            )
            
            await conn.commit()
            
            # Fetch the updated record
            select_query = """
                SELECT SpillageID, CashierName, SpillageDate, ProductName,
                       Category, Quantity, Reason, LoggedBy, LoggedAt, isDeleted
                FROM ProductSpillage
                WHERE SpillageID = ?
            """
            
            await cursor.execute(select_query, (spillage_id,))
            result = await cursor.fetchone()
            
            # Build change description
            changes = []
            if old_record.ProductName != spillage.product_name:
                changes.append(f"Product: {old_record.ProductName} → {spillage.product_name}")
            if old_record.Quantity != spillage.quantity:
                changes.append(f"Quantity: {old_record.Quantity} → {spillage.quantity}")
            if old_record.Reason != spillage.reason:
                changes.append(f"Reason updated")
            
            change_desc = "Updated spillage: " + ", ".join(changes) if changes else "Spillage record updated"
            
            # Schedule blockchain logging as background task
            background_tasks.add_task(
                log_to_blockchain_background,
                token=token,
                action="UPDATE",
                entity_id=spillage_id,
                actor_username=user_data.get("username", spillage.logged_by),
                change_description=change_desc,
                data={
                    "spillage_id": spillage_id,
                    "old_data": {
                        "product_name": old_record.ProductName,
                        "quantity": old_record.Quantity,
                        "reason": old_record.Reason
                    },
                    "new_data": {
                        "cashier_name": spillage.cashier_name,
                        "spillage_date": str(spillage.spillage_date),
                        "product_name": spillage.product_name,
                        "category": spillage.category,
                        "quantity": spillage.quantity,
                        "reason": spillage.reason,
                        "logged_by": spillage.logged_by
                    }
                }
            )
            
            return SpillageOut(
                spillage_id=result.SpillageID,
                cashier_name=result.CashierName,
                spillage_date=result.SpillageDate,
                product_name=result.ProductName,
                category=result.Category,
                quantity=result.Quantity,
                reason=result.Reason,
                logged_by=result.LoggedBy,
                logged_at=result.LoggedAt,
                is_deleted=bool(result.isDeleted)
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