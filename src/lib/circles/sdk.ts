/**
 * Circles SDK helpers
 *
 * Wraps the @aboutcircles/sdk into a small set of functions used by the app:
 *  - initSdk()           – bootstrap SDK with the browser runner
 *  - getBalance()        – fetch total CRC balance (handles demurrage transparently)
 *  - transferCRC()       – pathfinding-based transfer (advanced flow)
 *  - hasEnoughCRC()      – balance gate check
 *
 * ASSUMPTION: CRC amounts are stored and compared as BigInt (1e18 per CRC, same
 * convention as ERC-20).  The SDK uses BigInt natively for amounts.
 *
 * DEMURRAGE NOTE: Balances are fetched live via avatar.balances.getTotal() which
 * already accounts for the 7% yearly decay applied by the hub contract.  We never
 * cache raw balances between page loads.
 */

import { Sdk } from "@aboutcircles/sdk";
import { circlesConfig } from "@aboutcircles/sdk-core";
import type { HumanAvatar } from "@aboutcircles/sdk";
import type { ContractRunner } from "@aboutcircles/sdk-types";
import { createBrowserRunner } from "./runner";
import { STAKE_AMOUNT_WEI } from "@/lib/constants";

let _sdk: Sdk | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _runner: any | null = null;

/** Bootstrap the SDK once per page session (browser / MetaMask path). Returns the runner's address. */
export async function initSdk(): Promise<string> {
  _runner = createBrowserRunner();
  await _runner.init();

  _sdk = new Sdk(circlesConfig[100], _runner);

  return _runner.address!;
}

/**
 * Initialise the SDK with a pre-configured runner (miniapp path).
 * The caller is responsible for having set runner.address before calling this.
 * Does NOT call runner.init() — the runner is already ready.
 */
export function initSdkWithRunner(runner: ContractRunner): void {
  _runner = runner;
  _sdk = new Sdk(circlesConfig[100], runner);
}

/** Get the connected runner address (null if not initialised). */
export function getConnectedAddress(): string | null {
  return _runner?.address ?? null;
}

/** Returns the total CRC balance (demurrage-adjusted) as a BigInt. */
export async function getCRCBalance(address: string): Promise<bigint> {
  if (!_sdk) throw new Error("SDK not initialised. Call initSdk() first.");

  const avatar = await _sdk.getAvatar(address as `0x${string}`);
  // getTotal() exists on all avatar types via CommonAvatar
  const total = await (avatar as HumanAvatar).balances.getTotal();

  return BigInt(total.toString());
}

/** Human-readable CRC balance string (e.g. "12.34"). */
export async function getCRCBalanceFormatted(address: string): Promise<string> {
  const raw = await getCRCBalance(address);
  const crc = Number(raw) / 1e18;
  return crc.toFixed(4);
}

/** Returns true if the user has at least 1 CRC available to stake. */
export async function hasEnoughCRC(address: string): Promise<boolean> {
  try {
    const balance = await getCRCBalance(address);
    return balance >= STAKE_AMOUNT_WEI;
  } catch {
    return false;
  }
}

/**
 * Transfer CRC from the connected wallet to `recipient`.
 * Uses avatar.transfer.advanced() which runs pathfinding automatically.
 *
 * @returns transaction receipt hash
 */
export async function transferCRC(
  fromAddress: string,
  toAddress: string,
  amountWei: bigint
): Promise<string> {
  if (!_sdk) throw new Error("SDK not initialised. Call initSdk() first.");

  const avatar = await _sdk.getAvatar(fromAddress as `0x${string}`);
  const typedAvatar = avatar as HumanAvatar;

  // Check max transferable first to give a friendlier error
  const maxTransferable = await typedAvatar.transfer.getMaxAmount(toAddress as `0x${string}`);
  if (BigInt(maxTransferable.toString()) < amountWei) {
    throw new Error(
      `ChessBuddyOrg can't receive your CRC yet — no trust path found. ` +
      `Make sure ChessBuddyOrg trusts your CRC token in Circles Garage ` +
      `(it should already trust Gnosis group — contact support if this persists).`
    );
  }

  const receipt = await typedAvatar.transfer.advanced(
    toAddress as `0x${string}`,
    amountWei
  );

  // viem TransactionReceipt uses transactionHash
  return receipt.transactionHash;
}



/**
 * Get Circles profile for a given address.
 * Returns null if no profile exists.
 */
export async function getCirclesProfile(address: string) {
  if (!_sdk) return null;
  try {
    const avatar = await _sdk.getAvatar(address as `0x${string}`);
    return await (avatar as HumanAvatar).profile.get();
  } catch {
    return null;
  }
}

/** Expose raw SDK instance for advanced use cases (e.g. trust graph lookup). */
export function getSdk(): Sdk | null {
  return _sdk;
}
