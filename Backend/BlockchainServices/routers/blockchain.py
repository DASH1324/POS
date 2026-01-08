from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from web3 import Web3
from eth_account import Account
import json
import hashlib
import logging
import httpx
import os
from dotenv import load_dotenv
load_dotenv()

from database import get_blockchain_db_connection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:4000/auth/token")

# --- Auth Configuration ---
USER_SERVICE_ME_URL = "http://localhost:4000/auth/users/me"

BUILDBEAR_RPC_URL = os.getenv("BUILDBEAR_RPC_URL", "https://rpc.buildbear.io/screeching-yondu-eb2d9143")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "dedafa3f5b97959588c0565254045bc36aa52aceef5838b50437d5d5d336345f")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x14B5BB91Ea29056F2BECEC93fFeCEcaA26AC467B")

# Matches the solidity smart contract
ACTIVITY_LOG_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "_serviceIdentifier", "type": "string"},
            {"internalType": "string", "name": "_action", "type": "string"},
            {"internalType": "string", "name": "_entityType", "type": "string"},
            {"internalType": "uint256", "name": "_entityId", "type": "uint256"},
            {"internalType": "string", "name": "_actorUsername", "type": "string"},
            {"internalType": "string", "name": "_changeDescription", "type": "string"},
            {"internalType": "string", "name": "_dataHash", "type": "string"}
        ],
        "name": "logActivity",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getLogCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_logId", "type": "uint256"}],
        "name": "getLog",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "logId", "type": "uint256"},
                    {"internalType": "string", "name": "serviceIdentifier", "type": "string"},
                    {"internalType": "string", "name": "action", "type": "string"},
                    {"internalType": "string", "name": "entityType", "type": "string"},
                    {"internalType": "uint256", "name": "entityId", "type": "uint256"},
                    {"internalType": "string", "name": "actorUsername", "type": "string"},
                    {"internalType": "address", "name": "actorAddress", "type": "address"},
                    {"internalType": "string", "name": "changeDescription", "type": "string"},
                    {"internalType": "string", "name": "dataHash", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
                ],
                "internalType": "struct ActivityLogger.ActivityLog",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "activityLogs",
        "outputs": [
            {"internalType": "uint256", "name": "logId", "type": "uint256"},
            {"internalType": "string", "name": "serviceIdentifier", "type": "string"},
            {"internalType": "string", "name": "action", "type": "string"},
            {"internalType": "string", "name": "entityType", "type": "string"},
            {"internalType": "uint256", "name": "entityId", "type": "uint256"},
            {"internalType": "string", "name": "actorUsername", "type": "string"},
            {"internalType": "address", "name": "actorAddress", "type": "address"},
            {"internalType": "string", "name": "changeDescription", "type": "string"},
            {"internalType": "string", "name": "dataHash", "type": "string"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "logCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "logId", "type": "uint256"},
            {"indexed": False, "internalType": "string", "name": "serviceIdentifier", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "action", "type": "string"},
            {"indexed": True, "internalType": "address", "name": "actorAddress", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "ActivityLogged",
        "type": "event"
    }
]

# Initialize Web3
w3 = None
account = None
contract = None

try:
    w3 = Web3(Web3.HTTPProvider(BUILDBEAR_RPC_URL))
    account = Account.from_key(PRIVATE_KEY)
    logger.info(f"✅ Connected to BuildBear. Account: {account.address}")
    
    # Initialize contract if address is provided
    if CONTRACT_ADDRESS and CONTRACT_ADDRESS.strip():
        try:
            contract_checksum = Web3.to_checksum_address(CONTRACT_ADDRESS)
            contract = w3.eth.contract(address=contract_checksum, abi=ACTIVITY_LOG_ABI)
            logger.info(f"✅ Contract initialized at: {contract_checksum}")
            
            # Test contract connection
            try:
                log_count = contract.functions.logCount().call()
                logger.info(f"✅ Contract verified. Current log count: {log_count}")
            except Exception as e:
                logger.error(f"⚠️  Contract call test failed: {e}")
                contract = None
        except Exception as e:
            logger.error(f"⚠️  Invalid contract address: {e}")
            contract = None
    else:
        logger.warning("⚠️  Contract address not set. Please deploy contract and set CONTRACT_ADDRESS environment variable.")
        
except Exception as e:
    logger.error(f"❌ Failed to initialize Web3: {e}")


# HELPER FUNCTIONS
def generate_data_hash(data: Dict[str, Any]) -> str:
    """Generate SHA-256 hash of the data"""
    data_string = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(data_string.encode()).hexdigest()

class ActivityLogRequest(BaseModel):
    service_identifier: str = Field(..., description="Service name (e.g., 'POS_SALES', 'DISCOUNTS', 'PROMOTIONS')")
    action: str = Field(..., description="Action type: CREATE, UPDATE, DELETE")
    entity_type: str = Field(..., description="Entity type (e.g., 'Sale', 'Discount', 'Promotion')")
    entity_id: int = Field(..., description="ID of the entity")
    actor_username: str = Field(..., description="Username of the person performing the action")
    change_description: str = Field(..., description="Description of what changed")
    data: Dict[str, Any] = Field(..., description="The actual data being logged")

class ActivityLogResponse(BaseModel):
    log_id: int
    transaction_hash: str
    block_number: int
    service_identifier: str
    action: str
    entity_type: str
    entity_id: int
    actor_username: str
    actor_address: str
    data_hash: str
    status: str

class BlockchainLogQueryResponse(BaseModel):
    log_id: int
    service_identifier: str
    action: str
    entity_type: str
    entity_id: int
    actor_username: str
    actor_address: str
    change_description: str
    data_hash: str
    timestamp: int
    created_at: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None

# AUTHORIZATION HELPER
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    """Verify user token with auth service"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                USER_SERVICE_ME_URL,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            user_data = response.json()
            user_data['access_token'] = token
            return user_data
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Invalid token or user not found: {e.response.text}",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to the authentication service."
            )

async def save_to_database(
    blockchain_log_id: int,
    tx_hash: str,
    block_number: int,
    log_data: ActivityLogRequest,
    actor_address: str,
    data_hash: str
):
    """Save blockchain log reference to BlockchainAudit database using direct INSERT"""
    conn = await get_blockchain_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Direct INSERT statement instead of stored procedure
            sql = """
                INSERT INTO BlockchainActivityLogs (
                    BlockchainLogID,
                    TransactionHash,
                    BlockNumber,
                    ServiceIdentifier,
                    Action,
                    EntityType,
                    EntityID,
                    ActorUsername,
                    ActorAddress,
                    ChangeDescription,
                    DataHash,
                    CreatedAt
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            await cursor.execute(
                sql,
                blockchain_log_id,
                tx_hash,
                block_number,
                log_data.service_identifier,
                log_data.action,
                log_data.entity_type,
                log_data.entity_id,
                log_data.actor_username,
                actor_address,
                log_data.change_description,
                data_hash
            )
            await conn.commit()
            logger.info(f"✅ Saved blockchain log to BlockchainAudit database: LogID {blockchain_log_id}")
    except Exception as e:
        logger.error(f"❌ Failed to save to BlockchainAudit database: {e}")
        raise
    finally:
        await conn.close()

# BLOCKCHAIN INTERACTION FUNCTIONS

async def log_to_blockchain(log_data: ActivityLogRequest) -> ActivityLogResponse:
    """Send activity log to BuildBear blockchain"""
    if not w3 or not account or not contract:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Blockchain connection not initialized. Please deploy contract and set CONTRACT_ADDRESS."
        )
    
    try:
        # Generate data hash
        data_hash = generate_data_hash(log_data.data)
        
        # Prepare transaction
        nonce = w3.eth.get_transaction_count(account.address)
        
        # Check account balance
        balance = w3.eth.get_balance(account.address)
        logger.info(f"Account balance: {w3.from_wei(balance, 'ether')} ETH")

        if balance == 0:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Account has insufficient funds. Please fund the account or use a pre-funded test account."
            )

        tx = contract.functions.logActivity(
            log_data.service_identifier,
            log_data.action,
            log_data.entity_type,
            log_data.entity_id,
            log_data.actor_username,
            log_data.change_description,
            data_hash
        ).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 500000,  
            'gasPrice': w3.eth.gas_price // 10  
        })
        
        # Sign transaction
        signed_tx = account.sign_transaction(tx)

        # Send transaction
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        logger.info(f"Transaction sent: {tx_hash.hex()}")
        
        # Wait for transaction receipt
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        logger.info(f"Transaction confirmed in block {tx_receipt['blockNumber']}")
        
        # Parse the event from the receipt to get the log ID
        log_id = None
        try:
            # Get ActivityLogged event from receipt
            event_logs = contract.events.ActivityLogged().process_receipt(tx_receipt)
            if event_logs:
                log_id = event_logs[0]['args']['logId']
                logger.info(f"Log ID from event: {log_id}")
        except Exception as e:
            logger.warning(f"Could not parse event, using logCount instead: {e}")
        
        # Fallback: Get log ID from contract state
        if log_id is None:
            log_id = contract.functions.logCount().call() - 1
            logger.info(f"Log ID from logCount: {log_id}")
        
        # Save to BlockchainAudit database
        await save_to_database(
            blockchain_log_id=log_id,
            tx_hash=tx_hash.hex(),
            block_number=tx_receipt['blockNumber'],
            log_data=log_data,
            actor_address=account.address,
            data_hash=data_hash
        )
        
        logger.info(f"Successfully logged to blockchain: TX {tx_hash.hex()}")
        
        return ActivityLogResponse(
            log_id=log_id,
            transaction_hash=tx_hash.hex(),
            block_number=tx_receipt['blockNumber'],
            service_identifier=log_data.service_identifier,
            action=log_data.action,
            entity_type=log_data.entity_type,
            entity_id=log_data.entity_id,
            actor_username=log_data.actor_username,
            actor_address=account.address,
            data_hash=data_hash,
            status="confirmed"
        )
    
    except Exception as e:
        logger.error(f"Blockchain logging failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log to blockchain: {str(e)}"
        )

