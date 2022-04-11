const {deployments, ethers, getNamedAccounts} = require('hardhat');
const {greatLess} = require('../../../common/utils/tests');
const {fromE18, toUSDC, fromUSDC} = require("../../../common/utils/decimals");
const hre = require("hardhat");
const {resetHardhat} = require("../../../common/utils/tests");

let {FANTOM} = require('../../../common/utils/assets');
const {logStrategyGasUsage} = require("../../../common/utils/strategyCommon");
let ERC20 = require('./abi/IERC20.json');


describe("StrategyCurveGeist. Stake/unstake", function () {

    let account;
    let strategy;
    let usdc;
    let crvGeistGauge;

    before(async () => {
        await hre.run("compile");
        await resetHardhat('fantom');

        await deployments.fixture(['StrategyCurveGeist', 'StrategyCurveGeistSetting', 'test']);

        const {deployer} = await getNamedAccounts();
        account = deployer;

        strategy = await ethers.getContract('StrategyCurveGeist');
        await strategy.setPortfolioManager(account);

        usdc = await ethers.getContractAt(ERC20, FANTOM.usdc);
        crvGeistGauge = await ethers.getContractAt(ERC20, FANTOM.crvGeistGauge);
    });

    it("log gas", async () => {
        await logStrategyGasUsage("StrategyCurveGeist", strategy, usdc, account)
    });

    describe("Stake 100 USDC", function () {

        let balanceUsdc;
        let balanceCrvGeistGauge;

        before(async () => {

            let balanceUsdcBefore = await usdc.balanceOf(account);
            let balanceCrvGeistGaugeBefore = await crvGeistGauge.balanceOf(strategy.address);

            await usdc.transfer(strategy.address, toUSDC(100));
            let receipt = await (await strategy.stake(usdc.address, toUSDC(100))).wait();
            console.log(`stake gas used: ${receipt.gasUsed}`); // stake gas used: 724760

            let balanceUsdcAfter = await usdc.balanceOf(account);
            let balanceCrvGeistGaugeAfter = await crvGeistGauge.balanceOf(strategy.address);

            balanceUsdc = fromUSDC(balanceUsdcBefore - balanceUsdcAfter);
            balanceCrvGeistGauge = fromE18(balanceCrvGeistGaugeAfter - balanceCrvGeistGaugeBefore);

            console.log("balanceUsdcBefore: " + fromUSDC(balanceUsdcBefore));
            console.log("balanceUsdcAfter: " + fromUSDC(balanceUsdcAfter));
            console.log("balanceUsdc: " + balanceUsdc);
            console.log("balanceCrvGeistGaugeBefore: " + fromE18(balanceCrvGeistGaugeBefore));
            console.log("balanceCrvGeistGaugeAfter: " + fromE18(balanceCrvGeistGaugeAfter));
            console.log("balanceCrvGeistGauge: " + balanceCrvGeistGauge);
        });

        it("Balance USDC should be greater than 99 less than 101", async function () {
            greatLess(balanceUsdc, 100, 1);
        });

        it("Balance crvGeistGauge should be greater than 90 less than 100", async function () {
            greatLess(balanceCrvGeistGauge, 95, 5);
        });

        it("NetAssetValue USDC should be greater than 99 less than 101", async function () {
            greatLess(fromUSDC(await strategy.netAssetValue()), 100, 1);
        });

        it("LiquidationValue USDC should be greater than 99 less than 101", async function () {
            greatLess(fromUSDC(await strategy.liquidationValue()), 100, 1);
        });

        describe("Unstake 50 USDC", function () {

            let balanceUsdc;
            let balanceCrvGeistGauge;

            before(async () => {

                let balanceUsdcBefore = await usdc.balanceOf(account);
                let balanceCrvGeistGaugeBefore = await crvGeistGauge.balanceOf(strategy.address);

                let receipt = await (await strategy.unstake(usdc.address, toUSDC(50), account, false)).wait();
                console.log(`unstake gas used: ${receipt.gasUsed}`); // unstake gas used: 711381

                let balanceUsdcAfter = await usdc.balanceOf(account);
                let balanceCrvGeistGaugeAfter = await crvGeistGauge.balanceOf(strategy.address);

                balanceUsdc = fromUSDC(balanceUsdcAfter - balanceUsdcBefore);
                balanceCrvGeistGauge = fromE18(balanceCrvGeistGaugeBefore - balanceCrvGeistGaugeAfter);

                console.log("balanceUsdcBefore: " + fromUSDC(balanceUsdcBefore));
                console.log("balanceUsdcAfter: " + fromUSDC(balanceUsdcAfter));
                console.log("balanceUsdc: " + balanceUsdc);
                console.log("balanceCrvGeistGaugeBefore: " + fromE18(balanceCrvGeistGaugeBefore));
                console.log("balanceCrvGeistGaugeAfter: " + fromE18(balanceCrvGeistGaugeAfter));
                console.log("balanceCrvGeistGauge: " + balanceCrvGeistGauge);
            });

            it("Balance USDC should be greater than 49 less than 51", async function () {
                greatLess(balanceUsdc, 50, 1);
            });

            it("Balance crvGeistGauge should be greater than 45 less than 50", async function () {
                greatLess(balanceCrvGeistGauge, 47.5, 2.5);
            });

            it("NetAssetValue USDC should be greater than 49 less than 51", async function () {
                greatLess(fromUSDC(await strategy.netAssetValue()), 50, 1);
            });

            it("LiquidationValue USDC should be greater than 49 less than 51", async function () {
                greatLess(fromUSDC(await strategy.liquidationValue()), 50, 1);
            });

            describe("Unstake Full", function () {

                let balanceUSDC;
                let balanceCrvGeistGauge;

                before(async () => {

                    let balanceUsdcBefore = await usdc.balanceOf(account);
                    let balanceCrvGeistGaugeBefore = await crvGeistGauge.balanceOf(strategy.address);

                    let receipt = await (await strategy.unstake(usdc.address, 0, account, true)).wait();
                    console.log(`unstake full gas used: ${receipt.gasUsed}`);

                    let balanceUsdcAfter = await usdc.balanceOf(account);
                    let balanceCrvGeistGaugeAfter = await crvGeistGauge.balanceOf(strategy.address);

                    balanceUsdc = fromUSDC(balanceUsdcAfter - balanceUsdcBefore);
                    balanceCrvGeistGauge = fromE18(balanceCrvGeistGaugeBefore - balanceCrvGeistGaugeAfter);

                    console.log("balanceUsdcBefore: " + fromUSDC(balanceUsdcBefore));
                    console.log("balanceUsdcAfter: " + fromUSDC(balanceUsdcAfter));
                    console.log("balanceUsdc: " + balanceUsdc);
                    console.log("balanceCrvGeistGaugeBefore: " + fromE18(balanceCrvGeistGaugeBefore));
                    console.log("balanceCrvGeistGaugeAfter: " + fromE18(balanceCrvGeistGaugeAfter));
                    console.log("balanceCrvGeistGauge: " + balanceCrvGeistGauge);
                });

                it("Balance USDC should be greater than 49 less than 51", async function () {
                    greatLess(balanceUsdc, 50, 1);
                });

                it("Balance crvGeistGauge should be greater than 45 less than 50", async function () {
                    greatLess(balanceCrvGeistGauge, 47.5, 2.5);
                });

                it("NetAssetValue USDC should be greater than 0 less than 1", async function () {
                    greatLess(fromUSDC(await strategy.netAssetValue()), 0.5, 0.5);
                });

                it("LiquidationValue USDC should be greater than 0 less than 1", async function () {
                    greatLess(fromUSDC(await strategy.liquidationValue()), 0.5, 0.5);
                });

            });

        });

    });

});

