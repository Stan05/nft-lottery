import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Proxy", function () {
  async function deployProxyFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0];

    const LotteryEngine = await ethers.getContractFactory("LotteryEngine");
    const lotteryEngine = await LotteryEngine.deploy();
    await lotteryEngine.deployed();
    await lotteryEngine.initialize();

    const ProxyFactory = await ethers.getContractFactory("Proxy");
    const proxy = await ProxyFactory.deploy();
    await proxy.deployed();
    await proxy.initialize(lotteryEngine.address, owner.address);

    return {
      proxy: proxy,
      proxiedLotteryEngine: LotteryEngine.attach(proxy.address),
      lotteryEngine: lotteryEngine,
      owner: signers[0],
      signers: signers.slice(1),
    };
  }

  describe("Deployment", function () {
    it("Should initialize implementation", async function () {
      const { proxy, lotteryEngine } = await loadFixture(deployProxyFixture);

      expect(await proxy.implementation()).to.equal(lotteryEngine.address);
    });

    it("Should initialize owner", async function () {
      const { proxy, owner } = await loadFixture(deployProxyFixture);

      expect(await proxy.owner()).to.equal(owner.address);
    });
  });

  describe("DelegateCall", function () {
    describe("Validations", function () {
      it("Should reject delegating when no implementation set", async function () {
        const ProxyFactory = await ethers.getContractFactory("Proxy");
        const proxy = await ProxyFactory.deploy();
        await proxy.deployed();

        await expect(proxy.fallback()).to.be.revertedWith(
          "Implementation is not set"
        );
      });
    });

    describe("Functionalities", function () {
      it("Should proxy call to implementation", async function () {
        const { proxiedLotteryEngine } = await loadFixture(deployProxyFixture);
        await proxiedLotteryEngine.startNewLottery(
          1,
          ethers.utils.parseEther("0.001")
        );

        expect(await proxiedLotteryEngine.isLotteryActive()).to.be.equal(true);
        //expect('').to.be.calledOnContractWith(token, [wallet.address]);
      });
    });
  });
});