@router.post("/log", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
async def create_activity_log(
    log_data: ActivityLogRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Log an activity to the blockchain.
    This should be called by other microservices after successful POST/PATCH operations.
    """
    # Ensure actor username matches authenticated user
    if log_data.actor_username != current_user.get("username"):
        logger.warning(f"Actor username mismatch: {log_data.actor_username} vs {current_user.get('username')}")
    
    # Log to blockchain
    result = await log_to_blockchain(log_data)
    
    return result
    

@router.get("/logs", response_model=List[BlockchainLogQueryResponse])
async def get_activity_logs(
    service: Optional[str] = None,
    entity_type: Optional[str] = None,
    actor_username: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Query activity logs from the BlockchainAudit database.
    Filters: service, entity_type, actor_username, action, start_date, end_date
    Date format: YYYY-MM-DD (e.g., 2025-01-15)
    If limit is not specified, returns all records.
    """
    conn = await get_blockchain_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Build dynamic query
            query = """
                SELECT 
                    BlockchainLogID, TransactionHash, BlockNumber,
                    ServiceIdentifier, Action, EntityType, EntityID,
                    ActorUsername, ActorAddress, ChangeDescription,
                    DataHash, CreatedAt
                FROM BlockchainActivityLogs
                WHERE 1=1
            """
            params = []
            
            if service:
                query += " AND ServiceIdentifier = ?"
                params.append(service)
            
            if entity_type:
                query += " AND EntityType = ?"
                params.append(entity_type)
            
            if actor_username:
                query += " AND ActorUsername = ?"
                params.append(actor_username)
            
            if action:
                query += " AND Action = ?"
                params.append(action)
            
            # Date filtering
            if start_date:
                try:
                    datetime.strptime(start_date, '%Y-%m-%d')
                    query += " AND CAST(CreatedAt AS DATE) >= ?"
                    params.append(start_date)
                except ValueError:
                    logger.warning(f"Invalid start_date format: {start_date}")
            
            if end_date:
                try:
                    datetime.strptime(end_date, '%Y-%m-%d')
                    query += " AND CAST(CreatedAt AS DATE) <= ?"
                    params.append(end_date)
                except ValueError:
                    logger.warning(f"Invalid end_date format: {end_date}")
            
            # Apply limit only if specified
            if limit is not None and limit > 0:
                final_query = f"SELECT TOP {limit} * FROM ({query}) AS T ORDER BY T.CreatedAt DESC"
            else:
                # return all records
                final_query = f"{query} ORDER BY CreatedAt DESC"
            
            await cursor.execute(final_query, tuple(params))
            rows = await cursor.fetchall()
            
            results = []
            for row in rows:
                results.append(BlockchainLogQueryResponse(
                    log_id=row.BlockchainLogID,
                    service_identifier=row.ServiceIdentifier,
                    action=row.Action,
                    entity_type=row.EntityType,
                    entity_id=row.EntityID,
                    actor_username=row.ActorUsername,
                    actor_address=row.ActorAddress,
                    change_description=row.ChangeDescription,
                    data_hash=row.DataHash,
                    timestamp=int(row.CreatedAt.timestamp()),
                    created_at=row.CreatedAt.isoformat(),
                    transaction_hash=row.TransactionHash,
                    block_number=row.BlockNumber
                ))
            
            logger.info(f"✅ Retrieved {len(results)} logs from BlockchainAudit DB (limit: {limit or 'none'})")
            return results
    
    except Exception as e:
        logger.error(f"❌ Failed to query logs from BlockchainAudit DB: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve logs: {str(e)}"
        )
    finally:
        await conn.close()

@router.get("/logs/{log_id}", response_model=BlockchainLogQueryResponse)
async def get_activity_log_by_id(
    log_id: int,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific activity log by blockchain log ID"""
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Blockchain contract not initialized"
        )
    
    try:
        # Query from blockchain using the getLog function
        log_data = contract.functions.getLog(log_id).call()
        
        # Query transaction details from BlockchainAudit database
        conn = await get_blockchain_db_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT TransactionHash, BlockNumber, CreatedAt FROM BlockchainActivityLogs WHERE BlockchainLogID = ?",
                    log_id
                )
                db_row = await cursor.fetchone()
                
                return BlockchainLogQueryResponse(
                    log_id=log_data[0],
                    service_identifier=log_data[1],
                    action=log_data[2],
                    entity_type=log_data[3],
                    entity_id=log_data[4],
                    actor_username=log_data[5],
                    actor_address=log_data[6],
                    change_description=log_data[7],
                    data_hash=log_data[8],
                    timestamp=log_data[9],
                    created_at=db_row.CreatedAt.isoformat() if db_row else None,
                    transaction_hash=db_row.TransactionHash if db_row else None,
                    block_number=db_row.BlockNumber if db_row else None
                )
        finally:
            await conn.close()
    
    except Exception as e:
        logger.error(f"❌ Failed to retrieve log {log_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Log not found or error retrieving: {str(e)}"
        )

@router.post("/verify/{log_id}")
async def verify_log_integrity(
    log_id: int,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_active_user)
):
    """
    Verify that the data hash matches the blockchain record.
    Returns True if data integrity is maintained.
    """
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Blockchain contract not initialized"
        )
    
    try:
        # Get log from blockchain
        log_data = contract.functions.getLog(log_id).call()
        blockchain_hash = log_data[8]  # dataHash field
        
        # Calculate hash of provided data
        calculated_hash = generate_data_hash(data)
        
        is_valid = blockchain_hash == calculated_hash
        
        return {
            "log_id": log_id,
            "is_valid": is_valid,
            "blockchain_hash": blockchain_hash,
            "calculated_hash": calculated_hash,
            "message": "✅ Data integrity verified" if is_valid else "⚠️  Data has been tampered with"
        }
    
    except Exception as e:
        logger.error(f"❌ Verification failed for log {log_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}"
        )

@router.get("/status")
async def blockchain_status():
    """Check blockchain connection status and database connectivity"""
    if not w3 or not account:
        return {
            "status": "disconnected",
            "message": "Blockchain not configured",
            "connected": False
        }
    
    try:
        is_connected = w3.is_connected()
        block_number = w3.eth.block_number if is_connected else None
        balance = w3.eth.get_balance(account.address) if is_connected else None
        
        # Try to get log count if contract is initialized
        log_count = None
        if contract:
            try:
                log_count = contract.functions.logCount().call()
            except Exception as e:
                logger.warning(f"Could not get log count: {e}")
        
        # Check database connectivity
        db_status = "unknown"
        db_log_count = None
        try:
            conn = await get_blockchain_db_connection()
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT COUNT(*) as count FROM BlockchainActivityLogs")
                row = await cursor.fetchone()
                db_log_count = row.count if row else 0
                db_status = "connected"
            await conn.close()
        except Exception as e:
            db_status = f"error: {str(e)}"
            logger.error(f"Database status check failed: {e}")
        
        return {
            "status": "connected" if is_connected else "disconnected",
            "connected": is_connected,
            "network": BUILDBEAR_RPC_URL,
            "account": account.address,
            "balance_wei": str(balance) if balance else None,
            "balance_eth": str(w3.from_wei(balance, 'ether')) if balance else None,
            "latest_block": block_number,
            "contract_address": CONTRACT_ADDRESS if contract else None,
            "contract_deployed": bool(contract),
            "total_logs_blockchain": log_count,
            "database_status": db_status,
            "total_logs_database": db_log_count,
            "database_name": "BlockchainAudit"
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "error": str(e)
        }
    
@router.get("/network-info")
async def get_network_info():
    """Get blockchain network information for explorer links"""
    # Extract network ID from RPC URL
    # Format: https://rpc.buildbear.io/{network_id}
    network_id = BUILDBEAR_RPC_URL.split('/')[-1] if BUILDBEAR_RPC_URL else None
    
    return {
        "rpc_url": BUILDBEAR_RPC_URL,
        "network_id": network_id,
        "explorer_base_url": f"https://explorer.buildbear.io/{network_id}" if network_id else None,
        "contract_address": CONTRACT_ADDRESS
    }