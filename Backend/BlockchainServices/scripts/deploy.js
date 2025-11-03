const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ActivityLogger contract to BuildBear...\n");

  // Get the contract factory
  const ActivityLogger = await hre.ethers.getContractFactory("ActivityLogger");
  
  // Deploy the contract
  console.log("📝 Deploying contract...");
  const activityLogger = await ActivityLogger.deploy();
  
  // Wait for deployment to complete
  await activityLogger.waitForDeployment();
  
  const contractAddress = await activityLogger.getAddress();
  
  console.log("\n✅ ActivityLogger deployed successfully!");
  console.log("═".repeat(70));
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log("═".repeat(70));
  
  console.log("\n📋 Next Steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Set it as CONTRACT_ADDRESS environment variable in your .env file:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log("3. Restart your blockchain service (port 9005)");
  console.log("\n4. Test the contract:");
  console.log(`   - Status endpoint: http://localhost:9005/blockchain/status`);
  console.log(`   - API docs: http://localhost:9005/docs`);
  
  // Test the contract
  console.log("\n🧪 Testing contract...");
  try {
    const logCount = await activityLogger.getLogCount();
    console.log(`✅ Initial log count: ${logCount}`);
    
    // Create a test log
    console.log("📝 Creating test log...");
    const tx = await activityLogger.logActivity(
      "DEPLOYMENT_TEST",
      "CREATE",
      "Contract",
      1,
      "system",
      "Contract deployed and tested",
      "0x" + "0".repeat(64) // Dummy hash
    );
    
    await tx.wait();
    console.log(`✅ Test log created! Transaction: ${tx.hash}`);
    
    const newLogCount = await activityLogger.getLogCount();
    console.log(`✅ New log count: ${newLogCount}`);
    
  } catch (error) {
    console.log("⚠️  Test failed:", error.message);
  }
  
  console.log("\n═".repeat(70));
  console.log("🎉 Deployment complete!");
  console.log("═".repeat(70));
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });