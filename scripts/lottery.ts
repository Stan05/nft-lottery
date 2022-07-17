import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { simulateUsersInteractions } from "./utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Ticket } from "../typechain-types";

async function resolveProxyContract(proxyAddress: string): Promise<Ticket> {
  console.log("Resolving the Proxy contract");
  const Proxy = await ethers.getContractFactory("Proxy");
  if (proxyAddress) {
    return (await ethers.getContractFactory("Ticket")).attach(proxyAddress);
  }
  console.log(
    "Proxy address was not provided, deploying new Ticket and Proxy."
  );

  const Ticket = await ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy();
  await ticket.deployed();
  await ticket.initialize();
  console.log("Ticket deployed at address '%s'", ticket.address);

  const proxy = await Proxy.deploy();
  await proxy.deployed();
  await proxy.initialize(ticket.address);
  console.log("Proxy deployed at address '%s'", proxy.address);

  console.log("Proxy owner is '%s'", await proxy.owner());
  console.log("Ticket owner is '%s'", await ticket.owner());
  return Ticket.attach(proxy.address);
}

module.exports = async (
  proxyAddress: string,
  numberOfLotteriesToSimulate: number = 1,
  lotteryDurationInHours: number = 1,
  ticketPrice: BigNumber = ethers.utils.parseEther("0.001")
) => {
  const proxy = await resolveProxyContract(proxyAddress);
  const signers = await ethers.getSigners();

  proxy.on(proxy.filters.WinnerSelected(), (user, prize, lotteryItteration) => {
    console.log(
      "Winner Selected Event Received: '%s' has won '%d' from lottery itteration '%d' ",
      user,
      ethers.utils.formatEther(prize),
      lotteryItteration
    );
  });

  for (let index = 1; index <= numberOfLotteriesToSimulate; index++) {
    console.log("\nStarting lottery itteration '%d'", index);
    await proxy.startNewLottery(lotteryDurationInHours, ticketPrice);
    await simulateUsersInteractions(signers, proxy);
    await time.increase(lotteryDurationInHours * 60 * 60 * 60);
    await proxy.selectWinner();
    console.log(
      "Finished lottery itteration '%d', waiting for winner to be selected",
      index
    );
  }
};
