import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Ticket", function () {
  async function deployTicketFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const ticketPrice = ethers.utils.parseEther("0.001");
    const lotteryDurationInHours = 1;

    const TicketFactory = await ethers.getContractFactory("Ticket");
    const ticket = await TicketFactory.deploy();

    return { ticket, owner, otherAccount, ticketPrice, lotteryDurationInHours };
  }

  describe("Deployment", function () {
    it("Should set active lottery to false", async function () {
      const { ticket } = await loadFixture(deployTicketFixture);

      expect(await ticket.isLotteryActive()).to.be.false;
    });

    it("Should set the right owner", async function () {
      const { ticket, owner } = await loadFixture(deployTicketFixture);

      expect(await ticket.owner()).to.equal(owner.address);
    });

    it("Should set prize pool to 0", async function () {
      const { ticket } = await loadFixture(deployTicketFixture);

      expect(await ticket.prizePool()).to.equal(0);
    });
  });

  describe("Buy Tickets", function () {
    describe("Validations", function () {
      it("Should reject buying tickets when lottery is not active", async function () {
        const { ticket } = await loadFixture(deployTicketFixture);

        await expect(ticket.buyTickets(2)).to.be.revertedWithCustomError(
          ticket,
          "LotteryIsNotActive"
        );
      });

      it("Should reject buying more than allowed tickets", async function () {
        const { ticket } = await loadFixture(deployTicketFixture);

        await expect(ticket.buyTickets(257)).eventually.to.rejectedWith(
          "value out-of-bounds"
        );
      });

      it("Should reject buying tickets when funds are not enough", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await expect(
          ticket.buyTickets(2, { value: ticketPrice })
        ).to.be.revertedWith("Not enough funds");
      });
    });

    describe("Events", function () {
      it("Should emit an event when buy tickets", async function () {
        const { ticket, otherAccount, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);
        const numberOfTickets = 3;

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await expect(
          ticket.connect(otherAccount).buyTickets(numberOfTickets, {
            value: ticketPrice.mul(numberOfTickets),
          })
        )
          .to.emit(ticket, "TicketsBought")
          .withArgs(otherAccount.address, numberOfTickets);
      });
    });

    describe("Transfers", function () {
      it("Should transfer bought tickets", async function () {
        const { ticket, otherAccount, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);
        const numberOfTickets = 4;

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await ticket.connect(otherAccount).buyTickets(numberOfTickets, {
          value: ticketPrice.mul(numberOfTickets),
        });

        expect(await ticket.balanceOf(otherAccount.address)).to.equal(
          numberOfTickets
        );
      });

      it("Should increase pool size for current lottery", async function () {
        const { ticket, otherAccount, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);
        const numberOfTickets = 4;

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await ticket.connect(otherAccount).buyTickets(numberOfTickets, {
          value: ticketPrice.mul(numberOfTickets),
        });

        expect(await ticket.prizePool()).to.equal(
          ticketPrice.mul(numberOfTickets)
        );
      });

      it("Should increase user stakes in current lottery", async function () {
        const { ticket, otherAccount, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);
        const numberOfTickets = 4;

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await ticket.connect(otherAccount).buyTickets(numberOfTickets, {
          value: ticketPrice.mul(numberOfTickets),
        });

        expect(
          await ticket.connect(otherAccount).stakesInCurrentLottery()
        ).to.equal(numberOfTickets);
      });
    });
  });

  describe("Start New Lottery", function () {
    describe("Validations", function () {
      it("Should reject starting new lottery when there is one active", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await expect(
          ticket.startNewLottery(lotteryDurationInHours, ticketPrice)
        ).to.be.revertedWith("There is an active lottery");
      });

      it("Should reject starting new lottery when the last finished lottery is not claimed", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(
          ticket.startNewLottery(lotteryDurationInHours, ticketPrice)
        ).to.be.revertedWith("Current lottery is still not claimed");
      });
    });

    describe("Events", function () {
      it("Should emit an event on starting a new lottery", async function () {
        const { ticket, ticketPrice } = await loadFixture(deployTicketFixture);

        await expect(ticket.startNewLottery(1, ticketPrice))
          .to.emit(ticket, "LotteryStarted")
          .withArgs(anyValue, anyValue, ticketPrice);
      });
    });
  });

  describe("Draw Winner", function () {
    describe("Validations", function () {
      it("Should reject drawing winner when lottery is active", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);
        await expect(ticket.selectWinner()).to.revertedWith(
          "Lottery is still active"
        );
      });

      it("Should reject drawing winner when not called by owner", async function () {
        const { ticket, otherAccount, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);
        await expect(
          ticket.connect(otherAccount).selectWinner()
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Events", function () {
      it("Should emit event on selecting winner", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(ticket.selectWinner()).to.emit(ticket, "WinnerSelected");
      });
    });

    describe("Functionality", function () {
      it("Should set current state claimed", async function () {
        const { ticket, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployTicketFixture);

        await ticket.startNewLottery(lotteryDurationInHours, ticketPrice);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(ticket.selectWinner()).to.revertedWith(
          "Lottery is still active"
        );
      });
    });
  });
});
