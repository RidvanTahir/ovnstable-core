const hre = require("hardhat");
const {deployments, ethers} = require("hardhat");
const {resetHardhat} = require("@overnight-contracts/common/utils/tests");
const {toE6, toE18, fromE6, fromAsset} = require("@overnight-contracts/common/utils/decimals");
const {expect} = require("chai");
const {sharedBeforeEach} = require("@overnight-contracts/common/utils/sharedBeforeEach");
const BigNumber = require('bignumber.js');
const chai = require("chai");
chai.use(require('chai-bignumber')());

const {waffle} = require("hardhat");
const {getContract, execTimelock, getERC20, initWallet} = require("@overnight-contracts/common/utils/script-utils");
const {transferETH, transferUSDPlus} = require("@overnight-contracts/common/utils/script-utils");
const {POLYGON} = require("@overnight-contracts/common/utils/assets");
const {provider} = waffle;

let dQuickToken = '0xf28164A485B0B2C90639E47b0f377b4a438a16B1';
let quickswapWmaticUsdc = '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827';
let quickswapRouter = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff';
let stakingDualRewards = '0x14977e7E263FF79c4c3159F497D9551fbE769625';
let poolFeeMaticUsdc = 500;
let tokenAssetSlippagePercent = 100; //1%
let liquidationThreshold = 850;
let healthFactor = 1200;


describe("POLYGON", function () {
    let value = {
        name: 'StrategyQsWmaticUsdc',
        enabledReward: true,
    };

    strategyTest(value, 'POLYGON', POLYGON.usdPlus, () => {});
});

function strategyTest(strategyParams, network, assetAddress, runStrategyLogic) {

    let values = [
        {
            value: 0.02,
            deltaPercent: 5,
        },
        {
            value: 0.2,
            deltaPercent: 5,
        },
        {
            value: 2,
            deltaPercent: 5,
        },
        {
            value: 20,
            deltaPercent: 1,
        },
        {
            value: 200,
            deltaPercent: 1,
        },
        {
            value: 2000,
            deltaPercent: 1,
        },
        {
            value: 20000,
            deltaPercent: 1,
        },
        {
            value: 200000,
            deltaPercent: 0.1,
        },
    ]

    describe(`${strategyParams.name}`, function () {
        stakeUnstake(strategyParams, network, assetAddress, values, runStrategyLogic);
        claimRewards(strategyParams, network, assetAddress, values, runStrategyLogic);
    });
}

