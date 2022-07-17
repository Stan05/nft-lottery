import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { simulateUsersInteractions } from "../scripts/utils";

describe("LotteryEngine", function () {
  async function deployLotteryEngineFixture() {
    const signers = await ethers.getSigners();
    const ticketPrice = ethers.utils.parseEther("0.001");
    const lotteryDurationInHours = 1;

    const LotteryEngineFactory = await ethers.getContractFactory(
      "LotteryEngine"
    );
    const lotteryEngine = await LotteryEngineFactory.deploy();
    await lotteryEngine.deployed();

    lotteryEngine.initialize();

    const TicketFactory = await ethers.getContractFactory("Ticket");
    const ticket = await TicketFactory.deploy("TicketName", "TN");
    await ticket.deployed();

    lotteryEngine.setTicket(ticket.address);

    return {
      lotteryEngine,
      ticket,
      owner: signers[0],
      signers: signers.slice(1),
      ticketPrice,
      lotteryDurationInHours,
    };
  }

  describe("Deployment", function () {
    it("Should set active lottery to false", async function () {
      const { lotteryEngine } = await loadFixture(deployLotteryEngineFixture);

      expect(await lotteryEngine.isLotteryActive()).to.be.false;
    });

    it("Should set the right owner", async function () {
      const { lotteryEngine, owner } = await loadFixture(
        deployLotteryEngineFixture
      );

      expect(await lotteryEngine.owner()).to.equal(owner.address);
    });

    it("Should set prize pool to 0", async function () {
      const { lotteryEngine } = await loadFixture(deployLotteryEngineFixture);

      expect(await lotteryEngine.prizePool()).to.equal(0);
    });

    it("Should set ticket price to 0", async function () {
      const { lotteryEngine } = await loadFixture(deployLotteryEngineFixture);

      expect(await lotteryEngine.ticketPrice()).to.equal(0);
    });
  });

  describe("Buy Tickets", function () {
    describe("Validations", function () {
      it("Should reject buying tickets when lottery is not active", async function () {
        const { lotteryEngine } = await loadFixture(deployLotteryEngineFixture);

        await expect(lotteryEngine.buyTickets(2)).to.be.revertedWithCustomError(
          lotteryEngine,
          "LotteryIsNotActive"
        );
      });

      it("Should reject buying more than allowed tickets", async function () {
        const { lotteryEngine } = await loadFixture(deployLotteryEngineFixture);

        await expect(lotteryEngine.buyTickets(257)).eventually.to.rejectedWith(
          "value out-of-bounds"
        );
      });

      it("Should reject buying zero tickets", async function () {
        const { lotteryEngine, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(
          lotteryEngine.buyTickets(0, { value: ticketPrice })
        ).to.be.revertedWith("Cannot buy 0 tickets");
      });

      it("Should reject buying tickets when funds are not enough", async function () {
        const { lotteryEngine, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(
          lotteryEngine.buyTickets(2, { value: ticketPrice })
        ).to.be.revertedWith("Not enough funds");
      });
    });

    describe("Events", function () {
      it("Should emit an event when buy tickets", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);
        const numberOfTickets = 3;

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(
          lotteryEngine.connect(signers[0]).buyTickets(numberOfTickets, {
            value: ticketPrice.mul(numberOfTickets),
          })
        )
          .to.emit(lotteryEngine, "TicketsBought")
          .withArgs(signers[0].address, numberOfTickets);
      });
    });

    describe("Functionality", function () {
      it("Should transfer bought tickets", async function () {
        const {
          lotteryEngine,
          ticket,
          signers,
          ticketPrice,
          lotteryDurationInHours,
        } = await loadFixture(deployLotteryEngineFixture);
        const numberOfTickets = 4;

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await lotteryEngine.connect(signers[0]).buyTickets(numberOfTickets, {
          value: ticketPrice.mul(numberOfTickets),
        });

        expect(await ticket.balanceOf(signers[0].address)).to.equal(
          numberOfTickets
        );
      });

      it("Should increase prize pool for current lottery", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);
        const numberOfTickets = 4;

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await lotteryEngine.connect(signers[0]).buyTickets(numberOfTickets, {
          value: ticketPrice.mul(numberOfTickets),
        });

        expect(await lotteryEngine.prizePool()).to.equal(
          ticketPrice.mul(numberOfTickets)
        );
      });
    });
  });

  describe("Start New Lottery", function () {
    describe("Validations", function () {
      it("Should reject starting new lottery when there is one active", async function () {
        const { lotteryEngine, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(
          lotteryEngine.startNewLottery(lotteryDurationInHours, ticketPrice)
        ).to.be.revertedWith("There is an active lottery");
      });

      it("Should reject starting new lottery when the last finished lottery is not claimed", async function () {
        const { lotteryEngine, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(
          lotteryEngine.startNewLottery(lotteryDurationInHours, ticketPrice)
        ).to.be.revertedWith("Current lottery is still not claimed");
      });

      it("Should reject starting new lottery when not called by owner", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await expect(
          lotteryEngine
            .connect(signers[0])
            .startNewLottery(lotteryDurationInHours, ticketPrice)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Events", function () {
      it("Should emit an event on starting a new lottery", async function () {
        const { lotteryEngine, ticketPrice } = await loadFixture(
          deployLotteryEngineFixture
        );

        await expect(lotteryEngine.startNewLottery(1, ticketPrice))
          .to.emit(lotteryEngine, "LotteryStarted")
          .withArgs(anyValue, anyValue, ticketPrice);
      });
    });
  });

  describe("Select Winner", function () {
    describe("Validations", function () {
      it("Should reject selecting a winner when lottery is active", async function () {
        const { lotteryEngine, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(lotteryEngine.selectWinner()).to.revertedWith(
          "Lottery is still active"
        );
      });

      it("Should reject selecting a winner second time for same lottery", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await simulateUsersInteractions(signers, lotteryEngine);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await lotteryEngine.selectWinner();

        await expect(lotteryEngine.selectWinner()).to.revertedWith(
          "Lottery has already been claimed"
        );
      });

      it("Should reject selecting a winner when not called by owner", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await expect(
          lotteryEngine.connect(signers[0]).selectWinner()
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Events", function () {
      it("Should emit event on selecting winner", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await simulateUsersInteractions(signers, lotteryEngine);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(lotteryEngine.selectWinner())
          .to.emit(lotteryEngine, "WinnerSelected")
          .withArgs(
            anyValue,
            (await lotteryEngine.prizePool()).div(2),
            anyValue
          );
      });
    });

    describe("Functionality", function () {
      it("Should send the prize to the winner from contract balance", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await simulateUsersInteractions(signers, lotteryEngine);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        const prizePool = await lotteryEngine.prizePool();
        const initialBalance = await ethers.provider.getBalance(
          lotteryEngine.address
        );

        await expect(lotteryEngine.selectWinner()).to.be.not.reverted;

        expect(
          await ethers.provider.getBalance(lotteryEngine.address)
        ).to.equal(initialBalance.sub(prizePool.div(2)));
      });
    });
  });

  describe("Set Ticket", function () {
    describe("Validations", function () {
      it("Should reject setting a ticket which is not IERC721 interface", async function () {
        const { lotteryEngine, signers } = await loadFixture(
          deployLotteryEngineFixture
        );

        await expect(
          lotteryEngine.setTicket(lotteryEngine.address)
        ).to.revertedWithCustomError(lotteryEngine, "TicketNotSupportERC721");
      });

      it("Should reject setting a ticket while there is an active lottery", async function () {
        const { lotteryEngine, ticket, lotteryDurationInHours, ticketPrice } =
          await loadFixture(deployLotteryEngineFixture);

        lotteryEngine.startNewLottery(lotteryDurationInHours, ticketPrice);

        await expect(lotteryEngine.setTicket(ticket.address)).to.revertedWith(
          "Cannot change ticket while there is active lottery"
        );
      });

      it("Should reject when not called by owner", async function () {
        const { lotteryEngine, signers } = await loadFixture(
          deployLotteryEngineFixture
        );

        await expect(
          lotteryEngine.connect(signers[1]).setTicket(signers[1].address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Events", function () {
      it("Should emit event on set a new ticket", async function () {
        const { lotteryEngine, signers, ticketPrice, lotteryDurationInHours } =
          await loadFixture(deployLotteryEngineFixture);

        await lotteryEngine.startNewLottery(
          lotteryDurationInHours,
          ticketPrice
        );

        await simulateUsersInteractions(signers, lotteryEngine);

        await time.increase(lotteryDurationInHours * 60 * 60 * 60);

        await expect(lotteryEngine.selectWinner())
          .to.emit(lotteryEngine, "WinnerSelected")
          .withArgs(
            anyValue,
            (await lotteryEngine.prizePool()).div(2),
            anyValue
          );
      });
    });

    describe("Functionality", function () {
      it("Should set new ticket", async function () {
        const { lotteryEngine, ticket } = await loadFixture(
          deployLotteryEngineFixture
        );

        const TicketFactory = await ethers.getContractFactory("Ticket");
        const newTicket = await TicketFactory.deploy("TicketName2", "TN2");
        await newTicket.deployed();

        expect(await lotteryEngine.ticket()).to.equal(ticket.address);
        expect(await lotteryEngine.setTicket(newTicket.address)).to.not.be
          .reverted;
        expect(await lotteryEngine.ticket()).to.equal(newTicket.address);
      });
    });
  });
});
