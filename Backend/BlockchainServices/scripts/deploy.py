"""
Automated Smart Contract Deployment Script for BuildBear
This will compile and deploy the ActivityLog contract automatically
"""
from web3 import Web3
from eth_account import Account
from solcx import compile_source, install_solc
import json
import os

# ============================================
# CONFIGURATION
# ============================================
BUILDBEAR_RPC_URL = "https://rpc.buildbear.io/nutty-darkphoenix-eda50421"
PRIVATE_KEY = "3f2eb6735d6d2ff3ee4c3db83d2f84867f7530de32b07c7ecee5e37713c536bd"

# ============================================
# SMART CONTRACT SOURCE CODE
# ============================================
CONTRACT_SOURCE = '''
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ActivityLog {
    struct Log {
        uint256 logId;
        string serviceIdentifier;
        string action;
        string entityType;
        uint256 entityId;
        string actorUsername;
        address actorAddress;
        string changeDescription;
        string dataHash;
        uint256 timestamp;
    }

    mapping(uint256 => Log) public activityLogs;
    uint256 private logCounter;

    event ActivityLogged(
        uint256 indexed logId,
        string serviceIdentifier,
        string action,
        address indexed actorAddress
    );

    function logActivity(
        string memory _serviceIdentifier,
        string memory _action,
        string memory _entityType,
        uint256 _entityId,
        string memory _actorUsername,
        string memory _changeDescription,
        string memory _dataHash
    ) public returns (uint256) {
        uint256 newLogId = logCounter;
        
        activityLogs[newLogId] = Log({
            logId: newLogId,
            serviceIdentifier: _serviceIdentifier,
            action: _action,
            entityType: _entityType,
            entityId: _entityId,
            actorUsername: _actorUsername,
            actorAddress: msg.sender,
            changeDescription: _changeDescription,
            dataHash: _dataHash,
            timestamp: block.timestamp
        });

        emit ActivityLogged(newLogId, _serviceIdentifier, _action, msg.sender);
        
        logCounter++;
        return newLogId;
    }

    function getLogCount() public view returns (uint256) {
        return logCounter;
    }
}
'''

# ============================================
# DEPLOYMENT SCRIPT
# ============================================
def deploy_contract():
    print("=" * 60)
    print("🚀 DEPLOYING ACTIVITYLOG CONTRACT TO BUILDBEAR")
    print("=" * 60)
    
    # Step 1: Connect to BuildBear
    print("\n📡 Step 1: Connecting to BuildBear...")
    w3 = Web3(Web3.HTTPProvider(BUILDBEAR_RPC_URL))
    
    if not w3.is_connected():
        print("❌ Failed to connect to BuildBear!")
        return
    
    account = Account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    
    print(f"✅ Connected to BuildBear")
    print(f"   Account: {account.address}")
    print(f"   Balance: {w3.from_wei(balance, 'ether')} ETH")
    
    if balance == 0:
        print("⚠️  Warning: Account has 0 balance. You may need to fund it.")
    
    # Step 2: Install and compile Solidity
    print("\n🔧 Step 2: Installing Solidity compiler...")
    try:
        # Try to install 0.8.0, if it fails, try other versions
        try:
            install_solc('0.8.0')
            print("✅ Solidity compiler 0.8.0 installed")
        except Exception as e:
            print(f"⚠️  0.8.0 installation failed, trying 0.8.19...")
            try:
                install_solc('0.8.19')
                print("✅ Solidity compiler 0.8.19 installed")
            except Exception as e2:
                print(f"⚠️  0.8.19 installation failed, trying latest available...")
                # Get available versions and install the latest
                available_versions = install_solc.get_installable_solc_versions()
                if available_versions:
                    latest_version = max(available_versions)
                    install_solc(latest_version)
                    print(f"✅ Solidity compiler {latest_version} installed")
                else:
                    raise Exception("No Solidity versions available for installation")
    except Exception as e:
        print(f"❌ Failed to install Solidity compiler: {e}")
        return
    
    print("\n⚙️  Step 3: Compiling smart contract...")
    try:
        # Try compiling with the installed version
        compiled_sol = compile_source(CONTRACT_SOURCE, output_values=['abi', 'bin'])
        contract_id, contract_interface = compiled_sol.popitem()
        bytecode = contract_interface['bin']
        abi = contract_interface['abi']
        print("✅ Contract compiled successfully")
    except Exception as e:
        print(f"❌ Compilation failed: {e}")
        print("ℹ️  Trying to install and use a different Solidity version...")
        try:
            # Try installing a different version and compile again
            install_solc('0.8.19')
            compiled_sol = compile_source(CONTRACT_SOURCE, output_values=['abi', 'bin'])
            contract_id, contract_interface = compiled_sol.popitem()
            bytecode = contract_interface['bin']
            abi = contract_interface['abi']
            print("✅ Contract compiled successfully with 0.8.19")
        except Exception as e2:
            print(f"❌ Compilation still failed: {e2}")
            return
    
    # Step 4: Deploy contract
    print("\n📤 Step 4: Deploying contract to blockchain...")
    try:
        Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
        
        # Get nonce
        nonce = w3.eth.get_transaction_count(account.address)
        
        # Build transaction
        transaction = Contract.constructor().build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 3000000,
            'gasPrice': w3.eth.gas_price
        })
        
        # Sign transaction
        signed_txn = account.sign_transaction(transaction)

        # Send transaction
        print("   Sending transaction...")
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        print(f"   Transaction hash: {tx_hash.hex()}")
        
        # Wait for receipt
        print("   Waiting for confirmation...")
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        contract_address = tx_receipt.contractAddress
        
        print("\n" + "=" * 60)
        print("🎉 CONTRACT DEPLOYED SUCCESSFULLY!")
        print("=" * 60)
        print(f"\n📍 Contract Address: {contract_address}")
        print(f"🔗 Transaction Hash: {tx_hash.hex()}")
        print(f"📦 Block Number: {tx_receipt.blockNumber}")
        print(f"⛽ Gas Used: {tx_receipt.gasUsed}")
        
        # Step 5: Save to .env file
        print("\n💾 Step 5: Saving to .env file...")
        env_content = f"""
# BuildBear Blockchain Configuration
BUILDBEAR_RPC_URL={BUILDBEAR_RPC_URL}
PRIVATE_KEY={PRIVATE_KEY}
CONTRACT_ADDRESS={contract_address}
"""
        
        with open('.env', 'w') as f:
            f.write(env_content.strip())
        
        print("✅ Configuration saved to .env file")
        
        # Step 6: Save ABI
        print("\n💾 Step 6: Saving contract ABI...")
        with open('contract_abi.json', 'w') as f:
            json.dump(abi, f, indent=2)
        print("✅ ABI saved to contract_abi.json")
        
        print("\n" + "=" * 60)
        print("✨ DEPLOYMENT COMPLETE!")
        print("=" * 60)
        print("\n📋 Next Steps:")
        print("1. Set environment variable:")
        print(f"   $env:CONTRACT_ADDRESS = '{contract_address}'")
        print("\n2. Or restart your service to load from .env file")
        print("\n3. Test the blockchain service:")
        print("   python main.py")
        
        return contract_address
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        import traceback
        traceback.print_exc()
        return None

# ============================================
# MAIN EXECUTION
# ============================================
if __name__ == "__main__":
    print("\n⚠️  IMPORTANT: Make sure you have installed required packages:")
    print("   pip install web3 py-solc-x eth-account")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    input()
    
    contract_address = deploy_contract()
    
    if contract_address:
        print("\n✅ You can now use your blockchain service!")
    else:
        print("\n❌ Deployment failed. Please check the errors above.")
