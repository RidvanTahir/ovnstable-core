const {deployProxy} = require("@overnight-contracts/common/utils/deployProxy");
const {getContract} = require("@overnight-contracts/common/utils/script-utils");
const hre = require("hardhat");

module.exports = async ({getNamedAccounts, deployments}) => {
    const {save} = deployments;

    const usdPlusToken = await getContract("UsdPlusToken");

    let params;

    if (hre.network.name === "bsc_usdc") {
        params = {args: [usdPlusToken.address, "Wrapped cUSD+", "wcUSD+", 6]}
    } else if (hre.network.name === "bsc_usdt") {
        params = {args: [usdPlusToken.address, "Wrapped tUSD+", "wtUSD+", 6]}
    } else if (hre.network.name === "optimism_dai") {
        params = {args: [usdPlusToken.address, "Wrapped DAI+", "wDAI+", 18]}
    } else {
        params = {args: [usdPlusToken.address, "Wrapped USD+", "wUSD+", 6]};
    }

    await deployProxy('WrappedUsdPlusToken', deployments, save, params);

    console.log("WrappedUsdPlusToken created");
};

module.exports.tags = ['base', 'WrappedUsdPlusToken'];
