import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Ticket", function () {
  async function deployTicketFixture() {
    const signers = await ethers.getSigners();
    const name = "TicketName";
    const symbol = "TN";

    const TicketFactory = await ethers.getContractFactory("Ticket");
    const ticket = await TicketFactory.deploy(name, symbol);
    await ticket.deployed();

    return {
      ticket,
      name,
      symbol,
      owner: signers[0],
      signers: signers.slice(1),
    };
  }

  describe("Deployment", function () {
    it("Should set name and symbol", async function () {
      const { ticket, name, symbol } = await loadFixture(deployTicketFixture);

      expect(await ticket.name()).to.equal(name);
      expect(await ticket.symbol()).to.equal(symbol);
    });
  });

  describe("MintAndTransferTo", function () {
    it("Should mint and transfer tickets", async function () {
      const { ticket, signers } = await loadFixture(deployTicketFixture);
      const numberOfTickets = 2;

      await ticket.mintAndTransferTo(numberOfTickets, signers[3].address);

      expect(await ticket.balanceOf(signers[3].address)).to.equal(
        numberOfTickets
      );
    });

    it("Should reject buying zero tickets", async function () {
      const { ticket, signers } = await loadFixture(deployTicketFixture);

      await expect(
        ticket.mintAndTransferTo(0, signers[3].address)
      ).to.be.revertedWith("Cannot buy 0 tickets");
    });
  });
});
