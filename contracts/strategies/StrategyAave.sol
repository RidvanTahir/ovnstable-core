// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../connectors/curve/interfaces/IRewardOnlyGauge.sol";
import "../connectors/curve/interfaces/iCurvePool.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../connectors/aave/interfaces/ILendingPoolAddressesProvider.sol";
import "../connectors/aave/interfaces/ILendingPool.sol";

import "hardhat/console.sol";

contract StrategyAave is IStrategy, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    ILendingPoolAddressesProvider public aave;
    IERC20 public usdc;
    IERC20 public aUsdc;


    // ---  constructor

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override
    {}

    // ---  modifiers

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Restricted to admins");
        _;
    }


    // --- Setters

    function setParams(address _aave,
        address _usdc,
        address _aUsdc
    ) external onlyAdmin {

        require(_aave != address(0), "Zero address not allowed");
        require(_usdc != address(0), "Zero address not allowed");
        require(_aUsdc != address(0), "Zero address not allowed");

        aave = ILendingPoolAddressesProvider(_aave);

        usdc = IERC20(_usdc);
        aUsdc = IERC20(_aUsdc);
    }




    // --- logic

    function stake(
        address _asset,
        uint256 _amount
    ) override external {
        require(_asset == address(usdc), "Some token not compatible");

        address current = address(this);

        ILendingPool pool = ILendingPool(aave.getLendingPool());
        IERC20(usdc).approve(address(pool), _amount);
        pool.deposit(address(usdc), _amount, current, 0);
    }

    function unstake(
        address _asset,
        uint256 _amount,
        address _beneficiary
    ) override external returns (uint256) {
        require(_asset == address(usdc), "Some token not compatible");

        ILendingPool pool = ILendingPool(aave.getLendingPool());
        aUsdc.approve(address(pool), _amount);

        uint256 withdrawAmount = pool.withdraw(_asset, _amount, address(this));

        DataTypes.ReserveData memory res = pool.getReserveData(_asset);
        IERC20(res.aTokenAddress).transfer(
            _beneficiary,
            IERC20(res.aTokenAddress).balanceOf(address(this))
        );

        usdc.transfer(_beneficiary, withdrawAmount);

        require(withdrawAmount >= _amount, 'Returned value less than _amount');
        return withdrawAmount;
    }


    function netAssetValue() external view override returns (uint256){
        return aUsdc.balanceOf(address(this));

    }

    function liquidationValue() external view override returns (uint256){
        return aUsdc.balanceOf(address(this));
    }

    function claimRewards(address _beneficiary) external override returns (uint256){
        emit Reward(0);
        return 0;
    }

}
