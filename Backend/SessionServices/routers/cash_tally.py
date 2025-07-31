# FILE: cash_tally.py

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict
from decimal import Decimal
import sys
import os
import httpx
import logging

# --- Configure logging & DB connection ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

# --- Auth Configuration ---
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# --- Define the new router ---
router_cash_tally = APIRouter(
    prefix="/auth/cash_tally",
    tags=["Cash Tally"]
)

# --- Authorization Helper ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Invalid token: {e.response.text}", headers={"WWW-Authenticate": "Bearer"})
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service unavailable.")

# --- Pydantic Models ---
class CloseSessionRequest(BaseModel):
    sessionId: int
    cashCounts: Dict[str, int]

# --- API Endpoint to Close a Cashier Session ---
@router_cash_tally.post(
    "/close_session",
    summary="Close out a cashier's session after a cash count"
)
async def close_session(
    request: CloseSessionRequest,
    current_user: dict = Depends(get_current_active_user)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    conn = None
    try:
        conn = await get_db_connection()
        async with conn.cursor() as cursor:
            # Step 1: Get the current active session details
            await cursor.execute(
                "SELECT SessionID, CashierName, InitialCash, Status, SessionStart FROM CashierSessions WHERE SessionID = ? AND Status = 'Active'",
                request.sessionId
            )
            session_row = await cursor.fetchone()

            if not session_row:
                raise HTTPException(status_code=404, detail="No active session found with the provided ID.")

            initial_cash = Decimal(session_row.InitialCash)
            session_start_time = session_row.SessionStart

            # Step 2: Calculate the cash sales made ONLY during this specific session
            # --- THIS IS THE FIX ---
            # The query now only includes sales that were created AFTER the session started.
            # This correctly isolates the sales for the current active session from any previous
            # sessions that might have occurred on the same day.
            await cursor.execute(
                """
                SELECT ISNULL(SUM(si.UnitPrice * si.Quantity), 0)
                FROM Sales s
                JOIN SaleItems si ON s.SaleID = si.SaleID
                WHERE s.CashierName = ?
                  AND s.PaymentMethod = 'Cash'
                  AND s.Status = 'completed'
                  AND s.CreatedAt >= ?;
                """,
                session_row.CashierName, session_start_time
            )
            cash_sales_row = await cursor.fetchone()
            cash_sales_at_close = Decimal(cash_sales_row[0])

            # Step 3: Calculate the total cash counted by the cashier from the request
            denominations = {
                'bills1000': 1000, 'bills500': 500, 'bills200': 200, 'bills100': 100,
                'bills50': 50, 'bills20': 20, 'coins10': 10, 'coins5': 5, 'coins1': 1,
                'cents25': 0.25, 'cents10': 0.10, 'cents05': 0.05
            }
            closing_cash = Decimal(0)
            for key, count in request.cashCounts.items():
                if key in denominations:
                    closing_cash += Decimal(denominations[key]) * Decimal(count)

            # Step 4: Update the session record to close it out
            update_sql = """
                UPDATE CashierSessions
                SET
                    Status = 'Closed',
                    SessionEnd = GETDATE(),
                    ClosingCash = ?,
                    CashSalesAtClose = ?
                WHERE SessionID = ?;
            """
            await cursor.execute(
                update_sql,
                closing_cash,
                cash_sales_at_close,
                request.sessionId
            )
            await conn.commit()

            logger.info(f"Session {request.sessionId} for cashier {session_row.CashierName} has been closed.")
            return {
                "message": "Session closed successfully",
                "sessionId": request.sessionId
            }

    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Failed to close session {request.sessionId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while closing the session.")
    finally:
        if conn:
            await conn.close()