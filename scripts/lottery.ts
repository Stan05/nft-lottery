import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { simulateUsersInteractions } from "./utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LotteryEngine, Ticket } from "../typechain-types";

async function resolveProxyContract(
  proxyAddress: string
): Promise<LotteryEngine> {
  console.log("Resolving the Proxy contract");
  const Proxy = await ethers.getContractFactory("Proxy");
  if (proxyAddress) {
    return (await ethers.getContractFactory("LotteryEngine")).attach(
      proxyAddress
    );
  }
  console.log(
    "Proxy address was not provided, deploying new Ticket and Proxy."
  );

  const Ticket = await ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy("LotteryTicketNFT", "LTNFT");
  await ticket.deployed();
  console.log("Ticket deployed at address '%s'", ticket.address);

  const LotteryEngine = await ethers.getContractFactory("LotteryEngine");
  const lotteryEngine = await LotteryEngine.deploy();
  await lotteryEngine.deployed();
  await lotteryEngine.initialize();
  console.log("Lottery Engine deployed at address '%s'", lotteryEngine.address);

  const proxy = await Proxy.deploy();
  await proxy.deployed();
  await proxy.initialize(lotteryEngine.address);
  console.log("Proxy deployed at address '%s'", proxy.address);

  console.log("Proxy owner is '%s'", await proxy.owner());
  console.log("LotteryEngine owner is '%s'", await lotteryEngine.owner());

  // Has to set the used ticket through proxy, so that the address is kept in the proxy storage
  const proxiedLotteryEngine = LotteryEngine.attach(proxy.address);
  await proxiedLotteryEngine.setTicket(ticket.address);
  return proxiedLotteryEngine;
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
      "Winner Selected Event Received: '%s' has won Ξ%d from lottery itteration '%d' ",
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
    console.log("Finished lottery itteration '%d'", index);
  }
};
