/**
 * POST /api/matches/[id]/payout
 *
 * Server-side payout logic. Called after a match completes.
 *
 * SECURITY NOTES:
 * - Only processes completed matches that haven't been paid out yet.
 * - Result is taken from server-side match state (never trusted from client).
 * - Admin wallet private key is server-side only (ADMIN_WALLET_PRIVATE_KEY env var).
 * - Prevents duplicate payouts via match.payoutComplete flag.
 *
 * ASSUMPTION: The admin wallet received both stakes during match creation.
 * The admin wallet sends CRC back to winner(s) via the Circles SDK server runner.
 *
 * For MVP, if ADMIN_WALLET_PRIVATE_KEY is not set, the payout is marked as
 * "pending_manual" and an admin must process it manually. This is documented
 * in the README as a known limitation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMatch, saveMatch, recordMatchResult } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = getMatch(id);

    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    if (match.status !== "completed") return NextResponse.json({ error: "Match is not completed." }, { status: 400 });
    if (match.payoutComplete) return NextResponse.json({ error: "Payout already processed." }, { status: 400 });
    if (match.poolCRC === 0) {
      // Easy AI — free match, no payout needed
      match.payoutComplete = true;
      saveMatch(match);
      // Record result in leaderboard
      await updateLeaderboard(match);
      return NextResponse.json({ message: "Free match — no payout required.", match });
    }

    const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;

    if (!adminPrivateKey) {
      // Mark as pending manual payout — admin must process via admin dashboard
      match.payoutComplete = false;
      saveMatch(match);
      await updateLeaderboard(match);
      return NextResponse.json({
        message: "Payout queued for manual processing. Set ADMIN_WALLET_PRIVATE_KEY to enable automatic payouts.",
        match,
        pendingManual: true,
      });
    }

    // ── Automatic payout via Circles SDK server runner ──────────────────
    // The admin wallet sends CRC to the winner using the same Circles transfer
    // flow (advanced pathfinding). This requires a trust path from admin → winner.
    //
    // For production: ensure the admin wallet has trust relationships set up
    // with all user wallets (or use a Circles Group token for direct transfers).

    const { Sdk } = await import("@aboutcircles/sdk");
    const { circlesConfig } = await import("@aboutcircles/sdk-core");
    const { createPrivateKeyRunner } = await import("@/lib/circles/serverRunner");
    type HumanAvatarType = Awaited<ReturnType<InstanceType<typeof Sdk>["getAvatar"]>>;

    const runner = await createPrivateKeyRunner(adminPrivateKey as `0x${string}`);
    const sdk = new Sdk(circlesConfig[100], runner);
    const adminAvatar = await sdk.getAvatar(runner.address!) as HumanAvatarType & {
      transfer: { advanced: (to: `0x${string}`, amount: bigint) => Promise<{ transactionHash: string }> }
    };

    const { result, players, mode } = match;
    const isPvP = mode === "human";
    const SCALE = BigInt("1000000000000000000"); // 1e18

    let payoutTxHash = "";

    if (result === "draw") {
      // Both players get 0.9 CRC back each
      const refundAmount = (SCALE * 9n) / 10n; // 0.9 CRC

      if (players.white && !players.white.isAI && players.white.hasStaked) {
        await adminAvatar.transfer.advanced(players.white.address as `0x${string}`, refundAmount);
      }
      if (isPvP && players.black && !players.black.isAI && players.black.hasStaked) {
        const receipt = await adminAvatar.transfer.advanced(players.black.address as `0x${string}`, refundAmount);
        payoutTxHash = receipt.transactionHash;
      }
    } else {
      // Determine winner address
      let winnerAddress: string | null = null;

      if (result === "white_wins" || result === "resign_black" || result === "timeout_black") {
        winnerAddress = players.white?.address ?? null;
      } else if (result === "black_wins" || result === "resign_white" || result === "timeout_white") {
        winnerAddress = players.black?.isAI ? null : (players.black?.address ?? null);
      }

      if (winnerAddress && winnerAddress !== "ai-agent") {
        // Winner gets 90% of pool
        const poolWei = BigInt(match.poolCRC) * SCALE;
        const winnerAmount = (poolWei * 9n) / 10n;

        const receipt = await adminAvatar.transfer.advanced(
          winnerAddress as `0x${string}`,
          winnerAmount
        );
        payoutTxHash = receipt.transactionHash;
      }
    }

    match.payoutComplete = true;
    match.payoutTxHash = payoutTxHash;
    saveMatch(match);

    await updateLeaderboard(match);

    return NextResponse.json({ match, payoutTxHash });
  } catch (err) {
    console.error("[POST /api/matches/[id]/payout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payout failed." },
      { status: 500 }
    );
  }
}

async function updateLeaderboard(match: Awaited<ReturnType<typeof getMatch>>) {
  if (!match) return;
  const { result, players, mode } = match;
  const isPvP = mode === "human";
  const pool = match.poolCRC;

  if (result === "draw") {
    if (players.white) recordMatchResult(players.white.address, "draw", isPvP ? 0.9 : pool * 0.9);
    if (isPvP && players.black && !players.black.isAI) recordMatchResult(players.black.address, "draw", 0.9);
  } else if (result === "white_wins" || result === "resign_black" || result === "timeout_black") {
    if (players.white) recordMatchResult(players.white.address, "win", pool * 0.9);
    if (isPvP && players.black && !players.black.isAI) recordMatchResult(players.black.address, "loss", 0);
  } else if (result === "black_wins" || result === "resign_white" || result === "timeout_white") {
    if (players.white) recordMatchResult(players.white.address, "loss", 0);
    if (players.black && !players.black.isAI) recordMatchResult(players.black.address, "win", pool * 0.9);
  }
}
