import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Ticket } from "../typechain-types";
import { simulateUsersInteractions } from "./utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function resolveTicketContract(ticketAddres: string): Promise<Ticket> {
  console.log("Resolving the Ticket contract");
  const Ticket = await ethers.getContractFactory("Ticket");
  if (ticketAddres) {
    return Ticket.attach(ticketAddres);
  }
  console.log("Ticket address was not provided, deploying a new one");
  const ticket = await Ticket.deploy();
  await ticket.deployed();
  console.log("Ticket deployed at address '%s'", ticket.address);
  return ticket;
}

module.exports = async (
  ticketAddres: string,
  numberOfLotteriesToSimulate: number = 1,
  lotteryDurationInHours: number = 1,
  ticketPrice: BigNumber = ethers.utils.parseEther("0.001")
) => {
  const ticket = await resolveTicketContract(ticketAddres);
  const signers = await ethers.getSigners();
  for (let index = 0; index < numberOfLotteriesToSimulate; index++) {
    console.log("\nStarting lottery number '%d'", index);
    await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);
    await simulateUsersInteractions(signers, ticket);
    await time.increase(lotteryDurationInHours * 60 * 60 * 60);
    await ticket.selectWinner();
  }
};
