import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";

task("lottery", "Runs a lottery simulation")
  .addOptionalParam(
    "ticketAddress",
    "The ticket address to use for the lottery"
  )
  .addOptionalParam(
    "simulations",
    "The number of lottery simulations to be performed"
  )
  .addOptionalParam(
    "duration",
    "The duration of each lottery simulation in hours"
  )
  .addOptionalParam("ticketPrice", "The ticket price of the lottery")
  .setAction(async ({ ticketAddress, simulations, duration, ticketPrice }) => {
    const lottery = require("./scripts/lottery");
    return await lottery(ticketAddress, simulations, duration, ticketPrice);
  });

const config: HardhatUserConfig = {
  solidity: "0.8.9",
};

export default config;
