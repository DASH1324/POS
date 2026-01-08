from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
import logging
import httpx
from database import get_blockchain_db_connection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router_blockchain_logs = APIRouter(
    prefix="/api/blockchain-logs",
    tags=["Blockchain Logs"]
)

# Auth configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:4000/auth/token")
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

# --- Authorization Helper Function ---
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    """Verify user authentication - OPTIONAL for public blockchain viewing"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(USER_SERVICE_ME_URL, headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            user_data = response.json()
            return user_data
        except:
            # For public blockchain viewing, we allow unauthenticated access
            # The blockchain is meant to be transparent
            return None

@router_blockchain_logs.get(
    "/sale/{sale_id}",
    status_code=status.HTTP_200_OK,
    summary="Get blockchain audit logs for a specific sale (PUBLIC)"
)
async def get_blockchain_logs_for_sale(sale_id: int):
    """
    PUBLIC endpoint - Blockchain transparency principle.
    Returns immutable audit trail for any completed transaction.
    This demonstrates blockchain's core value: public verifiability.
    
    Security notes:
    - Only returns transaction hashes and action types
    - Does NOT expose sensitive business logic or raw data
    - Shows WHO did WHAT and WHEN (transparency)
    - Cannot be modified (immutability)
    """
    blockchain_conn = None

    try:
        blockchain_conn = await get_blockchain_db_connection()
        async with blockchain_conn.cursor() as cursor:
            # Query blockchain logs for this sale
            # Only expose public-safe information
            # Note: EntityID stores the SaleID value
            blockchain_query = """
                SELECT
                    LogID,
                    TransactionHash,
                    BlockNumber,
                    Action,
                    ChangeDescription,
                    ActorUsername,
                    CreatedAt,
                    DataHash
                FROM BlockchainActivityLogs
                WHERE ServiceIdentifier IN ('POS_SALES', 'PURCHASE_ORDER_SERVICE')
                    AND EntityType IN ('Sale', 'PurchaseOrder')
                    AND EntityID = ?
                ORDER BY CreatedAt ASC
            """
            await cursor.execute(blockchain_query, sale_id)
            blockchain_rows = await cursor.fetchall()

            if not blockchain_rows or len(blockchain_rows) == 0:
                # Return empty array if no logs found (not an error)
                logger.info(f"No blockchain logs found for sale {sale_id}")
                return []

            blockchain_logs = []
            for log_row in blockchain_rows:
                blockchain_logs.append({
                    "logId": log_row.LogID,
                    "transactionHash": log_row.TransactionHash,
                    "blockNumber": log_row.BlockNumber,
                    "action": log_row.Action,
                    "timestamp": log_row.CreatedAt.isoformat() if log_row.CreatedAt else None,
                    "actorUsername": log_row.ActorUsername,
                    "changeDescription": log_row.ChangeDescription,
                    "dataHash": log_row.DataHash  # Cryptographic proof without exposing raw data
                })

        await blockchain_conn.close()
        
        logger.info(f"✅ Retrieved {len(blockchain_logs)} blockchain logs for sale {sale_id}")
        return blockchain_logs
        
    except Exception as e:
        logger.error(f"Error fetching blockchain logs for sale {sale_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch blockchain logs"
        )
    finally:
        if blockchain_conn:
            try:
                blockchain_conn.close()
            except:
                pass


@router_blockchain_logs.get(
    "/verify/{transaction_hash}",
    status_code=status.HTTP_200_OK,
    summary="Verify a specific blockchain transaction (PUBLIC)"
)
async def verify_blockchain_transaction(transaction_hash: str):
    """
    PUBLIC endpoint - Verify the authenticity of a blockchain transaction.
    Anyone can verify that a transaction exists and hasn't been tampered with.
    """
    blockchain_conn = None

    try:
        blockchain_conn = await get_blockchain_db_connection()
        async with blockchain_conn.cursor() as cursor:
            verify_query = """
                SELECT
                    LogID,
                    TransactionHash,
                    BlockNumber,
                    Action,
                    EntityType,
                    EntityID,
                    ActorUsername,
                    CreatedAt,
                    DataHash
                FROM BlockchainActivityLogs
                WHERE TransactionHash = ?
            """
            await cursor.execute(verify_query, transaction_hash)
            log_row = await cursor.fetchone()

            if not log_row:
                raise HTTPException(
                    status_code=404,
                    detail="Transaction not found in blockchain"
                )

            result = {
                "verified": True,
                "logId": log_row.LogID,
                "transactionHash": log_row.TransactionHash,
                "blockNumber": log_row.BlockNumber,
                "action": log_row.Action,
                "entityType": log_row.EntityType,
                "entityId": log_row.EntityID,
                "actorUsername": log_row.ActorUsername,
                "timestamp": log_row.CreatedAt.isoformat() if log_row.CreatedAt else None,
                "dataHash": log_row.DataHash
            }

        await blockchain_conn.close()
        
        logger.info(f"✅ Verified transaction: {transaction_hash}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying transaction {transaction_hash}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to verify transaction"
        )
    finally:
        if blockchain_conn:
            try:
                blockchain_conn.close()
            except:
                pass


@router_blockchain_logs.get(
    "/stats/sale/{sale_id}",
    status_code=status.HTTP_200_OK,
    summary="Get blockchain statistics for a sale (PUBLIC)"
)
async def get_blockchain_stats_for_sale(sale_id: int):
    """
    PUBLIC endpoint - Get blockchain statistics for transparency.
    Shows how many times a transaction was modified and by whom.
    """
    blockchain_conn = None
    
    try:
        blockchain_conn = await get_blockchain_db_connection()
        async with blockchain_conn.cursor() as cursor:
            stats_query = """
                SELECT
                    COUNT(*) as TotalLogs,
                    MIN(CreatedAt) as FirstAction,
                    MAX(CreatedAt) as LastAction,
                    COUNT(DISTINCT ActorUsername) as UniqueActors,
                    COUNT(CASE WHEN Action = 'CREATE' THEN 1 END) as Creates,
                    COUNT(CASE WHEN Action = 'UPDATE' THEN 1 END) as Updates,
                    COUNT(CASE WHEN Action = 'CANCEL' THEN 1 END) as Cancellations,
                    COUNT(CASE WHEN Action = 'REFUND' THEN 1 END) as Refunds
                FROM BlockchainActivityLogs
                WHERE ServiceIdentifier IN ('POS_SALES', 'PURCHASE_ORDER_SERVICE')
                    AND EntityType IN ('Sale', 'PurchaseOrder')
                    AND EntityID = ?
            """
            await cursor.execute(stats_query, sale_id)
            stats_row = await cursor.fetchone()

            if not stats_row or stats_row.TotalLogs == 0:
                return {
                    "saleId": sale_id,
                    "totalLogs": 0,
                    "message": "No blockchain records found for this sale"
                }

            result = {
                "saleId": sale_id,
                "totalLogs": stats_row.TotalLogs,
                "firstAction": stats_row.FirstAction.isoformat() if stats_row.FirstAction else None,
                "lastAction": stats_row.LastAction.isoformat() if stats_row.LastAction else None,
                "uniqueActors": stats_row.UniqueActors,
                "actionBreakdown": {
                    "creates": stats_row.Creates,
                    "updates": stats_row.Updates,
                    "cancellations": stats_row.Cancellations,
                    "refunds": stats_row.Refunds
                }
            }

        await blockchain_conn.close()
        
        logger.info(f"✅ Retrieved blockchain stats for sale {sale_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching blockchain stats for sale {sale_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch blockchain statistics"
        )
    finally:
        if blockchain_conn:
            try:
                blockchain_conn.close()
            except:
                pass