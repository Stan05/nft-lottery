import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { Ticket__factory } from "../typechain-types";

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
function shuffle(a: any[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Simulates interactions from different users with the Proxy contract,
 * by buying random number of tickets between 1 and 10.
 *
 * @param signers the user addresses to interact with
 * @param proxy the proxy contract
 */
async function simulateUsersInteractions(
  signers: SignerWithAddress[],
  proxy: Contract
) {
  const ticketPrice = await proxy.ticketPrice();
  for (const signer of shuffle(signers)) {
    const numberOfTickets = Math.floor(Math.random() * 10) + 1;
    await proxy.connect(signer).buyTickets(numberOfTickets, {
      value: ticketPrice.mul(numberOfTickets),
    });
  }
}
export { shuffle, simulateUsersInteractions };
