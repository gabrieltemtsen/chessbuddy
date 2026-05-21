/**
 * ChessBuddy AI Engine
 *
 * Provides three difficulty levels powered by minimax with alpha-beta pruning:
 *  - Easy   → random legal move
 *  - Medium → 2-ply minimax (depth 2)
 *  - Hard   → 4-ply minimax with alpha-beta (depth 4)
 *
 * Uses piece-square tables for positional evaluation so the AI plays
 * sensibly rather than just capturing material.
 */

import { Chess, type Move } from "chess.js";
import type { AIDifficulty } from "@/types";
import { AI_DEPTH } from "@/lib/constants";

// ─── Piece values ──────────────────────────────────────────────────────────

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ─── Piece-square tables (white perspective, index 0 = a8, 63 = h1) ───────

const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

const PST: Record<string, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING_MID,
};

// ─── Evaluation ────────────────────────────────────────────────────────────

function squareIndex(square: string): number {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(square[1]);
  return rank * 8 + file;
}

function evaluateBoard(chess: Chess): number {
  let score = 0;

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;

      const file = "abcdefgh"[f];
      const rank = 8 - r;
      const sq = file + rank;
      const idx = squareIndex(sq);

      const baseValue = PIECE_VALUE[piece.type] ?? 0;
      const pst = PST[piece.type];
      const positional = pst ? (piece.color === "w" ? pst[idx] : pst[63 - idx]) : 0;
      const total = baseValue + positional;

      score += piece.color === "w" ? total : -total;
    }
  }

  return score;
}

// ─── Minimax ───────────────────────────────────────────────────────────────

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximising: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    if (chess.isCheckmate()) return isMaximising ? -100000 : 100000;
    if (chess.isDraw()) return 0;
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });

  if (isMaximising) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get the best AI move for the current position.
 * Returns a move object, or null if the game is over.
 */
export function getAIMove(fen: string, difficulty: AIDifficulty): Move | null {
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Easy: pure random
  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Medium / Hard: minimax
  const depth = AI_DEPTH[difficulty] ?? 2;
  const isWhite = chess.turn() === "w";

  let bestScore = isWhite ? -Infinity : Infinity;
  let bestMove: Move = moves[0];

  // Shuffle moves for variety at equal scores
  const shuffled = [...moves].sort(() => Math.random() - 0.5);

  for (const move of shuffled) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
