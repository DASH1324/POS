from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import Optional, List
import httpx

# --- Database Connection Import ---
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# =============================================================================
# CONFIGURATION
# =============================================================================
AUTH_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# =============================================================================
# ROUTER SETUP & OAUTH2 SCHEME
# =============================================================================
router = APIRouter(prefix="/receipt", tags=["Receipt Configuration"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:4000/auth/token")

# =============================================================================
# AUTHORIZATION HELPER
# =============================================================================
async def validate_token_and_roles(token: str, allowed_roles: List[str]):
    """
    Validates the bearer token against the auth service and checks user role.
    """
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(AUTH_SERVICE_ME_URL, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Authentication service error: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Authentication service is unavailable: {e}"
            )

    user_data = response.json()
    user_role = user_data.get("userRole")

    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Role '{user_role}' is not authorized for this action."
        )
    
    return user_data

# =============================================================================
# PYDANTIC MODELS
# =============================================================================
class ReceiptConfigCreate(BaseModel):
    storeName: str = Field(..., max_length=255)
    address1: str = Field(..., max_length=255)
    address2: str = Field(..., max_length=255)
    telephone: str = Field(..., max_length=50)
    showQR: bool = True
    qrType: Optional[str] = Field(None, max_length=20)  # 'link' or 'image'
    qrLink: Optional[str] = Field(None, max_length=500)
    qrImagePath: Optional[str] = Field(None)
    qrText: Optional[str] = Field(None, max_length=255)
    additionalText: Optional[str] = Field(None, max_length=1000)

class ReceiptConfigUpdate(BaseModel):
    storeName: Optional[str] = Field(None, max_length=255)
    address1: Optional[str] = Field(None, max_length=255)
    address2: Optional[str] = Field(None, max_length=255)
    telephone: Optional[str] = Field(None, max_length=50)
    showQR: Optional[bool] = None
    qrType: Optional[str] = Field(None, max_length=20)
    qrLink: Optional[str] = Field(None, max_length=500)
    qrImagePath: Optional[str] = Field(None)
    qrText: Optional[str] = Field(None, max_length=255)
    additionalText: Optional[str] = Field(None, max_length=1000)

class ReceiptConfigOut(BaseModel):
    configID: int
    storeName: str
    address1: str
    address2: str
    telephone: str
    showQR: bool
    qrType: Optional[str]
    qrLink: Optional[str]
    qrImagePath: Optional[str]
    qrText: Optional[str]
    additionalText: Optional[str]
    createdAt: str
    updatedAt: Optional[str]

# =============================================================================
# RECEIPT CONFIGURATION ENDPOINTS
# =============================================================================

@router.post("/", response_model=ReceiptConfigOut, status_code=status.HTTP_201_CREATED)
async def create_receipt_config(
    config_data: ReceiptConfigCreate,
    token: str = Depends(oauth2_scheme)
):
    """
    Create a new receipt configuration.
    Only one active configuration is allowed at a time.
    """
    await validate_token_and_roles(token, allowed_roles=["admin", "manager"])
    
    conn, cursor = None, None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()
        
        # Check if a configuration already exists
        await cursor.execute("SELECT COUNT(*) FROM ReceiptConfig")
        count_row = await cursor.fetchone()
        
        if count_row and count_row[0] > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A receipt configuration already exists. Use PUT to update it."
            )
        
        # Insert new configuration
        sql_insert = """
            INSERT INTO ReceiptConfig 
            (StoreName, Address1, Address2, Telephone, ShowQR, QRType, QRLink, QRImagePath, QRText, AdditionalText)
            OUTPUT INSERTED.ConfigID, INSERTED.CreatedAt
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        await cursor.execute(
            sql_insert,
            config_data.storeName,
            config_data.address1,
            config_data.address2,
            config_data.telephone,
            config_data.showQR,
            config_data.qrType,
            config_data.qrLink,
            config_data.qrImagePath,
            config_data.qrText,
            config_data.additionalText
        )
        
        result = await cursor.fetchone()
        new_id, created_at = result[0], result[1]
        
        await conn.commit()
        
        return ReceiptConfigOut(
            configID=new_id,
            storeName=config_data.storeName,
            address1=config_data.address1,
            address2=config_data.address2,
            telephone=config_data.telephone,
            showQR=config_data.showQR,
            qrType=config_data.qrType,
            qrLink=config_data.qrLink,
            qrImagePath=config_data.qrImagePath,
            qrText=config_data.qrText,
            additionalText=config_data.additionalText,
            createdAt=created_at.isoformat(),
            updatedAt=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating receipt config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create receipt configuration: {str(e)}"
        )
    finally:
        if cursor:
            await cursor.close()
        if conn:
            await conn.close()


@router.get("/", response_model=ReceiptConfigOut)
async def get_receipt_config(token: str = Depends(oauth2_scheme)):
    """
    Get the current receipt configuration.
    """
    await validate_token_and_roles(token, allowed_roles=["admin", "manager", "cashier"])
    
    conn, cursor = None, None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()
        
        await cursor.execute("""
            SELECT ConfigID, StoreName, Address1, Address2, Telephone, 
                   ShowQR, QRType, QRLink, QRImagePath, QRText, AdditionalText,
                   CreatedAt, UpdatedAt
            FROM ReceiptConfig
        """)
        
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No receipt configuration found. Please create one first."
            )
        
        return ReceiptConfigOut(
            configID=row[0],
            storeName=row[1],
            address1=row[2],
            address2=row[3],
            telephone=row[4],
            showQR=row[5],
            qrType=row[6],
            qrLink=row[7],
            qrImagePath=row[8],
            qrText=row[9],
            additionalText=row[10],
            createdAt=row[11].isoformat() if row[11] else None,
            updatedAt=row[12].isoformat() if row[12] else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting receipt config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve receipt configuration: {str(e)}"
        )
    finally:
        if cursor:
            await cursor.close()
        if conn:
            await conn.close()


@router.put("/", response_model=ReceiptConfigOut)
async def update_receipt_config(
    config_data: ReceiptConfigUpdate,
    token: str = Depends(oauth2_scheme)
):
    """
    Update the existing receipt configuration.
    """
    await validate_token_and_roles(token, allowed_roles=["admin", "manager"])
    
    conn, cursor = None, None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()
        
        # Get current config
        await cursor.execute("SELECT ConfigID FROM ReceiptConfig")
        config_row = await cursor.fetchone()
        
        if not config_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No receipt configuration found. Create one first using POST."
            )
        
        config_id = config_row[0]
        
        # Build dynamic update query
        update_fields = []
        update_values = []
        
        if config_data.storeName is not None:
            update_fields.append("StoreName = ?")
            update_values.append(config_data.storeName)
        
        if config_data.address1 is not None:
            update_fields.append("Address1 = ?")
            update_values.append(config_data.address1)
        
        if config_data.address2 is not None:
            update_fields.append("Address2 = ?")
            update_values.append(config_data.address2)
        
        if config_data.telephone is not None:
            update_fields.append("Telephone = ?")
            update_values.append(config_data.telephone)
        
        if config_data.showQR is not None:
            update_fields.append("ShowQR = ?")
            update_values.append(config_data.showQR)
        
        if config_data.qrType is not None:
            update_fields.append("QRType = ?")
            update_values.append(config_data.qrType)
        
        if config_data.qrLink is not None:
            update_fields.append("QRLink = ?")
            update_values.append(config_data.qrLink)
        
        if config_data.qrImagePath is not None:
            update_fields.append("QRImagePath = ?")
            update_values.append(config_data.qrImagePath)
        
        if config_data.qrText is not None:
            update_fields.append("QRText = ?")
            update_values.append(config_data.qrText)
        
        if config_data.additionalText is not None:
            update_fields.append("AdditionalText = ?")
            update_values.append(config_data.additionalText)
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update."
            )
        
        # Add UpdatedAt
        update_fields.append("UpdatedAt = GETDATE()")
        update_values.append(config_id)
        
        sql_update = f"""
            UPDATE ReceiptConfig
            SET {', '.join(update_fields)}
            WHERE ConfigID = ?
        """
        
        await cursor.execute(sql_update, *update_values)
        await conn.commit()
        
        # Fetch updated config
        await cursor.execute("""
            SELECT ConfigID, StoreName, Address1, Address2, Telephone, 
                   ShowQR, QRType, QRLink, QRImagePath, QRText, AdditionalText,
                   CreatedAt, UpdatedAt
            FROM ReceiptConfig
            WHERE ConfigID = ?
        """, config_id)
        
        row = await cursor.fetchone()
        
        return ReceiptConfigOut(
            configID=row[0],
            storeName=row[1],
            address1=row[2],
            address2=row[3],
            telephone=row[4],
            showQR=row[5],
            qrType=row[6],
            qrLink=row[7],
            qrImagePath=row[8],
            qrText=row[9],
            additionalText=row[10],
            createdAt=row[11].isoformat() if row[11] else None,
            updatedAt=row[12].isoformat() if row[12] else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating receipt config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update receipt configuration: {str(e)}"
        )
    finally:
        if cursor:
            await cursor.close()
        if conn:
            await conn.close()