"""
Quick Deployment Script for ActivityLogger Contract
Run this in a NEW terminal while your service is running
"""
from web3 import Web3
from eth_account import Account
from solcx import compile_source, install_solc, get_installed_solc_versions
import json
import os
from dotenv import load_dotenv

load_dotenv()

print("\n" + "="*70)
print("🚀 DEPLOYING ACTIVITYLOGGER CONTRACT")
print("="*70 + "\n")

# Configuration - Load from .env
BUILDBEAR_RPC_URL = os.getenv("BUILDBEAR_RPC_URL", "https://rpc.buildbear.io/screeching-yondu-eb2d9143")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "dedafa3f5b97959588c0565254045bc36aa52aceef5838b50437d5d5d336345f")

# Read contract source from file
with open('contracts/ActivityLogger.sol', 'r') as f:
    CONTRACT_SOURCE = f.read()

try:
    # Connect
    print("📡 Connecting to BuildBear...")
    w3 = Web3(Web3.HTTPProvider(BUILDBEAR_RPC_URL))
    if not w3.is_connected():
        print("❌ Connection failed!")
        exit(1)
    
    account = Account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    print(f"✅ Connected! Account: {account.address}")
    print(f"💰 Balance: {w3.from_wei(balance, 'ether')} ETH\n")
    
    # Install solc
    print("🔧 Setting up Solidity compiler...")
    installed = get_installed_solc_versions()
    if '0.8.0' not in [str(v) for v in installed]:
        print("   Installing Solidity 0.8.0...")
        install_solc('0.8.0')
    print("✅ Compiler ready\n")
    
    # Compile
    print("⚙️  Compiling contract...")
    compiled = compile_source(CONTRACT_SOURCE, output_values=['abi', 'bin'], solc_version='0.8.0')
    _, contract_interface = compiled.popitem()
    bytecode = contract_interface['bin']
    abi = contract_interface['abi']
    print("✅ Compiled!\n")
    
    # Deploy
    print("📤 Deploying to blockchain...")
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce = w3.eth.get_transaction_count(account.address)
    
    tx = Contract.constructor().build_transaction({
        'from': account.address,
        'nonce': nonce,
        'gas': 3000000,
        'gasPrice': w3.eth.gas_price
    })
    
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"📝 TX: {tx_hash.hex()}")
    print("⏳ Waiting for confirmation...")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    contract_address = receipt.contractAddress
    
    print("\n" + "="*70)
    print("🎉 SUCCESS!")
    print("="*70)
    print(f"\n📍 Contract Address: {contract_address}")
    print(f"🔗 TX Hash: {tx_hash.hex()}")
    print(f"📦 Block: {receipt.blockNumber}")
    print(f"⛽ Gas: {receipt.gasUsed}")
    
    # Test
    print("\n🧪 Testing contract...")
    deployed = w3.eth.contract(address=contract_address, abi=abi)
    count = deployed.functions.logCount().call()
    print(f"✅ Log count: {count}")
    
    # Save to .env
    print("\n💾 Updating .env file...")
    env_content = f"""BUILDBEAR_RPC_URL={BUILDBEAR_RPC_URL}
PRIVATE_KEY={PRIVATE_KEY}
CONTRACT_ADDRESS={contract_address}
"""
    with open('.env', 'w') as f:
        f.write(env_content)
    print("✅ .env updated!")
    
    # Save ABI
    with open('contract_abi.json', 'w') as f:
        json.dump(abi, f, indent=2)
    print("✅ ABI saved!")
    
    print("\n" + "="*70)
    print("✨ DEPLOYMENT COMPLETE!")
    print("="*70)
    print("\n📋 Next step: Your FastAPI service will auto-reload")
    print("   and detect the new contract address!")
    print("\n🌐 View on Explorer:")
    print(f"   https://explorer.buildbear.io/severe-electro-aed9ddc9/address/{contract_address}")
    print("\n" + "="*70 + "\n")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()