// scripts/test.js
import hre from "hardhat";
import fs from 'fs';

async function main() {
  // Read contract info
  const contractInfo = JSON.parse(fs.readFileSync('./contract-info.json', 'utf8'));
  const contractAddress = contractInfo.address;
  const contractABI = contractInfo.abi;

  // Get signer
  const [signer] = await hre.ethers.getSigners();

  // Attach to deployed contract
  const ActivityLog = new hre.ethers.Contract(contractAddress, contractABI, signer);

  console.log("Testing ActivityLog contract at:", contractAddress);

  // Test logActivity
  console.log("Logging an activity...");
  const tx = await ActivityLog.logActivity(
    "test-service",
    "POST",
    "discount",
    123,
    signer.address,
    "testuser",
    "Created new discount",
    hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test data"))
  );
  await tx.wait();
  console.log("Activity logged successfully");

  // Test getTotalLogs
  const totalLogs = await ActivityLog.getTotalLogs();
  console.log("Total logs:", totalLogs.toString());

  // Test getLog
  const log = await ActivityLog.getLog(0);
  console.log("Retrieved log:", {
    timestamp: log[0].toString(),
    serviceIdentifier: log[1],
    action: log[2],
    entityType: log[3],
    entityId: log[4].toString(),
    actor: log[5],
    actorUsername: log[6],
    changeDescription: log[7],
    dataHash: log[8]
  });

  // Test getLogsByService
  const logsByService = await ActivityLog.getLogsByService("test-service");
  console.log("Logs by service:", logsByService.map(id => id.toString()));

  console.log("All basic tests passed!");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exitCode = 1;
});
