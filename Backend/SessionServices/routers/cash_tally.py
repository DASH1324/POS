from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Optional
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
USER_SERVICE_VERIFY_PIN_URL = "http://localhost:4000/users/verify-pin"

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
    pin: str

class ReportDiscrepancyRequest(BaseModel):
    sessionId: int
    discrepancyAmount: float
    reportedBy: str
    pin: str
    cashCounts: Dict[str, int]

# --- Helper function to verify manager PIN ---
async def verify_manager_pin(pin: str, token: str):
    """Verify manager PIN and return manager username"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                USER_SERVICE_VERIFY_PIN_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={"pin": pin}
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("managerUsername")
            else:
                error_detail = response.json().get("detail", "Invalid Manager PIN")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=error_detail
                )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service unavailable."
            )

# --- API Endpoint to Close a Cashier Session ---
@router_cash_tally.post(
    "/close_session",
    summary="Close out a cashier's session after a cash count"
)
async def close_session(
    request: CloseSessionRequest,
    current_user: dict = Depends(get_current_active_user),
    token: str = Depends(oauth2_scheme)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    # Verify manager PIN and get username
    manager_username = await verify_manager_pin(request.pin, token)

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

            # Step 4: Update the session record to close it out with CheckedBy
            update_sql = """
                UPDATE CashierSessions
                SET
                    Status = 'Closed',
                    SessionEnd = GETDATE(),
                    ClosingCash = ?,
                    CashSalesAtClose = ?,
                    CheckedBy = ?
                WHERE SessionID = ?;
            """
            # FIX: Convert Decimal objects to float before passing as parameters
            await cursor.execute(
                update_sql,
                float(closing_cash),
                float(cash_sales_at_close),
                manager_username,
                request.sessionId
            )
            await conn.commit()

            logger.info(f"Session {request.sessionId} for cashier {session_row.CashierName} has been closed by {manager_username}.")
            return {
                "message": "Session closed successfully",
                "sessionId": request.sessionId,
                "checkedBy": manager_username
            }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Failed to close session {request.sessionId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while closing the session.")
    finally:
        if conn:
            await conn.close()

# --- API Endpoint to Report Cash Discrepancy ---
@router_cash_tally.post(
    "/report_discrepancy",
    summary="Report a cash discrepancy for a session and close it"
)
async def report_discrepancy(
    request: ReportDiscrepancyRequest,
    current_user: dict = Depends(get_current_active_user),
    token: str = Depends(oauth2_scheme)
):
    allowed_roles = ["admin", "manager", "cashier"]
    if current_user.get("userRole") not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    # Verify manager PIN and get username
    manager_username = await verify_manager_pin(request.pin, token)

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

            # Step 4: Insert discrepancy record with CheckedBy
            insert_sql = """
                INSERT INTO CashDiscrepancies 
                (SessionID, DiscrepancyAmount, ReportedBy, ReportedAt, CheckedBy)
                VALUES (?, ?, ?, GETDATE(), ?);
            """
            # FIX: Pass the discrepancy amount as a float directly
            await cursor.execute(
                insert_sql,
                request.sessionId,
                request.discrepancyAmount,
                request.reportedBy,
                manager_username
            )

            # Step 5: Close the session with ClosingCash, CashSalesAtClose, and CheckedBy
            update_sql = """
                UPDATE CashierSessions
                SET
                    Status = 'Closed',
                    SessionEnd = GETDATE(),
                    ClosingCash = ?,
                    CashSalesAtClose = ?,
                    CheckedBy = ?
                WHERE SessionID = ?;
            """
            # FIX: Convert Decimal objects to float before passing as parameters
            await cursor.execute(
                update_sql,
                float(closing_cash),
                float(cash_sales_at_close),
                manager_username,
                request.sessionId
            )

            await conn.commit()

            logger.info(f"Discrepancy of {request.discrepancyAmount} reported for session {request.sessionId} by {request.reportedBy}, checked by {manager_username}. Session closed.")
            return {
                "message": "Discrepancy reported and session closed successfully",
                "sessionId": request.sessionId,
                "discrepancyAmount": request.discrepancyAmount,
                "reportedBy": request.reportedBy,
                "checkedBy": manager_username,
                "closingCash": float(closing_cash),
                "cashSalesAtClose": float(cash_sales_at_close)
            }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            await conn.rollback()
        logger.error(f"Failed to report discrepancy for session {request.sessionId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while reporting the discrepancy.")
    finally:
        if conn:
            await conn.close()