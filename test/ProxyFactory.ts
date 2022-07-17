import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Proxy__factory } from "../typechain-types";

describe("Proxy", function () {
  async function deployProxyFactoryFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0];

    const LotteryEngine = await ethers.getContractFactory("LotteryEngine");
    const lotteryEngine = await LotteryEngine.deploy();
    await lotteryEngine.deployed();
    await lotteryEngine.initialize();

    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    const proxyFactory = await ProxyFactory.deploy();
    await proxyFactory.deployed();

    return {
      proxyFactory,
      lotteryEngine,
      owner,
      signers: signers.slice(1),
    };
  }

  describe("Deploy", function () {
    it("Should deploy Proxy with create2", async function () {
      const { lotteryEngine, proxyFactory, owner } = await loadFixture(
        deployProxyFactoryFixture
      );
      const salt = Math.floor(Math.random() * 10);

      const expectedAddress = await proxyFactory.getAddress(
        Proxy__factory.bytecode,
        salt
      );
      await expect(
        await proxyFactory
          .connect(owner)
          .deploy(salt, lotteryEngine.address, owner.address)
      )
        .to.emit(proxyFactory, "Deployed")
        .withArgs(expectedAddress);
    });
  });
});
