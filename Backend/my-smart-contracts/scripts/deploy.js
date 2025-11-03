// scripts/deploy.js
import hre from "hardhat";
import fs from 'fs';

async function main() {
  const ActivityLog = await hre.ethers.getContractFactory("ActivityLog");
  const activityLog = await ActivityLog.deploy();

  await activityLog.waitForDeployment();

  console.log("ActivityLog deployed to:", await activityLog.getAddress());

  // Save the address for your backend
  const contractAddress = {
    address: await activityLog.getAddress(),
    abi: activityLog.interface.format('json')
  };

  fs.writeFileSync(
    './contract-info.json',
    JSON.stringify(contractAddress, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
