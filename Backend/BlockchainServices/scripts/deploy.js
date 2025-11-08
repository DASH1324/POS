const hre = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 Deploying ActivityLogger contract to BuildBear...");
  console.log("=".repeat(70) + "\n");

  // Get the signer (your account)
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📍 Deploying from account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");
  
  if (balance === 0n) {
    console.log("⚠️  WARNING: Account has 0 balance!");
    console.log("   Please fund your account on BuildBear Faucet\n");
  }

  // Get the contract factory
  console.log("📝 Getting contract factory...");
  const ActivityLogger = await hre.ethers.getContractFactory("ActivityLogger");
  
  // Deploy the contract
  console.log("🚀 Deploying contract...");
  const activityLogger = await ActivityLogger.deploy();
  
  // Wait for deployment to complete
  console.log("⏳ Waiting for deployment confirmation...");
  await activityLogger.waitForDeployment();
  
  const contractAddress = await activityLogger.getAddress();
  const deploymentTx = activityLogger.deploymentTransaction();
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ CONTRACT DEPLOYED SUCCESSFULLY!");
  console.log("=".repeat(70));
  console.log(`\n📍 Contract Address: ${contractAddress}`);
  console.log(`🔗 Transaction Hash: ${deploymentTx.hash}`);
  console.log(`⛽ Gas Used: ${deploymentTx.gasLimit.toString()}`);
  console.log("=".repeat(70));
  
  // Test the contract
  console.log("\n🧪 Testing contract functionality...");
  try {
    // Test 1: Get initial log count
    const initialCount = await activityLogger.logCount();
    console.log(`✅ Initial log count: ${initialCount}`);
    
    // Test 2: Create a test log
    console.log("\n📝 Creating test log...");
    const testTx = await activityLogger.logActivity(
      "DEPLOYMENT_TEST",
      "CREATE",
      "Contract",
      1,
      "system",
      "Contract deployed and tested successfully",
      "0x" + "0".repeat(64) // Dummy hash for testing
    );
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await testTx.wait();
    console.log(`✅ Test log created! Transaction: ${receipt.hash}`);
    
    // Test 3: Verify log was created
    const newCount = await activityLogger.logCount();
    console.log(`✅ New log count: ${newCount}`);
    
    // Test 4: Retrieve the log
    const log = await activityLogger.getLog(0);
    console.log(`✅ Log retrieved successfully`);
    console.log(`   Service: ${log.serviceIdentifier}`);
    console.log(`   Action: ${log.action}`);
    console.log(`   Actor: ${log.actorUsername}`);
    
    console.log("\n🎉 All tests passed!");
    
  } catch (error) {
    console.log("\n⚠️  Test failed:", error.message);
  }
  
  // Save configuration
  console.log("\n" + "=".repeat(70));
  console.log("📋 CONFIGURATION INSTRUCTIONS");
  console.log("=".repeat(70));
  console.log("\n1️⃣  Update your .env file with:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log("\n2️⃣  Restart your FastAPI blockchain service (port 9005)");
  console.log("\n3️⃣  Test the API:");
  console.log("   • Status: http://localhost:9005/blockchain/status");
  console.log("   • API Docs: http://localhost:9005/docs");
  console.log("\n4️⃣  View on BuildBear Explorer:"); 
  console.log(`   https://explorer.buildbear.io/intimate-warmachine-5f7e8f8e/address/${contractAddress}`);
  
  console.log("\n" + "=".repeat(70));
  console.log("✨ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70) + "\n");
  
  return contractAddress;
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });