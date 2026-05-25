/**
 * POST /api/matches/[id]/payout
 *
 * Payout logic — two modes depending on env vars:
 *
 * ── MODE A: Smart-contract escrow (recommended, use when CHESSBUDDY_ESCROW_ADDRESS is set)
 *    1. Backend signs the winner's address (or ZeroAddress for draw) with ADMIN_WALLET_PRIVATE_KEY.
 *    2. Backend calls settleMatch() on the ChessBuddyEscrow contract.
 *       • Contract releases (pool × 90%) → winner, (pool × 10%) → feeRecipient.
 *       • Draw: full refund to both players, no fee.
 *    Either player can also submit the signature from the frontend — the backend
 *    does it here so payouts are automatic.
 *
 * ── MODE B: Circles SDK direct transfer (legacy, used when no contract address is set)
 *    Admin wallet pushes CRC directly to the winner via Circles pathfinding.
 *    Requires the org to have a trust path to the winner.
 *
 * Security (both modes)
 * ─────────────────────
 * - Result comes from server-side match state (never trusted from the client).
 * - Duplicate payout prevented via match.payoutComplete flag.
 * - ADMIN_WALLET_PRIVATE_KEY never leaves the server.
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getMatch, saveMatch, recordMatchResult } from "@/lib/db";
import {
  signMatchResult,
  matchIdBytes32,
  ESCROW_ABI,
  ESCROW_ADDRESS,
  GNOSIS_CHAIN_ID,
} from "@/lib/contract/escrow";

const SCALE = BigInt("1000000000000000000"); // 1e18 = 1 CRC
const USE_CONTRACT = !!ESCROW_ADDRESS;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = await getMatch(id);

    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    if (match.status !== "completed") {
      return NextResponse.json({ error: "Match is not completed." }, { status: 400 });
    }
    if (match.payoutComplete) {
      return NextResponse.json({ error: "Payout already processed." }, { status: 400 });
    }

    // Free match (Easy AI) — no CRC stake involved
    if (match.poolCRC === 0) {
      match.payoutComplete = true;
      await saveMatch(match);
      await updateLeaderboard(match);
      return NextResponse.json({ message: "Free match — no payout required.", match });
    }

    // ── Route to the correct payout mode ─────────────────────────────────────
    const payoutTxHash = USE_CONTRACT
      ? await contractPayout(id, match)
      : await circlesPayout(match);

    match.payoutComplete = true;
    match.payoutTxHash   = payoutTxHash ?? "";
    await saveMatch(match);
    await updateLeaderboard(match);

    return NextResponse.json({ match, payoutTxHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/matches/[id]/payout]", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Payout failed." },
      { status: 500 }
    );
  }
}

// ── MODE A: Smart-contract payout ─────────────────────────────────────────────

async function contractPayout(
  matchId: string,
  match: NonNullable<Awaited<ReturnType<typeof getMatch>>>
): Promise<string> {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("ADMIN_WALLET_PRIVATE_KEY is not set");

  // Determine winner address for the contract
  const winnerAddress = resolveWinnerAddress(match);

  // Sign the result  (winner = ZeroAddress → draw)
  const signature = await signMatchResult(
    matchId,
    winnerAddress ?? ethers.ZeroAddress,
    GNOSIS_CHAIN_ID
  );

  // Submit settlement from the admin wallet
  const provider = new ethers.JsonRpcProvider(
    process.env.GNOSIS_RPC_URL ?? "https://rpc.gnosischain.com",
    GNOSIS_CHAIN_ID
  );
  const adminWallet = new ethers.Wallet(privateKey, provider);
  const escrow      = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, adminWallet);

  const idBytes32 = matchIdBytes32(matchId);
  const tx = await escrow.settleMatch(
    idBytes32,
    winnerAddress ?? ethers.ZeroAddress,
    signature
  );
  const receipt = await tx.wait();
  console.log(`[escrow] settleMatch tx: ${receipt.hash}`);
  return receipt.hash as string;
}

/** Resolve the on-chain winner address from the match result, or null for draw */
function resolveWinnerAddress(
  match: NonNullable<Awaited<ReturnType<typeof getMatch>>>
): string | null {
  const { result, players, mode } = match;
  const isPvP = mode === "human";

  if (result === "draw") return null;

  if (result === "white_wins" || result === "resign_black" || result === "timeout_black") {
    return players.white?.address ?? null;
  }
  if (result === "black_wins" || result === "resign_white" || result === "timeout_white") {
    if (isPvP && players.black && !players.black.isAI) {
      return players.black.address ?? null;
    }
    return null; // AI won — no on-chain winner; funds stay in contract, admin claims
  }
  return null;
}

