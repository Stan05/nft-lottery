// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

struct LotteryItteration {
    uint256 ticketPrice;
    uint256 startTime;
    uint256 endTime;
    uint256 prizePool;
    bool claimed;
}

contract Ticket is ERC721, Ownable {
    using Counters for Counters.Counter;

    // state
    mapping(uint256 => LotteryItteration) lotteries;
    mapping(uint256 => mapping(address => uint256)) userStakesInLottery;

    Counters.Counter private ticketIds;
    Counters.Counter private lotteryIds;

    // events
    event LotteryStarted(
        uint256 startTime,
        uint256 endTime,
        uint256 ticketPrice
    );
    event TicketsBought(address user, uint8 numberOfTickets);
    event WinnerSelected(address user, uint256 prize);

    // errors
    error LotteryIsNotActive();

    constructor() ERC721("TicketNFT", "TFT") {}

    modifier lotteryIsActive() {
        if (!_isLotteryActive()) {
            revert LotteryIsNotActive();
        }
        _;
    }

    function startNewLottery(uint256 _numHours, uint256 _ticketPrice)
        external
        onlyOwner
    {
        require(!_isLotteryActive(), "There is an active lottery");
        require(_isLotteryClaimed(), "Current lottery is still not claimed");

        lotteryIds.increment();
        uint256 _lotteryId = lotteryIds.current();
        uint256 _startTime = block.timestamp;
        uint256 _endTime = _startTime + (_numHours * 1 hours);

        lotteries[_lotteryId] = LotteryItteration({
            ticketPrice: _ticketPrice,
            startTime: _startTime,
            endTime: _endTime,
            prizePool: 0,
            claimed: false
        });

        emit LotteryStarted(_startTime, _endTime, _ticketPrice);
    }

    function buyTickets(uint8 _numberOfTickets)
        external
        payable
        lotteryIsActive
    {
        LotteryItteration storage _lottery = _currentLottery();
        require(
            msg.value >= _numberOfTickets * _lottery.ticketPrice,
            "Not enough funds"
        );

        for (uint8 i = 0; i < _numberOfTickets; i++) {
            _buyTicket();
        }
        _lottery.prizePool += (_numberOfTickets * _lottery.ticketPrice);
        userStakesInLottery[lotteryIds.current()][
            msg.sender
        ] += _numberOfTickets;

        emit TicketsBought(msg.sender, _numberOfTickets);
    }

    function selectWinner() external onlyOwner {
        require(!_isLotteryActive(), "Lottery is still active");
        LotteryItteration storage _lottery = _currentLottery();
        // TODO randomly select winner and send half of the prize pool
        _lottery.claimed = true;
        emit WinnerSelected(address(0), 2);
    }

    function isLotteryActive() external view returns (bool) {
        return _isLotteryActive();
    }

    function prizePool() external view returns (uint256) {
        return _currentLottery().prizePool;
    }

    function stakesInCurrentLottery() external view returns (uint256) {
        return userStakesInLottery[lotteryIds.current()][msg.sender];
    }

    function _buyTicket() private {
        uint256 newItemId = ticketIds.current();
        _safeMint(msg.sender, newItemId);
        ticketIds.increment();
    }

    function _isLotteryActive() private view returns (bool) {
        return _currentLottery().endTime > block.timestamp;
    }

    /**
     * @dev checks if the current lottery is claimed, or check if it's the struct initial state
     */
    function _isLotteryClaimed() private view returns (bool) {
        return _currentLottery().claimed || _currentLottery().startTime == 0;
    }

    function _currentLottery()
        private
        view
        returns (LotteryItteration storage)
    {
        return lotteries[lotteryIds.current()];
    }
}
