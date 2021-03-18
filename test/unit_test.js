const { ethers, waffle } = require("hardhat");
const { BigNumber } = require("ethers");
const { expect, assert } = require("chai");
const toWei = ethers.utils.parseEther;

describe("SushiYieldSource", function () {
  let sushi;
  let sushiBar;
  let wallet;
  let wallets;

  before(async function () {
    wallets = await ethers.getSigners();
    wallet = wallets[0];

    const exchangeWalletAddress = "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [exchangeWalletAddress],
    });

    exchangeWallet = await waffle.provider.getSigner(exchangeWalletAddress);
    sushi = await ethers.getVerifiedContractAt(
      "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
      exchangeWallet
    );

    sushiBar = await ethers.getVerifiedContractAt(
      "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272"
    );

    sushiDecimals = await sushi.decimals();

    await sushi.transfer(
      wallet.address,
      BigNumber.from(10000).mul(BigNumber.from(10).pow(sushiDecimals))
    );

    factory = await ethers.getContractFactory(
      "SushiYieldSource",
      "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
      "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272"
    );
  });

  beforeEach(async function () {
    wallets = await ethers.getSigners();
    wallet = wallets[0];

    yieldSource = await factory.deploy(sushiBar.address, sushi.address, {
      gasLimit: 9500000,
    });
  });

  it("get token address", async function () {
    expect((await yieldSource.depositToken()) == sushi);
  });

  it("supplyTokenTo and redeemToken", async function () {
    await sushi.connect(wallet).approve(yieldSource.address, toWei("100"));
    await yieldSource.supplyTokenTo(toWei("100"), wallet.address);
    expect(await yieldSource.balanceOfToken(wallet.address)) == toWei("100");
    await yieldSource.redeemToken(toWei("100"));
    expect((await sushi.balanceOf(wallet.address)) == toWei("10000"));
  });

  it("prevent funds from being taken by unauthorized", async function () {
    await sushi.connect(wallet).approve(yieldSource.address, toWei("100"));
    await yieldSource.supplyTokenTo(toWei("100"), wallet.address);

    await expect(
      yieldSource.connect(wallets[1]).redeemToken(toWei("100"))
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });

  it("is not affected by token transfered by accident", async function () {
    await sushi.connect(wallet).transfer(yieldSource.address, toWei("100"));

    expect(await yieldSource.balanceOfToken(wallet.address)) == 0;
  });
});