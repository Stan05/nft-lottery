import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { simulateUsersInteractions } from "./utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LotteryEngine, Proxy__factory, Ticket } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function resolveProxyContract(
  proxyAddress: string,
  owner: SignerWithAddress
): Promise<LotteryEngine> {
  console.log("Resolving the Proxy contract");
  if (proxyAddress) {
    return (await ethers.getContractFactory("LotteryEngine")).attach(
      proxyAddress
    );
  }
  console.log("Proxy address was not provided, proceeding with setup.");

  const Ticket = await ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy("LotteryTicketNFT", "LTNFT");
  await ticket.deployed();
  console.log("Ticket deployed at address '%s'", ticket.address);

  const LotteryEngine = await ethers.getContractFactory("LotteryEngine");
  const lotteryEngine = await LotteryEngine.deploy();
  await lotteryEngine.deployed();
  await lotteryEngine.initialize();
  console.log("Lottery Engine deployed at address '%s'", lotteryEngine.address);

  const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
  const proxyFactory = await ProxyFactory.deploy();
  await proxyFactory.deployed();
  console.log("Proxy Factory deployed at '%s'", proxyFactory.address);
  const salt = Math.floor(Math.random() * 10);

  const newProxyAddress = await proxyFactory.getAddress(
    Proxy__factory.bytecode,
    salt
  );
  console.log("Deploying Proxy using Factory at address '%s'", newProxyAddress);
  await proxyFactory.deploy(salt, lotteryEngine.address, owner.address);

  // Has to set the used ticket through proxy, so that the address is kept in the proxy storage
  const proxiedLotteryEngine = LotteryEngine.attach(newProxyAddress);
  await proxiedLotteryEngine.setTicket(ticket.address);
  return proxiedLotteryEngine;
}

module.exports = async (
  proxyAddress: string,
  numberOfLotteriesToSimulate: number = 1,
  lotteryDurationInHours: number = 1,
  ticketPrice: BigNumber = ethers.utils.parseEther("0.001")
) => {
  const signers = await ethers.getSigners();
  const owner = signers[0];
  const users = signers.slice(1);
  const proxy = await resolveProxyContract(proxyAddress, owner);

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
    await simulateUsersInteractions(users, proxy);
    await time.increase(lotteryDurationInHours * 60 * 60 * 60);
    await proxy.selectWinner();
    console.log("Finished lottery itteration '%d'", index);
  }
};
