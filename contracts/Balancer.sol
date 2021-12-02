// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IMark2Market.sol";
import "./interfaces/IActionBuilder.sol";
import "./interfaces/ITokenExchange.sol";
import "./token_exchanges/Usdc2AUsdcTokenExchange.sol";
import "hardhat/console.sol";

contract Balancer is AccessControl {
    // ---  fields

    IMark2Market public m2m;
    address[] public actionBuildersInOrder;

    // ---  modifiers

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Restricted to admins");
        _;
    }

    // ---  constructor

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---  setters

    function setMark2Market(address _m2m) external onlyAdmin {
        require(_m2m != address(0), "Zero address not allowed");
        m2m = IMark2Market(_m2m);
    }

    function setActionBuilders(address[] calldata _actionBuildersInOrder) external onlyAdmin {
        for (uint8 i = 0; i < _actionBuildersInOrder.length; i++) {
            _addActionBuilderAt(_actionBuildersInOrder[i], i);
        }
        // truncate array if needed
        if (actionBuildersInOrder.length > _actionBuildersInOrder.length) {
            uint256 removeCount = actionBuildersInOrder.length - _actionBuildersInOrder.length;
            for (uint8 i = 0; i < removeCount; i++) {
                actionBuildersInOrder.pop();
            }
        }
    }

    function addActionBuilderAt(address actionBuilder, uint256 index) external onlyAdmin {
        _addActionBuilderAt(actionBuilder, index);
    }

    function _addActionBuilderAt(address actionBuilder, uint256 index) internal {
        uint256 currentlength = actionBuildersInOrder.length;
        // expand array id needed
        if (currentlength == 0 || currentlength - 1 < index) {
            uint256 additionalCount = index - currentlength + 1;
            for (uint8 i = 0; i < additionalCount; i++) {
                actionBuildersInOrder.push();
            }
        }
        actionBuildersInOrder[index] = actionBuilder;
    }

    // ---  logic

    function buildBalanceActions() public returns (IActionBuilder.ExchangeAction[] memory) {
        // Same to zero withdrawal balance
        console.log("buildBalanceActions bo attr: start\t%s", gasleft());
        return buildBalanceActions(IERC20(address(0)), 0);
    }

    function buildBalanceActions(IERC20 withdrawToken, uint256 withdrawAmount)
        public
        returns (IActionBuilder.ExchangeAction[] memory)
    {
        console.log("buildBalanceActions: start\t%s", gasleft());
         // 1. get current prices from M2M
        IMark2Market.BalanceAssetPrices[] memory assetPrices = m2m.assetPricesForBalance(
            address(withdrawToken),
            withdrawAmount
        );
        console.log("buildBalanceActions: assetPricesForBalance\t%s", gasleft());

        // 2. calc total price
//        uint256 totalUsdcPrice = assetPrices.totalUsdcPrice;
console.log("buildBalanceActions: totalUsdcPrice\t%s", gasleft());

        // 3. make actions
        IActionBuilder.ExchangeAction[]
        memory actionOrder = new IActionBuilder.ExchangeAction[](
            actionBuildersInOrder.length
        );
console.log("buildBalanceActions: actionOrder\t%s", gasleft());

        for (uint8 i = 0; i < actionBuildersInOrder.length; i++) {
            IActionBuilder.ExchangeAction memory action = IActionBuilder(actionBuildersInOrder[i])
            .buildAction(assetPrices, actionOrder);
            actionOrder[i] = action;
            console.log("buildBalanceActions: buildAction\t%s", gasleft());
        }
        console.log("buildBalanceActions: end\t%s", gasleft());
        return actionOrder;
    }
}
