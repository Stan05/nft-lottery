// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./Proxy.sol";

/**
 * Factory that uses create2 to deploy new Proxy contracts.
 */
contract ProxyFactory {
    event Deployed(address proxy);

    /**
     * Deploys new Proxy contract with create2 and call the initialize method.
     */
    function deploy(
        uint _salt,
        address _implementation,
        address _owner
    ) external {
        Proxy _proxy = new Proxy{salt: bytes32(_salt)}();
        _proxy.initialize(_implementation, _owner);
        emit Deployed(address(_proxy));
    }

    /**
     * Precompute the address of the Proxy contract.
     */
    function getAddress(bytes memory bytecode, uint _salt)
        public
        view
        returns (address)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint(hash)));
    }
}
