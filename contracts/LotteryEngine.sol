// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Ticket.sol";
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

/**
 * Contract that runs lottery itteration, keep track of participants in each itteration
 * and select random winners after each lottery itteration.
 *
 * @dev Dev Note: The 'ticket' should be initialized through the 'setTicket' after a LotteryEngine is deployed.
 * Shouldn't be initialized from the 'initializer' function since it's not going to be visible to the Proxy contract.
 */
contract LotteryEngine is OwnableUpgradeable {
    using Counters for Counters.Counter;

    /**
     * @dev Empty space to prevent collsion with proxy storage
     */
    address private __gap;
    // state
    Ticket public ticket;
    mapping(uint256 => LotteryItteration) private lotteries;
    mapping(uint256 => mapping(address => bool)) private hasUserParticipated;
    mapping(uint256 => address[]) private totalUsersParticipated;
    Counters.Counter private lotteryIds;

    // events
    event LotteryStarted(
        uint256 startTime,
        uint256 endTime,
        uint256 ticketPrice
    );
    event TicketsBought(address user, uint8 numberOfTickets);
    event WinnerSelected(
        address user,
        uint256 prize,
        uint256 lotteryItteration
    );

    // errors
    error LotteryIsNotActive();
    error TicketNotSupportERC721(address ticket);

    /**
     * Check if the current lottery is active, otherwise revert
     */
    modifier lotteryIsActive() {
        if (!_isLotteryActive()) {
            revert LotteryIsNotActive();
        }
        _;
    }

    /**
     *  Check if the provided ticket supports ERC721, otherwise revert
     */
    modifier supportsERC721(address _ticket) {
        try IERC721(_ticket).supportsInterface(0x80ac58cd) returns (
            bool isSupportedInterface
        ) {
            if (!isSupportedInterface) {
                revert TicketNotSupportERC721(_ticket);
            }
        } catch {
            revert TicketNotSupportERC721(_ticket);
        }
        _;
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    /**
     * Function to start a new lottery for the given duration in hours and ticket price.
     * Requires to not have an ongoing lottery and the last lottery should be claimed (a winner should be selected).
     */
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

    /**
     * Function to buy tickets for the ongoing lottery itteration.
     * The tickets will be minted to the message sender account.
     * Requires to have an active lottery.
     */
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

        ticket.mintAndTransferTo(_numberOfTickets, msg.sender);

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
                blockhash(block.number)
            )
        );

        emit TicketsBought(msg.sender, _numberOfTickets);
    }

    /**
     * Selects a winner from the participants in the current lottery itteration.
     * Sends half of the prize pool to the selected winner.
     * Requires the current lottery itteration to be finished and not claimed (no winner has been selected).
     */
    function selectWinner() external onlyOwner returns (address _winner) {
        require(!_isLotteryActive(), "Lottery is still active");
        require(!_isLotteryClaimed(), "Lottery has already been claimed");
        LotteryItteration storage _lottery = _currentLottery();

        _lottery.seed = keccak256(
            abi.encodePacked(
                _lottery.seed,
                msg.sender,
                _lottery.numberOfParticipants,
                blockhash(block.number)
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
        emit WinnerSelected(_winner, _prize, lotteryIds.current());
    }

    /**
     * Set the ticket to be used by the engine.'
     * Requires the provied address to support IERC721 interface, check {IERC721.supportsInterface()},
     * as well as to not have an active lottery.
     */
    function setTicket(address _ticket)
        external
        onlyOwner
        supportsERC721(_ticket)
    {
        require(
            !_isLotteryActive(),
            "Cannot change ticket while there is active lottery"
        );
        _setTicket(_ticket);
    }

    /**
     * Returns if the current lottery is active.
     */
    function isLotteryActive() external view returns (bool) {
        return _isLotteryActive();
    }

    /**
     * Returns the prize pool of the current lottery.
     */
    function prizePool() external view returns (uint256) {
        return _currentLottery().prizePool;
    }

    /**
     * Returns the ticket price of the current lottery.
     */
    function ticketPrice() external view returns (uint256) {
        return _currentLottery().ticketPrice;
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

    function _setTicket(address _ticket) internal {
        ticket = Ticket(_ticket);
    }
}
