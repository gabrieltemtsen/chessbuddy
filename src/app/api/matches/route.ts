/**
 * POST /api/matches — Create a new match
 *
 * Body: CreateMatchRequest
 * Returns: { match: Match }
 *
 * For AI matches (Easy): no stake required, match starts immediately.
 * For AI matches (Medium / Hard) and all PvP matches: stake required.
 * For PvP: creates a "waiting" match and adds the player to the queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { saveMatch, enqueuePlayer, getQueueHead } from "@/lib/db";
import type { Match, CreateMatchRequest } from "@/types";
import { TIMER_DURATION_MS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body: CreateMatchRequest = await req.json();
    const { mode, difficulty, playerAddress, stakeTxHash } = body;

    if (!playerAddress) {
      return NextResponse.json({ error: "playerAddress is required." }, { status: 400 });
    }

    // Validate stake for paid modes
    const isPaidMode = mode === "human" || (mode === "ai" && difficulty !== "easy");
    if (isPaidMode && !stakeTxHash) {
      return NextResponse.json(
        { error: "stakeTxHash is required for paid matches." },
        { status: 400 }
      );
    }

    const chess = new Chess();
    const matchId = uuidv4();
    const now = Date.now();

    // For PvP: check if there's someone waiting in the queue
    if (mode === "human") {
      const waiting = getQueueHead(playerAddress);

      if (waiting) {
        // Match two players immediately
        const waitingMatch = await import("@/lib/db").then((db) =>
          db.getMatch(waiting.matchId)
        );

        if (waitingMatch && waitingMatch.status === "waiting") {
          // Assign the new player as black
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

          await import("@/lib/db").then((db) => {
            db.saveMatch(waitingMatch);
            db.dequeuePlayer(waiting.address);
          });

          return NextResponse.json({ match: waitingMatch });
        }
      }

      // No one waiting — create a new waiting match and join queue
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

      saveMatch(match);
      enqueuePlayer(playerAddress, matchId);
      return NextResponse.json({ match });
    }

    // AI match — starts immediately
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
          hasStaked: true, // AI doesn't stake; user's stake is the prize pool
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

    saveMatch(match);
    return NextResponse.json({ match });
  } catch (err) {
    console.error("[POST /api/matches]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  const { getAllMatches } = await import("@/lib/db");
  const matches = getAllMatches().slice(-50); // last 50 for admin view
  return NextResponse.json({ matches });
}