function stakeUnstake(strategyParams, network, assetAddress, values, runStrategyLogic) {

    describe(`Stake/unstake`, function () {

        let account;
        let recipient;

        let strategy;
        let strategyName;

        let asset;
        let toAsset = function () {
        };

        let expectedHealthFactor = '1200000000000000000';
        let healthFactorDELTA = '10000000000000000';

        sharedBeforeEach("deploy", async () => {
            await hre.run("compile");
            const signers = await ethers.getSigners();
            account = signers[0];
            recipient = provider.createEmptyWallet();

            await transferETH(10, recipient.address);
            await transferETH(10, account.address);
            await transferETH(10, (await initWallet()).address);
            await transferUSDPlus(250000, account.address);
            strategyName = strategyParams.name;

            await deployments.fixture([strategyName, 'ControlQsWmaticUsdc']);

            strategy = await ethers.getContract(strategyName);
            let control = await ethers.getContract('ControlQsWmaticUsdc');
            await strategy.setExchanger(recipient.address);

            const exchange = await getContract('Exchange');
            const usdPlus = await getContract('UsdPlusToken');

            let setupParams = {
                // common params
                exchange: exchange.address,
                control: control.address,
                // strategy params
                usdPlus: usdPlus.address,
                wmatic: POLYGON.wMatic,
                usdc: POLYGON.usdc,
                dQuickToken: dQuickToken,
                quickswapWmaticUsdc: quickswapWmaticUsdc,
                quickswapRouter: quickswapRouter,
                stakingDualRewards: stakingDualRewards,
                uniswapV3Router: POLYGON.uniswapV3Router,
                poolFeeMaticUsdc: poolFeeMaticUsdc,
                // aave params
                aavePoolAddressesProvider: POLYGON.aaveProvider,
                tokenAssetSlippagePercent: tokenAssetSlippagePercent,
                liquidationThreshold: liquidationThreshold,
                healthFactor: healthFactor,
            }

            await (await strategy.setParams(setupParams)).wait();

            await execTimelock(async (timelock) => {
                let exchange = await getContract('Exchange');
                console.log(`exchange: ${exchange.address}`);
                await exchange.connect(timelock).grantRole(await exchange.FREE_RIDER_ROLE(), strategy.address);
                console.log(`FREE_RIDER_ROLE granted to ${strategy.address}`);
            });

            asset = await getERC20("usdPlus");
            let decimals = await asset.decimals();
            if (decimals === 18) {
                toAsset = toE18;
            } else {
                toAsset = toE6;
            }

        });

        values.forEach(item => {

            let stakeValue = item.value;
            let deltaPercent = item.deltaPercent ? item.deltaPercent : 5;
            let unstakeValue = stakeValue / 2;

            describe(`Stake ${stakeValue}`, function () {

                let balanceAsset;
                let expectedNetAsset;

                let VALUE;
                let DELTA;

                let netAssetValueCheck;
                let healthFactor;

                sharedBeforeEach(`Stake ${stakeValue}`, async () => {

                    try {
                        await m2m(strategy);

                        let assetValue = toAsset(stakeValue);
                        VALUE = new BigNumber(assetValue);
                        DELTA = VALUE.multipliedBy(new BigNumber(deltaPercent)).div(100);

                        await asset.connect(account).transfer(recipient.address, assetValue);

                        let balanceAssetBefore = new BigNumber((await asset.balanceOf(recipient.address)).toString());
                        expectedNetAsset = (new BigNumber((await strategy.netAssetValue()).toString())).plus(VALUE);
                        console.log(`expectedNetAsset: ${expectedNetAsset}`)

                        await asset.connect(recipient).transfer(strategy.address, assetValue);
                        await strategy.connect(recipient).stake(assetValue);
                        let balanceAssetAfter = new BigNumber((await asset.balanceOf(recipient.address)).toString());
                        balanceAsset = balanceAssetBefore.minus(balanceAssetAfter);
                        netAssetValueCheck = new BigNumber((await strategy.netAssetValue()).toString());
                        console.log(`----------------------`)
                        console.log(`balanceAssetAfter: ${balanceAssetAfter}`)
                        console.log(`balanceAsset: ${balanceAsset}`)
                        console.log(`netAssetValueCheck: ${netAssetValueCheck}`)
                        console.log(`----------------------`)
                        healthFactor = await strategy.currentHealthFactor();

                        await m2m(strategy);
                    } catch (e) {
                        console.log(e)
                        throw e;
                    }
                });

                it(`Balance asset is in range`, async function () {
                    greatLess(balanceAsset, VALUE, DELTA);
                });

                it(`NetAssetValue asset is in range`, async function () {
                    greatLess(netAssetValueCheck, expectedNetAsset, DELTA);
                });

                it(`Health Factor is in range`, async function () {
                    greatLess(healthFactor, expectedHealthFactor, healthFactorDELTA);
                });

                describe(`UnStake ${unstakeValue}`, function () {

                    let balanceAsset;
                    let expectedNetAsset;
                    let expectedLiquidation;

                    let VALUE;
                    let DELTA;

                    let netAssetValueCheck;
                    let healthFactor;

                    sharedBeforeEach(`Unstake ${unstakeValue}`, async () => {

                        await m2m(strategy);
                        let assetValue = toAsset(unstakeValue);
                        VALUE = new BigNumber(assetValue);
                        DELTA = VALUE.times(new BigNumber(deltaPercent)).div(100);

                        let balanceAssetBefore = new BigNumber((await asset.balanceOf(recipient.address)).toString());

                        expectedNetAsset = new BigNumber((await strategy.netAssetValue()).toString()).minus(VALUE);

                        await strategy.connect(recipient).unstake(assetValue, recipient.address);

                        let balanceAssetAfter = new BigNumber((await asset.balanceOf(recipient.address)).toString());

                        balanceAsset = balanceAssetAfter.minus(balanceAssetBefore);

                        netAssetValueCheck = new BigNumber((await strategy.netAssetValue()).toString());
                        healthFactor = await strategy.currentHealthFactor();

                        await m2m(strategy);

                    });

                    it(`Balance asset is in range`, async function () {
                        greatLess(balanceAsset, VALUE, DELTA);
                    });

                    it(`NetAssetValue asset is in range`, async function () {
                        greatLess(netAssetValueCheck, expectedNetAsset, DELTA);
                    });

                    it(`Health Factor is in range`, async function () {
                        greatLess(healthFactor, expectedHealthFactor, healthFactorDELTA);
                    });

                });

            });

        });

    });
}


