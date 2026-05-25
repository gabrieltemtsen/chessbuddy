/**
 * POST /api/matches — Create a new match
 * GET  /api/matches — List recent matches (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { saveMatch, enqueuePlayer, getQueueHead, getMatch, dequeuePlayer, getAllMatches } from "@/lib/db";
import type { Match, CreateMatchRequest } from "@/types";
import { TIMER_DURATION_MS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body: CreateMatchRequest = await req.json();
    const { mode, difficulty, playerAddress, stakeTxHash } = body;

    if (!playerAddress) {
      return NextResponse.json({ error: "playerAddress is required." }, { status: 400 });
    }

    // STAKING_ENABLED is a server-side flag (no NEXT_PUBLIC_ prefix) that must
    // match NEXT_PUBLIC_STAKING_ENABLED on the frontend. Set both to "false" in
    // Vercel env vars to disable staking during development or while the
    // contract-based staking flow is being configured.
    const stakingEnabled = process.env.STAKING_ENABLED !== "false";
    const isPaidMode = mode === "human" || (mode === "ai" && difficulty !== "easy");
    if (stakingEnabled && isPaidMode && !stakeTxHash) {
      return NextResponse.json(
        { error: "stakeTxHash is required for paid matches." },
        { status: 400 }
      );
    }

    const chess = new Chess();
    const matchId = uuidv4();
    const now = Date.now();

    // ── PvP matchmaking ──────────────────────────────────────────────────────
    if (mode === "human") {
      const waiting = await getQueueHead(playerAddress);

      if (waiting) {
        const waitingMatch = await getMatch(waiting.matchId);

        if (waitingMatch && waitingMatch.status === "waiting") {
          waitingMatch.players.black = {
            address: playerAddress,
            color: "black",
            hasStaked: isPaidMode ? !!stakeTxHash : true,
            stakeTxHash,
            timeRemainingMs: TIMER_DURATION_MS,
          };
          waitingMatch.status = "active";
          waitingMatch.startedAt = now;
          waitingMatch.poolCRC = 2;

          await saveMatch(waitingMatch);
          await dequeuePlayer(waiting.address);

          return NextResponse.json({ match: waitingMatch });
        }
      }

      // Nobody waiting — create a new waiting match and join queue
      const match: Match = {
        id: matchId,
        mode,
        status: "waiting",
        players: {
          white: {
            address: playerAddress,
            color: "white",
            hasStaked: !!stakeTxHash,
            stakeTxHash,
            timeRemainingMs: TIMER_DURATION_MS,
          },
        },
        fen: chess.fen(),
        pgn: "",
        moves: [],
        result: null,
        drawStatus: "none",
        createdAt: now,
        payoutComplete: false,
        poolCRC: 1,
      };

      await saveMatch(match);
      await enqueuePlayer(playerAddress, matchId);
      return NextResponse.json({ match });
    }

    // ── AI match — starts immediately ────────────────────────────────────────
    const match: Match = {
      id: matchId,
      mode: "ai",
      difficulty: difficulty ?? "medium",
      status: "active",
      players: {
        white: {
          address: playerAddress,
          color: "white",
          hasStaked: isPaidMode ? !!stakeTxHash : true,
          stakeTxHash: isPaidMode ? stakeTxHash : undefined,
          timeRemainingMs: TIMER_DURATION_MS,
        },
        black: {
          address: "ai-agent",
          color: "black",
          hasStaked: true,
          isAI: true,
          timeRemainingMs: TIMER_DURATION_MS,
        },
      },
      fen: chess.fen(),
      pgn: "",
      moves: [],
      result: null,
      drawStatus: "none",
      createdAt: now,
      startedAt: now,
      payoutComplete: false,
      poolCRC: isPaidMode ? 1 : 0,
    };

    await saveMatch(match);
    return NextResponse.json({ match });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/matches]", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Internal server error." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const matches = await getAllMatches();
  return NextResponse.json({ matches: matches.slice(-50) });
}
