import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const config = {
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    ...(process.env.BUILDBEAR_RPC_URL && process.env.PRIVATE_KEY ? {
      buildbear: {
        url: process.env.BUILDBEAR_RPC_URL,
        accounts: [process.env.PRIVATE_KEY]
      }
    } : {})
  }
};

export default config;
