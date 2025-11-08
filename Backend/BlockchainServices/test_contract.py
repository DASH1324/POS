from dotenv import load_dotenv
import os
load_dotenv()

from web3 import Web3
from eth_account import Account

# Load environment variables
BUILDBEAR_RPC_URL = os.getenv('BUILDBEAR_RPC_URL')
PRIVATE_KEY = os.getenv('PRIVATE_KEY')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')

print("Testing contract connection...")
print(f"RPC URL: {BUILDBEAR_RPC_URL}")
print(f"Contract Address: {CONTRACT_ADDRESS}")

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(BUILDBEAR_RPC_URL))
account = Account.from_key(PRIVATE_KEY)

print(f"Connected: {w3.is_connected()}")
print(f"Account: {account.address}")

# ABI for logCount function
ABI = [
    {
        "inputs": [],
        "name": "logCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)

try:
    log_count = contract.functions.logCount().call()
    print(f"✅ Contract working! Log count: {log_count}")
except Exception as e:
    print(f"❌ Contract error: {e}")
