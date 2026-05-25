/**
 * ChessBuddy Escrow — backend helpers (Next.js API routes only, server-side)
 *
 * Provides:
 *  • signMatchResult()   — sign a winner / draw for settleMatch()
 *  • matchIdBytes32()    — convert a string matchId → bytes32
 *  • ESCROW_ABI          — minimal ABI for on-chain reads
 */

import { ethers } from "ethers";

// ── Config ────────────────────────────────────────────────────────────────────

export const GNOSIS_CHAIN_ID = 100;

/** The deployed ChessBuddyEscrow contract address */
export const ESCROW_ADDRESS: string =
  process.env.CHESSBUDDY_ESCROW_ADDRESS ?? "";

/** Gnosis Chain RPC */
const RPC_URL =
  process.env.GNOSIS_RPC_URL ?? "https://rpc.gnosischain.com";

// ── Minimal ABI ───────────────────────────────────────────────────────────────

export const ESCROW_ABI = [
  // Write
  "function createMatch(bytes32 matchId, address opponent, address token, uint256 stakeAmount) external",
  "function joinMatch(bytes32 matchId) external",
  "function settleMatch(bytes32 matchId, address winner, bytes calldata signature) external",
  "function cancelMatch(bytes32 matchId) external",
  // Read
  "function getMatch(bytes32 matchId) external view returns (address white, address black, address token, uint256 stakeAmount, uint256 totalPool, uint8 status)",
  "function resultMessageHash(bytes32 matchId, address winner) external view returns (bytes32)",
  "function feeBps() external view returns (uint256)",
  "function adminSigner() external view returns (address)",
  "function feeRecipient() external view returns (address)",
  // Events
  "event MatchCreated(bytes32 indexed matchId, address indexed white, address indexed black, address token, uint256 stakeAmount)",
  "event MatchJoined(bytes32 indexed matchId, address indexed black)",
  "event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 winnerPayout, uint256 feePayout)",
  "event MatchDraw(bytes32 indexed matchId)",
  "event MatchCancelled(bytes32 indexed matchId, address indexed refundedTo)",
] as const;

// ── Match status enum (mirrors Solidity) ─────────────────────────────────────

export enum MatchStatus {
  Open      = 0,
  Active    = 1,
  Settled   = 2,
  Cancelled = 3,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a string match ID (e.g. Convex ID or UUID) to a bytes32 value
 * suitable for the smart contract.
 */
export function matchIdBytes32(id: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(id));
}

/**
 * Sign a match result so the winner (or either player) can submit it to
 * `settleMatch()` on-chain.
 *
 * @param matchId  The DB match ID (string) — will be keccak256-hashed internally
 * @param winner   Winner's Ethereum address, or `ethers.ZeroAddress` for a draw
 * @param chainId  Defaults to 100 (Gnosis Chain)
 * @returns        Hex signature string to pass to settleMatch()
 */
export async function signMatchResult(
  matchId: string,
  winner: string,
  chainId: number = GNOSIS_CHAIN_ID
): Promise<string> {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("ADMIN_WALLET_PRIVATE_KEY is not set");

  const signer = new ethers.Wallet(privateKey);
  const idBytes32 = matchIdBytes32(matchId);

  // Must match the contract:
  //   keccak256(abi.encodePacked(matchId, winner, block.chainid))
  const msgHash = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "uint256"],
    [idBytes32, winner, chainId]
  );

  // ethers.signMessage prefixes with "\x19Ethereum Signed Message:\n32"
  // which matches MessageHashUtils.toEthSignedMessageHash in the contract
  return signer.signMessage(ethers.getBytes(msgHash));
}

/**
 * Get a read-only provider for Gnosis Chain.
 */
export function getGnosisProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL, GNOSIS_CHAIN_ID);
}

/**
 * Get a read-only contract instance (no signer needed).
 */
export function getEscrowContract(): ethers.Contract {
  if (!ESCROW_ADDRESS) throw new Error("CHESSBUDDY_ESCROW_ADDRESS is not set");
  return new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, getGnosisProvider());
}

/**
 * Fetch the current on-chain status of a match.
 */
export async function getOnChainMatchStatus(matchId: string): Promise<{
  white: string;
  black: string;
  token: string;
  stakeAmount: bigint;
  totalPool: bigint;
  status: MatchStatus;
} | null> {
  try {
    const contract = getEscrowContract();
    const idBytes32 = matchIdBytes32(matchId);
    const result = await contract.getMatch(idBytes32);
    return {
      white:       result[0],
      black:       result[1],
      token:       result[2],
      stakeAmount: result[3],
      totalPool:   result[4],
      status:      Number(result[5]) as MatchStatus,
    };
  } catch {
    return null;
  }
}
