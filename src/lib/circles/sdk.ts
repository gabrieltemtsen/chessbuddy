/**
 * Circles SDK helpers
 *
 * Wraps the @aboutcircles/sdk into a small set of functions used by the app:
 *  - initSdk()           – bootstrap SDK with the browser runner
 *  - getBalance()        – fetch total CRC balance (handles demurrage transparently)
 *  - transferCRC()       – direct ERC-1155 safeTransferFrom on Circles Hub v2
 *  - hasEnoughCRC()      – balance gate check
 *
 * ASSUMPTION: CRC amounts are stored and compared as BigInt (1e18 per CRC, same
 * convention as ERC-20).  The SDK uses BigInt natively for amounts.
 *
 * DEMURRAGE NOTE: Balances are fetched live via avatar.balances.getTotal() which
 * already accounts for the 7% yearly decay applied by the hub contract.  We never
 * cache raw balances between page loads.
 *
 * TRANSFER NOTE: We bypass avatar.transfer.advanced() (pathfinding) entirely.
 * In Circles v2, each human has a personal token whose ID = uint256(userAddress).
 * If ChessBuddyOrg directly trusts the user (set via Circles Garage), a plain
 * ERC-1155 safeTransferFrom on the Hub contract is simpler, faster, and avoids
 * the stale pathfinding-RPC cache that was causing false "no path" errors.
 */

import { Sdk } from "@aboutcircles/sdk";
import { circlesConfig } from "@aboutcircles/sdk-core";
import type { HumanAvatar } from "@aboutcircles/sdk";
import type { ContractRunner } from "@aboutcircles/sdk-types";
import { encodeFunctionData } from "viem/utils";
import { createBrowserRunner } from "./runner";
import { STAKE_AMOUNT_WEI } from "@/lib/constants";

// ── Circles Hub v2 (Gnosis Chain, chainId 100) ────────────────────────────────
const CIRCLES_HUB_V2 = "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8" as const;

/** Minimal ABI — only the ERC-1155 safeTransferFrom we need. */
const HUB_ABI = [
  {
    name: "safeTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",  type: "address" },
      { name: "to",    type: "address" },
      { name: "id",    type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "data",  type: "bytes"   },
    ],
    outputs: [],
  },
] as const;

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
 * Transfer CRC from the connected wallet to `recipient` using a direct
 * ERC-1155 safeTransferFrom on the Circles Hub v2.
 *
 * Why direct instead of avatar.transfer.advanced() (pathfinding)?
 *  - Pathfinding queries rpc.aboutcircles.com which can return stale/empty
 *    path data even hours after trust is established → false "no path" errors.
 *  - When ChessBuddyOrg directly trusts the sender (configured via Circles
 *    Garage), no multi-hop routing is needed — one hop is enough.
 *  - In Circles v2, each human's personal token ID = uint256(address), so we
 *    always know the token ID without any lookup.
 *
 * @returns transaction hash
 */
export async function transferCRC(
  fromAddress: string,
  toAddress: string,
  amountWei: bigint
): Promise<string> {
  if (!_runner) throw new Error("Runner not initialised. Call initSdk() first.");

  // Circles v2 personal token ID = address cast to uint256
  const tokenId = BigInt(fromAddress);

  const data = encodeFunctionData({
    abi: HUB_ABI,
    functionName: "safeTransferFrom",
    args: [
      fromAddress as `0x${string}`,
      toAddress  as `0x${string}`,
      tokenId,
      amountWei,
      "0x",
    ],
  });

  try {
    const receipt = await _runner.sendTransaction([
      { to: CIRCLES_HUB_V2, data },
    ]);
    return receipt.transactionHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Hub reverts with "not trusted" when the recipient hasn't trusted the sender
    if (
      msg.toLowerCase().includes("trust") ||
      msg.toLowerCase().includes("not trusted") ||
      msg.toLowerCase().includes("revert") ||
      msg.toLowerCase().includes("denied")
    ) {
      throw new Error(
        `CRC transfer failed — ChessBuddyOrg hasn't trusted your token yet. ` +
        `In Circles Garage, open the Builder org manager, go to "Accepted CRC ` +
        `Tokens", and add your address. Wait ~30 s for the chain to index, then try again.`
      );
    }
    throw new Error(`CRC transfer failed: ${msg}`);
  }
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
