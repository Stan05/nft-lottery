// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @dev This contract defines the proxy upgradable storage
 */
abstract contract ProxyUpgradableStorage {
    // Address of the current implementation
    address internal _implementation;

    /**
     * @dev Returns the address of the currently used implementation
     * @return address of the current implementation
     */
    function implementation() public view returns (address) {
        return _implementation;
    }
}
