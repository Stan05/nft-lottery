import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Proxy", function () {
  async function deployProxyFixture() {
    const signers = await ethers.getSigners();

    const LotteryEngine = await ethers.getContractFactory("LotteryEngine");
    const lotteryEngine = await LotteryEngine.deploy();
    await lotteryEngine.deployed();
    await lotteryEngine.initialize();

    const ProxyFactory = await ethers.getContractFactory("Proxy");
    const proxy = await ProxyFactory.deploy();
    await proxy.deployed();
    await proxy.initialize(lotteryEngine.address);

    return {
      proxy,
      lotteryEngine,
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
});
