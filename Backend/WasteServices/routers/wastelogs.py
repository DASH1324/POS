from fastapi import APIRouter, Depends, HTTPException, status
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
    logged_by: str  # Full employee name from frontend

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
    is_deleted: bool  # Added field

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
            # Query to get distinct products sold by the cashier on the specified date
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
            
            result = []
            for row in rows:
                result.append({
                    "product_name": row.product_name,
                    "category": row.category
                })
            
            return result
            
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
    token: str = Depends(oauth2_scheme)
):
    """
    Log a new product spillage/waste entry.
    """
    await validate_token_and_roles(token, ["admin", "manager", "cashier"])
    
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
            
            # Insert spillage record with isDeleted defaulting to 0
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
            # Start with the base query - include isDeleted
            query = """
                SELECT 
                    SpillageID, CashierName, SpillageDate, ProductName, 
                    Category, Quantity, Reason, LoggedBy, LoggedAt, isDeleted
                FROM ProductSpillage
            """
            
            # Dynamically build the WHERE clause for all filters
            conditions = []
            params = []
            
            # Always exclude deleted records
            conditions.append("isDeleted = 0")
            
            if start_date:
                conditions.append("CAST(SpillageDate AS DATE) >= ?")
                params.append(start_date)
            
            if end_date:
                conditions.append("CAST(SpillageDate AS DATE) <= ?")
                params.append(end_date)
                
            if cashier_name:
                conditions.append("CashierName = ?")
                params.append(cashier_name)
            
            if conditions:
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
    token: str = Depends(oauth2_scheme)
):
    """
    Soft delete a spillage record by setting isDeleted = 1 (admin/manager only).
    """
    await validate_token_and_roles(token, ["admin", "manager"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Check if record exists and is not already deleted
            await cursor.execute(
                "SELECT SpillageID, isDeleted FROM ProductSpillage WHERE SpillageID = ?",
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
            
            # Soft delete the record by setting isDeleted = 1
            await cursor.execute(
                "UPDATE ProductSpillage SET isDeleted = 1 WHERE SpillageID = ?",
                (spillage_id,)
            )
            await conn.commit()
            
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
    token: str = Depends(oauth2_scheme)
):
    """
    Restore a soft-deleted spillage record by setting isDeleted = 0 (admin/manager only).
    """
    await validate_token_and_roles(token, ["admin", "manager"])
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Check if record exists and is deleted
            await cursor.execute(
                "SELECT SpillageID, isDeleted FROM ProductSpillage WHERE SpillageID = ?",
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
            
            # Restore the record by setting isDeleted = 0
            await cursor.execute(
                "UPDATE ProductSpillage SET isDeleted = 0 WHERE SpillageID = ?",
                (spillage_id,)
            )
            await conn.commit()
            
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
    token: str = Depends(oauth2_scheme)
):
    """
    Update an existing spillage record (admin/manager only).
    Only non-deleted records can be updated.
    """
    await validate_token_and_roles(token, ["admin", "manager"])
    
    # Validate quantity
    if spillage.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Check if spillage record exists and is not deleted
            check_query = "SELECT SpillageID, isDeleted FROM ProductSpillage WHERE SpillageID = ?"
            await cursor.execute(check_query, (spillage_id,))
            
            record = await cursor.fetchone()
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Spillage record with ID {spillage_id} not found"
                )
            
            if record.isDeleted:
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