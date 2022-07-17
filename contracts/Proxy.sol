// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ProxyUpgradableStorage.sol";

/**
 * @dev Proxy contract used to delegatecalls to actual Ticket implementation.
 * It's using the OwnableUpgradeable contract to achieve Access Control
 * and prevent storage collisions with the Ticket contract
 */
contract Proxy is OwnableUpgradeable, ProxyUpgradableStorage {
    /**
     * @dev The initializer function, needed for OZ upgradable contracts
     */
    function initialize(address _implementation, address _owner)
        external
        initializer
    {
        __Ownable_init();
        setImplementation(_implementation);
        transferOwnership(_owner);
    }

    /**
     * @dev Sets implementation contract to be used by this proxy
     */
    function setImplementation(address _newImplementation) public onlyOwner {
        _implementation = _newImplementation;
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
     * function in the contract matches the call data.
     */
    fallback() external payable {
        _delegate(implementation());
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if call data
     * is empty.
     */
    receive() external payable {
        _delegate(implementation());
    }

    /**
     * @dev Delegates the current call to `_implementation`.
     */
    function _delegate(address _implementation) internal {
        require(_implementation != address(0), "Implementation is not set");
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                _implementation,
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
