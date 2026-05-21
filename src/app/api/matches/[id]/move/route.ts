/**
 * POST /api/matches/[id]/move
 *
 * Validates and applies a player move server-side using chess.js.
 * If the match is vs AI and the game is still going, computes and
 * applies the AI response immediately, returning both moves in one response.
 *
 * Body: SubmitMoveRequest
 * Returns: SubmitMoveResponse
 */

import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getMatch, saveMatch } from "@/lib/db";
import { getAIMove } from "@/lib/chess/ai";
import type { SubmitMoveRequest } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: SubmitMoveRequest = await req.json();
    const { from, to, promotion, playerAddress } = body;

    const match = getMatch(id);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    if (match.status !== "active") {
      return NextResponse.json({ error: "Match is not active." }, { status: 400 });
    }

    // Determine which color this player is
    const playerColor =
      match.players.white?.address === playerAddress
        ? "white"
        : match.players.black?.address === playerAddress
        ? "black"
        : null;

    if (!playerColor) {
      return NextResponse.json({ error: "You are not a participant in this match." }, { status: 403 });
    }

    const chess = new Chess(match.fen);

    // Ensure it's this player's turn
    const turn = chess.turn() === "w" ? "white" : "black";
    if (turn !== playerColor) {
      return NextResponse.json({ error: "It's not your turn." }, { status: 400 });
    }

    // Apply the player's move
    let playerMove;
    try {
      playerMove = chess.move({ from, to, promotion: promotion ?? "q" });
    } catch {
      return NextResponse.json({ error: "Illegal move." }, { status: 400 });
    }

    if (!playerMove) {
      return NextResponse.json({ error: "Illegal move." }, { status: 400 });
    }

    match.moves.push(playerMove.san);
    match.fen = chess.fen();
    match.pgn = chess.pgn();

    // Check game over after player's move
    const gameOver = checkGameOver(chess, match);

    let aiMoveSan: string | undefined;

    // AI response (only if game not over and it's an AI match)
    if (!gameOver && match.mode === "ai" && !chess.isGameOver()) {
      const aiMove = getAIMove(chess.fen(), match.difficulty ?? "medium");
      if (aiMove) {
        chess.move(aiMove);
        aiMoveSan = aiMove.san;
        match.moves.push(aiMove.san);
        match.fen = chess.fen();
        match.pgn = chess.pgn();
        checkGameOver(chess, match); // check again after AI move
      }
    }

    saveMatch(match);
    return NextResponse.json({ match, aiMove: aiMoveSan });
  } catch (err) {
    console.error("[POST /api/matches/[id]/move]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

function checkGameOver(chess: Chess, match: { result: import("@/types").GameResult; status: import("@/types").MatchStatus; endedAt?: number }) {
  if (!chess.isGameOver()) return false;

  match.status = "completed";
  match.endedAt = Date.now();

  if (chess.isCheckmate()) {
    match.result = chess.turn() === "w" ? "black_wins" : "white_wins";
  } else if (chess.isStalemate() || chess.isDraw()) {
    match.result = "draw";
  }

  return true;
}
