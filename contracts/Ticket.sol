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
    uint256 numberOfParticipants;
    bytes32 seed;
    bool claimed;
}

contract Ticket is ERC721, Ownable {
    using Counters for Counters.Counter;

    // state
    mapping(uint256 => LotteryItteration) private lotteries;
    mapping(uint256 => mapping(address => bool)) private hasUserParticipated;
    mapping(uint256 => address[]) private totalUsersParticipated;

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
            numberOfParticipants: 0,
            seed: "",
            claimed: false
        });

        emit LotteryStarted(_startTime, _endTime, _ticketPrice);
    }

    function buyTickets(uint8 _numberOfTickets)
        external
        payable
        lotteryIsActive
    {
        require(_numberOfTickets > 0, "Cannot buy 0 tickets");
        LotteryItteration storage _lottery = _currentLottery();
        require(
            msg.value >= _numberOfTickets * _lottery.ticketPrice,
            "Not enough funds"
        );

        for (uint8 i = 0; i < _numberOfTickets; i++) {
            _buyTicket();
        }

        _lottery.prizePool += (_numberOfTickets * _lottery.ticketPrice);
        if (!hasUserParticipated[lotteryIds.current()][msg.sender]) {
            hasUserParticipated[lotteryIds.current()][msg.sender] = true;
            totalUsersParticipated[lotteryIds.current()].push(msg.sender);
            _lottery.numberOfParticipants++;
        }

        _lottery.seed = keccak256(
            abi.encodePacked(
                _lottery.seed,
                msg.sender,
                _numberOfTickets,
                block.number
            )
        );

        emit TicketsBought(msg.sender, _numberOfTickets);
    }

    function selectWinner() external onlyOwner returns (address _winner) {
        require(!_isLotteryActive(), "Lottery is still active");
        LotteryItteration storage _lottery = _currentLottery();

        _lottery.seed = keccak256(
            abi.encodePacked(
                _lottery.seed,
                msg.sender,
                _lottery.numberOfParticipants,
                block.number
            )
        );
        uint256 _winnerIndex = uint256(_lottery.seed) %
            _lottery.numberOfParticipants;
        _winner = totalUsersParticipated[lotteryIds.current()][_winnerIndex];

        // only for verifying purposes
        console.log(
            "Random number is '%d' and winner is '%s'",
            _winnerIndex,
            _winner
        );

        uint256 _prize = _lottery.prizePool / 2;
        bool _sent = payable(_winner).send(_prize);
        require(_sent, "Prize couldn't be sent");

        _lottery.claimed = true;
        emit WinnerSelected(_winner, _prize);
    }

    function isLotteryActive() external view returns (bool) {
        return _isLotteryActive();
    }

    function prizePool() external view returns (uint256) {
        return _currentLottery().prizePool;
    }

    function ticketPrice() external view returns (uint256) {
        return _currentLottery().ticketPrice;
    }

    function _buyTicket() private {
        uint256 newItemId = ticketIds.current();
        _safeMint(msg.sender, newItemId);
        // TODO Store the lottery id in the nft metadata
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
