pragma solidity >=0.8.0;
/// @title Connector to curve->aave 
/// @notice from https://github.com/curvefi/curve-contract-polygon/blob/master/contracts/pools/aave/StableSwapAave.vy
/// @dev check number of coins in pool and add functions  with nesessary  uint256[N_COINS]

interface iCurvePool {

// def add_liquidity(_amounts: uint256[N_COINS], _min_mint_amount: uint256, _use_underlying: bool = False) -> uint256:
function add_liquidity (uint[3] memory _amounts, uint256 _min_mint_amount, bool _use_underlying) external returns (uint256); //check uint[3] memory or calldata

 /** def remove_liquidity(
    _amount: uint256,
    _min_amounts: uint256[N_COINS],
    _use_underlying: bool = False,
) -> uint256[N_COINS]:
 */
function remove_liquidity (uint256 _amounts, uint[3] memory _min_amounts, bool _use_underlying) external returns (uint256[3] memory ); //check uint[3] memory or calldata

function underlying_coins (uint i ) external view returns (address);
function lp_token () external view returns (address);
function calc_token_amount(uint[3] memory _amounts, bool _is_deposite) external returns (uint256);

}