// ── MODE B: Legacy Circles SDK payout ────────────────────────────────────────

async function circlesPayout(
  match: NonNullable<Awaited<ReturnType<typeof getMatch>>>
): Promise<string> {
  const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  const orgAddress      = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

  if (!adminPrivateKey) {
    // No key → queue for manual payout
    await saveMatch(match);
    await updateLeaderboard(match);
    throw new Error(
      "No ADMIN_WALLET_PRIVATE_KEY — payout queued for manual processing."
    );
  }

  const { Sdk } = await import("@aboutcircles/sdk");
  const { circlesConfig } = await import("@aboutcircles/sdk-core");
  const { createPrivateKeyRunner } = await import("@/lib/circles/serverRunner");

  const runner = await createPrivateKeyRunner(adminPrivateKey as `0x${string}`);
  const sdk    = new Sdk(circlesConfig[100], runner);

  const transferFrom = (orgAddress && orgAddress !== "0x0000000000000000000000000000000000000000")
    ? orgAddress
    : runner.address!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payerAvatar = await sdk.getAvatar(transferFrom as `0x${string}`) as any;

  const { result, players, mode } = match;
  const isPvP = mode === "human";
  let payoutTxHash = "";

  if (result === "draw") {
    const refundAmount = (SCALE * 9n) / 10n; // 0.9 CRC each
    if (players.white && !players.white.isAI && players.white.hasStaked) {
      await payerAvatar.transfer.advanced(players.white.address as `0x${string}`, refundAmount);
    }
    if (isPvP && players.black && !players.black.isAI && players.black.hasStaked) {
      const r = await payerAvatar.transfer.advanced(players.black.address as `0x${string}`, refundAmount);
      payoutTxHash = r.transactionHash;
    }
  } else {
    const winnerAddress = resolveWinnerAddress(match);
    if (winnerAddress) {
      const winnerAmount = (BigInt(match.poolCRC) * SCALE * 9n) / 10n;
      const r = await payerAvatar.transfer.advanced(winnerAddress as `0x${string}`, winnerAmount);
      payoutTxHash = r.transactionHash;
    }
  }

  return payoutTxHash;
}

// ── Leaderboard helper ────────────────────────────────────────────────────────

async function updateLeaderboard(match: Awaited<ReturnType<typeof getMatch>>) {
  if (!match) return;
  const { result, players, mode } = match;
  const isPvP = mode === "human";
  const pool  = match.poolCRC;

  if (result === "draw") {
    if (players.white) recordMatchResult(players.white.address, "draw", isPvP ? 0.9 : pool * 0.9);
    if (isPvP && players.black && !players.black.isAI) {
      recordMatchResult(players.black.address, "draw", 0.9);
    }
  } else if (result === "white_wins" || result === "resign_black" || result === "timeout_black") {
    if (players.white) recordMatchResult(players.white.address, "win", pool * 0.9);
    if (isPvP && players.black && !players.black.isAI) {
      recordMatchResult(players.black.address, "loss", 0);
    }
  } else if (result === "black_wins" || result === "resign_white" || result === "timeout_white") {
    if (players.white) recordMatchResult(players.white.address, "loss", 0);
    if (players.black && !players.black.isAI) {
      recordMatchResult(players.black.address, "win", pool * 0.9);
    }
  }
}
