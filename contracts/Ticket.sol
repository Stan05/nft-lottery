// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

/**
 * Simple ERC721 token, will be used by {LotteryEngine} to keep track of lottery participants.
 */
contract Ticket is ERC721 {
    using Counters for Counters.Counter;

    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
    {}

    // state
    Counters.Counter private ticketIds;

    function mintAndTransferTo(uint8 _numberOfTickets, address _user)
        external
        payable
    {
        require(_numberOfTickets > 0, "Cannot buy 0 tickets");

        for (uint8 i = 0; i < _numberOfTickets; i++) {
            _mintTo(_user);
        }
    }

    function _mintTo(address _user) private {
        uint256 newItemId = ticketIds.current();
        _safeMint(_user, newItemId);
        ticketIds.increment();
    }
}