function claimRewards(strategyParams, network, assetAddress, values, runStrategyLogic) {

    describe(`Stake/ClaimRewards`, function () {

        let account;
        let recipient;

        let strategy;
        let strategyName;

        let usdcToken;
        let asset;
        let toAsset = function () {
        };

        let expectedHealthFactor = '1200000000000000000';
        let healthFactorDELTA = '10000000000000000';

        sharedBeforeEach("deploy", async () => {
            await hre.run("compile");
            const signers = await ethers.getSigners();
            account = signers[0];
            recipient = provider.createEmptyWallet();

            await transferETH(10, recipient.address);
            await transferETH(10, account.address);
            await transferETH(10, (await initWallet()).address);
            await transferUSDPlus(250000, account.address);
            strategyName = strategyParams.name;

            await deployments.fixture([strategyName, 'ControlQsWmaticUsdc']);

            strategy = await ethers.getContract(strategyName);
            let control = await ethers.getContract('ControlQsWmaticUsdc');
            await strategy.setExchanger(recipient.address);

            const exchange = await getContract('Exchange');
            const usdPlus = await getContract('UsdPlusToken');

            let setupParams = {
                // common params
                exchange: exchange.address,
                control: control.address,
                // strategy params
                usdPlus: usdPlus.address,
                wmatic: POLYGON.wMatic,
                usdc: POLYGON.usdc,
                dQuickToken: dQuickToken,
                quickswapWmaticUsdc: quickswapWmaticUsdc,
                quickswapRouter: quickswapRouter,
                stakingDualRewards: stakingDualRewards,
                uniswapV3Router: POLYGON.uniswapV3Router,
                poolFeeMaticUsdc: poolFeeMaticUsdc,
                // aave params
                aavePoolAddressesProvider: POLYGON.aaveProvider,
                tokenAssetSlippagePercent: tokenAssetSlippagePercent,
                liquidationThreshold: liquidationThreshold,
                healthFactor: healthFactor,
            }

            await (await strategy.setParams(setupParams)).wait();

            await execTimelock(async (timelock) => {
                let exchange = await getContract('Exchange');
                console.log(`exchange: ${exchange.address}`);
                await exchange.connect(timelock).grantRole(await exchange.FREE_RIDER_ROLE(), strategy.address);
                console.log(`FREE_RIDER_ROLE granted to ${strategy.address}`);
            });

            usdcToken = await getERC20("usdc");
            asset = await getERC20("usdPlus");
            let decimals = await asset.decimals();
            if (decimals === 18) {
                toAsset = toE18;
            } else {
                toAsset = toE6;
            }

        });

        values.forEach(item => {

            let stakeValue = item.value;
            let deltaPercent = item.deltaPercent ? item.deltaPercent : 5;
            let unstakeValue = stakeValue / 2;

            describe(`Stake ${stakeValue}`, function () {

                let balanceAsset;
                let expectedNetAsset;

                let VALUE;
                let DELTA;

                let netAssetValueCheck;
                let healthFactor;

                let claimedRewardsInAsset;

                sharedBeforeEach(`Stake ${stakeValue}`, async () => {

                    try {
                        await m2m(strategy);

                        let assetValue = toAsset(stakeValue);
                        VALUE = new BigNumber(assetValue);
                        DELTA = VALUE.multipliedBy(new BigNumber(deltaPercent)).div(100);

                        await asset.connect(account).transfer(recipient.address, assetValue);

                        let balanceAssetBefore = new BigNumber((await asset.balanceOf(recipient.address)).toString());
                        expectedNetAsset = (new BigNumber((await strategy.netAssetValue()).toString())).plus(VALUE);
                        console.log(`expectedNetAsset: ${expectedNetAsset}`)

                        await asset.connect(recipient).transfer(strategy.address, assetValue);
                        await strategy.connect(recipient).stake(assetValue);
                        let balanceAssetAfter = new BigNumber((await asset.balanceOf(recipient.address)).toString());
                        balanceAsset = balanceAssetBefore.minus(balanceAssetAfter);
                        netAssetValueCheck = new BigNumber((await strategy.netAssetValue()).toString());
                        console.log(`----------------------`)
                        console.log(`balanceAssetAfter: ${balanceAssetAfter}`)
                        console.log(`balanceAsset: ${balanceAsset}`)
                        console.log(`netAssetValueCheck: ${netAssetValueCheck}`)
                        console.log(`----------------------`)
                        healthFactor = await strategy.currentHealthFactor();

                        await m2m(strategy);

                        const sevenDays = 7 * 24 * 60 * 60 * 1000;
                        await ethers.provider.send("evm_increaseTime", [sevenDays])
                        await ethers.provider.send('evm_mine');

                        let receipt = await (await strategy.connect(recipient).claimRewards(recipient.address)).wait();
                        claimedRewardsInAsset = new BigNumber(receipt.events.find((e) => e.event === 'Reward').args[0].toString());
                        console.log("claimedRewardsInAsset " + claimedRewardsInAsset.toNumber());

                        await m2m(strategy);
                    } catch (e) {
                        console.log(e)
                        throw e;
                    }

                });

                it(`Balance rewards > 0`, async function () {
                    expect(claimedRewardsInAsset.toNumber()).to.greaterThan(0);
                });

            });

        });

    });
}

