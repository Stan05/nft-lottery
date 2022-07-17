import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "hardhat-storage-layout";

task("storage-layout", "Output the storage layout of the contracts").setAction(
  async ({}, hre) => {
    await hre.run("compile");
    await hre.storageLayout.export();
  }
);

task("lottery", "Runs a lottery simulation")
  .addOptionalParam("proxyAddress", "The proxy address to use for the lottery")
  .addOptionalParam(
    "simulations",
    "The number of lottery simulations to be performed"
  )
  .addOptionalParam(
    "duration",
    "The duration of each lottery simulation in hours"
  )
  .addOptionalParam("ticketPrice", "The ticket price of the lottery")
  .setAction(
    async ({ proxyAddress, simulations, duration, ticketPrice }, hre) => {
      await hre.run("compile");
      const lottery = require("./scripts/lottery");
      return await lottery(proxyAddress, simulations, duration, ticketPrice);
    }
  );

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
};

export default config;
