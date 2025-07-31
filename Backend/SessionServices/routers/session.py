# FILE: routers/session.py

from fastapi import APIRouter, HTTPException, Depends, Form, status, Query
from fastapi.security import OAuth2PasswordBearer
from typing import List
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
router = APIRouter(prefix="/session", tags=["Cashier Sessions"])
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
            raise HTTPException(status_code=e.response.status_code, detail=f"Authentication service error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Authentication service is unavailable: {e}")

    user_data = response.json()
    user_role = user_data.get("userRole")

    if user_role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Access denied. Role '{user_role}' is not authorized for this action.")
    
    return user_data

# =============================================================================
# SESSION ENDPOINTS
# =============================================================================

@router.get('/status')
async def get_session_status(
    token: str = Depends(oauth2_scheme),
    cashier_name: str = Query(..., description="The name of the cashier to check the session status for.")
):
    """
    Checks if a specific cashier has an active session.
    """
    await validate_token_and_roles(token, allowed_roles=["manager", "admin", "cashier"])

    conn, cursor = None, None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()
        
        # --- THIS IS THE FIX ---
        # The query no longer checks the date, which was unreliable.
        # It now correctly finds the single 'Active' session for the cashier.
        await cursor.execute(
            """
            SELECT SessionID, InitialCash, SessionStart 
            FROM CashierSessions 
            WHERE CashierName = ? AND Status = 'Active'
            """,
            (cashier_name,)
        )
        active_session = await cursor.fetchone()

        if active_session:
            return {
                "hasActiveSession": True,
                "cashierName": cashier_name,
                "sessionId": active_session[0], # Corrected from sessionID to sessionId
                "initialCash": active_session[1],
                "sessionStart": active_session[2].isoformat()
            }
        else:
            return {"hasActiveSession": False, "cashierName": cashier_name}
            
    except Exception as e:
        print(f"Error in get_session_status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check cashier session status.")
    finally:
        if cursor: await cursor.close()
        if conn: await conn.close()


@router.post('/start', status_code=status.HTTP_201_CREATED)
async def start_session(
    initial_cash: float = Form(...),
    token: str = Depends(oauth2_scheme)
):
    """
    Starts a new cashier session for the currently authenticated user.
    """
    user_data = await validate_token_and_roles(token, allowed_roles=["cashier", "manager", "admin"])
    cashier_name = user_data.get("username")

    if not cashier_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username not found in authentication token.")
        
    if initial_cash < 0:
        raise HTTPException(status_code=400, detail="Initial cash amount cannot be negative.")

    conn, cursor = None, None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()

        # --- THIS IS THE FIX ---
        # Also simplified this query to prevent starting a second active session.
        await cursor.execute(
            "SELECT 1 FROM CashierSessions WHERE CashierName = ? AND Status = 'Active'",
            (cashier_name,)
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="An active session already exists for this cashier.")

        await cursor.execute(
            "INSERT INTO CashierSessions (CashierName, InitialCash) VALUES (?, ?)",
            (cashier_name, initial_cash)
        )
        await conn.commit()

        return {"message": f"Cashier session for '{cashier_name}' started successfully."}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to start cashier session.")
    finally:
        if cursor: await cursor.close()
        if conn: await conn.close()