async function m2m(strategy) {
    console.log('ETS:')

    let values = [];
    values.push({name: 'Total NAV', value: fromE6((await strategy.netAssetValue()).toString())});
    values.push({name: 'HF', value: (await strategy.currentHealthFactor()).toString()});

    console.table(values);

    let items = await strategy.balances();

    let names = ['borrowToken', 'collateralAsset', 'poolToken', 'poolUsdPlus', 'freeUsdPlus', 'freeAsset', 'freeToken']
    let arrays = [];
    for (let i = 0; i < items.length; i++) {

        let item = items[i];

        arrays.push({
            asset: item[0],
            name: names[i],
            amountUSD: fromE6(item[1].toString()),
            borrowed: item[3].toString()
        })

    }

    console.table(arrays);
}

function greatLess(value, expected, delta) {

    value = new BigNumber(value.toString());
    expected = new BigNumber(expected.toString());
    let maxValue = expected.plus(delta);
    let minValue = expected.minus(delta);

    let lte = value.lte(maxValue);
    let gte = value.gte(minValue);

    let valueNumber = value.div(new BigNumber(10).pow(6)).toFixed();
    let minValueNumber = minValue.div(new BigNumber(10).pow((6)).toFixed());
    let maxValueNumber = maxValue.div(new BigNumber(10).pow(6)).toFixed();

    let minSub = (value.minus(minValue)).div(new BigNumber(10).pow(6)).toFixed();
    let maxSub = (value.minus(maxValue)).div(new BigNumber(10).pow(6)).toFixed();

    expect(gte).to.equal(true, `Value[${valueNumber}] less than Min Value[${minValueNumber}] dif:[${minSub}]`);
    expect(lte).to.equal(true, `Value[${valueNumber}] great than Max Value[${maxValueNumber}] dif:[${maxSub}]`);
}

module.exports = {
    strategyTest: strategyTest,
}