/**
 * POST /api/matches/[id]/payout
 *
 * Server-side payout logic. Called after a match completes.
 *
 * ── Escrow model ──────────────────────────────────────────────────────────────
 *
 *  Stake flow:   Player  →  (1 CRC)  →  ChessBuddyOrg
 *  Payout flow:  ChessBuddyOrg  →  (0.9 CRC)  →  Winner
 *                ChessBuddyOrg  keeps 0.1 CRC (platform fee)
 *
 *  The payout is signed by the admin EOA (ADMIN_WALLET_PRIVATE_KEY), which
 *  is the Safe owner that controls the ChessBuddyOrg.
 *  We get the avatar for the ORG ADDRESS (not the EOA) so the transfer uses
 *  the org's trust graph.
 *
 * ── Trust requirement ─────────────────────────────────────────────────────────
 *  Circles transfers use pathfinding through the trust graph.
 *  For payouts to work, the ChessBuddyOrg must have a trust path to each
 *  winner. Recommended: register ChessBuddyOrg and have it trust all players
 *  who register, OR use a Circles Group token which allows direct transfers.
 *
 * ── Security ──────────────────────────────────────────────────────────────────
 *  - Only processes server-side match state (never trusts client for results).
 *  - Prevents duplicate payouts via match.payoutComplete flag.
 *  - ADMIN_WALLET_PRIVATE_KEY never leaves the server.
 *
 * ── MVP fallback ──────────────────────────────────────────────────────────────
 *  If ADMIN_WALLET_PRIVATE_KEY is not set, the payout is marked pending_manual.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMatch, saveMatch, recordMatchResult } from "@/lib/db";

const SCALE = BigInt("1000000000000000000"); // 1e18 = 1 CRC

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

    // Free match (Easy AI) — just update leaderboard, no CRC payout needed
    if (match.poolCRC === 0) {
      match.payoutComplete = true;
      await saveMatch(match);
      await updateLeaderboard(match);
      return NextResponse.json({ message: "Free match — no payout required.", match });
    }

    const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
    const orgAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

    if (!adminPrivateKey) {
      // No key set → queue for manual payout
      match.payoutComplete = false;
      await saveMatch(match);
      await updateLeaderboard(match);
      return NextResponse.json({
        message:
          "Payout queued for manual processing. Set ADMIN_WALLET_PRIVATE_KEY to enable automatic payouts.",
        match,
        pendingManual: true,
      });
    }

    // ── Automatic payout via Circles SDK ──────────────────────────────────────
    const { Sdk } = await import("@aboutcircles/sdk");
    const { circlesConfig } = await import("@aboutcircles/sdk-core");
    const { createPrivateKeyRunner } = await import("@/lib/circles/serverRunner");

    // The runner signs transactions as the admin EOA (Safe owner)
    const runner = await createPrivateKeyRunner(adminPrivateKey as `0x${string}`);
    const sdk = new Sdk(circlesConfig[100], runner);

    // Use the ORG avatar for transfers so the trust graph of ChessBuddyOrg
    // is used for pathfinding. Falls back to admin EOA if org address not set.
    const transferFromAddress = (orgAddress && orgAddress !== "0x0000000000000000000000000000000000000000")
      ? orgAddress
      : runner.address!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payerAvatar = await sdk.getAvatar(transferFromAddress as `0x${string}`) as any;

    const { result, players, mode } = match;
    const isPvP = mode === "human";
    let payoutTxHash = "";

    if (result === "draw") {
      // Both players get 0.9 CRC refunded
      const refundAmount = (SCALE * 9n) / 10n; // 0.9 CRC

      if (players.white && !players.white.isAI && players.white.hasStaked) {
        await payerAvatar.transfer.advanced(
          players.white.address as `0x${string}`,
          refundAmount
        );
      }
      if (isPvP && players.black && !players.black.isAI && players.black.hasStaked) {
        const receipt = await payerAvatar.transfer.advanced(
          players.black.address as `0x${string}`,
          refundAmount
        );
        payoutTxHash = receipt.transactionHash;
      }
    } else {
      // Single winner — gets 90% of pool
      let winnerAddress: string | null = null;

      if (result === "white_wins" || result === "resign_black" || result === "timeout_black") {
        winnerAddress = players.white?.address ?? null;
      } else if (result === "black_wins" || result === "resign_white" || result === "timeout_white") {
        winnerAddress = players.black?.isAI ? null : (players.black?.address ?? null);
      }

      if (winnerAddress && winnerAddress !== "ai-agent") {
        const winnerAmount = (BigInt(match.poolCRC) * SCALE * 9n) / 10n;
        const receipt = await payerAvatar.transfer.advanced(
          winnerAddress as `0x${string}`,
          winnerAmount
        );
        payoutTxHash = receipt.transactionHash;
      }
    }

    match.payoutComplete = true;
    match.payoutTxHash = payoutTxHash;
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

// ─── Leaderboard helper ────────────────────────────────────────────────────────

async function updateLeaderboard(match: Awaited<ReturnType<typeof getMatch>>) {
  if (!match) return;
  const { result, players, mode } = match;
  const isPvP = mode === "human";
  const pool = match.poolCRC;

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