describe("StrategyCurveGeist. Claim rewards", function () {

    let account;
    let strategy;
    let usdc;

    before(async () => {
        await hre.run("compile");
        await resetHardhat('fantom');

        await deployments.fixture(['PortfolioManager', 'StrategyCurveGeist', 'StrategyCurveGeistSetting', 'FantomBuyUsdc']);

        const {deployer} = await getNamedAccounts();
        account = deployer;

        strategy = await ethers.getContract('StrategyCurveGeist');
        await strategy.setPortfolioManager(account);

        usdc = await ethers.getContractAt("ERC20", FANTOM.usdc);
    });

    describe("Stake 100 USDC. Claim rewards", function () {

        let balanceUsdc;

        before(async () => {

            await usdc.transfer(strategy.address, toUSDC(100));
            await strategy.stake(usdc.address, toUSDC(100));

            // timeout 7 days
            const sevenDays = 7 * 24 * 60 * 60;
            await ethers.provider.send("evm_increaseTime", [sevenDays])
            await ethers.provider.send('evm_mine');

            let balanceUsdcBefore = await usdc.balanceOf(account);
            await strategy.claimRewards(account);
            let balanceUsdcAfter = await usdc.balanceOf(account);

            balanceUsdc = fromUSDC(balanceUsdcAfter - balanceUsdcBefore);
            console.log("Rewards: " + balanceUsdc);
        });

        it("Rewards should be greater or equal 0 USDC", async function () {
            expect(balanceUsdc).to.greaterThanOrEqual(0);
        });

    });

});
