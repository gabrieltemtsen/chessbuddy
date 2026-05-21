"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
// ChessboardOptions is re-exported from the main package in 5.x
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChessboardOptions = any;
import { Chess } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Flag, Handshake, RotateCcw, Bot, User, Loader2, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import type { Match, SquareHighlight } from "@/types";
import { formatTimer, resultLabel, getWinnerColor, shortenAddress, cn } from "@/lib/utils";
import { MATCH_POLL_INTERVAL_MS, AI_MOVE_DELAY_MS } from "@/lib/constants";
import type { Square } from "chess.js";

type ModalType = "resign" | "draw_offer" | "draw_received" | null;

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet } = useCircles();

  const [match, setMatch] = useState<Match | null>(null);
  const [chess] = useState(() => new Chess());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<SquareHighlight>({});
  const [modal, setModal] = useState<ModalType>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // Timers
  const [whiteTime, setWhiteTime] = useState(600_000);
  const [blackTime, setBlackTime] = useState(600_000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerColor =
    match?.players.white?.address === wallet.address
      ? "white"
      : match?.players.black?.address === wallet.address
      ? "black"
      : null;

  const isMyTurn =
    match?.status === "active" &&
    playerColor !== null &&
    chess.turn() === (playerColor === "white" ? "w" : "b");

  // ── Fetch match ──────────────────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const m: Match = data.match;

      setMatch(m);
      chess.load(m.fen);

      if (m.players.white) setWhiteTime(m.players.white.timeRemainingMs);
      if (m.players.black) setBlackTime(m.players.black.timeRemainingMs);

      if (m.status === "completed") {
        // Trigger payout then redirect to result
        await fetch(`/api/matches/${id}/payout`, { method: "POST" });
        router.push(`/result/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match.");
    } finally {
      setLoading(false);
    }
  }, [id, chess, router]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // Poll for opponent moves in PvP
  useEffect(() => {
    if (!match || match.mode === "ai" || match.status !== "active") return;
    if (isMyTurn) return;

    const interval = setInterval(fetchMatch, MATCH_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [match, isMyTurn, fetchMatch]);

  // Timer countdown
  useEffect(() => {
    if (!match || match.status !== "active") return;

    timerRef.current = setInterval(() => {
      const turn = chess.turn();
      if (turn === "w") {
        setWhiteTime((t) => {
          if (t <= 0) return 0;
          return t - 1000;
        });
      } else {
        setBlackTime((t) => {
          if (t <= 0) return 0;
          return t - 1000;
        });
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match, chess]);

  // ── Move handling (react-chessboard 5.x API) ─────────────────────────────
  function handleSquareClick({ square }: { piece: string | null; square: string }) {
    if (!isMyTurn || moveLoading || aiThinking) return;

    if (selectedSquare) {
      attemptMove(selectedSquare, square);
      setSelectedSquare(null);
      setHighlights({});
      return;
    }

    const piece = chess.get(square as Square);
    if (!piece || piece.color !== chess.turn()) return;

    setSelectedSquare(square);

    // Highlight legal destination squares
    const legalMoves = chess.moves({ square: square as Square, verbose: true });
    const newHighlights: SquareHighlight = {
      [square]: { background: "rgba(255, 255, 0, 0.4)" },
    };
    legalMoves.forEach((m) => {
      newHighlights[m.to] = {
        background: chess.get(m.to as Square)
          ? "rgba(255, 80, 80, 0.4)"
          : "radial-gradient(circle, rgba(0,0,0,0.18) 25%, transparent 27%)",
      };
    });
    setHighlights(newHighlights);
  }

  function handlePieceDrop({
    sourceSquare,
    targetSquare,
    piece,
  }: {
    piece: string;
    sourceSquare: string;
    targetSquare: string;
  }): boolean {
    if (!isMyTurn || moveLoading || aiThinking) return false;

    // Detect pawn promotion
    const promotion =
      piece.toLowerCase().includes("p") &&
      ((sourceSquare[1] === "7" && targetSquare[1] === "8") ||
        (sourceSquare[1] === "2" && targetSquare[1] === "1"))
        ? "q"
        : undefined;

    attemptMove(sourceSquare, targetSquare, promotion);
    setSelectedSquare(null);
    setHighlights({});
    return true; // optimistic — board state is reconciled via match.fen
  }

  async function attemptMove(from: string, to: string, promotion?: string): Promise<boolean> {
    setMoveLoading(true);
    try {
      const res = await fetch(`/api/matches/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, promotion, playerAddress: wallet.address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Illegal move");
        setTimeout(() => setError(null), 2000);
        return false;
      }

      const updatedMatch: Match = data.match;
      setMatch(updatedMatch);
      chess.load(updatedMatch.fen);

      if (updatedMatch.status === "completed") {
        await fetch(`/api/matches/${id}/payout`, { method: "POST" });
        router.push(`/result/${id}`);
        return true;
      }

      // If AI is thinking, show indicator
      if (updatedMatch.mode === "ai" && data.aiMove) {
        setAiThinking(false);
      } else if (updatedMatch.mode === "ai") {
        setAiThinking(true);
        setTimeout(() => setAiThinking(false), AI_MOVE_DELAY_MS[updatedMatch.difficulty ?? "medium"]);
      }

      return true;
    } catch {
      setError("Move failed. Please try again.");
      return false;
    } finally {
      setMoveLoading(false);
    }
  }

  // ── Resign ───────────────────────────────────────────────────────────────
  async function resign() {
    setModal(null);
    const res = await fetch(`/api/matches/${id}/resign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerAddress: wallet.address }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetch(`/api/matches/${id}/payout`, { method: "POST" });
      router.push(`/result/${id}`);
    } else {
      setError(data.error);
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────
  async function offerDraw() {
    setModal(null);
    await fetch(`/api/matches/${id}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerAddress: wallet.address, action: "offer" }),
    });
  }

  async function acceptDraw() {
    setModal(null);
    const res = await fetch(`/api/matches/${id}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerAddress: wallet.address, action: "accept" }),
    });
    if (res.ok) {
      await fetch(`/api/matches/${id}/payout`, { method: "POST" });
      router.push(`/result/${id}`);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Match not found.</p>
        </div>
      </div>
    );
  }

  const boardOrientation = playerColor === "black" ? "black" : "white";
  const whitePlayer = match.players.white;
  const blackPlayer = match.players.black;
  const currentTurn = chess.turn() === "w" ? "white" : "black";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col xl:flex-row gap-6 items-start justify-center">

          {/* ── Board area ── */}
          <div className="flex flex-col items-center w-full max-w-[600px]">

            {/* Opponent (top) */}
            <PlayerInfo
              player={boardOrientation === "white" ? blackPlayer : whitePlayer}
              color={boardOrientation === "white" ? "black" : "white"}
              isActive={currentTurn === (boardOrientation === "white" ? "black" : "white")}
              timeMs={boardOrientation === "white" ? blackTime : whiteTime}
              isAI={match.mode === "ai" && (boardOrientation === "white" ? blackPlayer?.isAI : whitePlayer?.isAI)}
            />

            {/* Board */}
            <div className="w-full relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-xl overflow-hidden shadow-board"
              >
                <Chessboard
                  options={{
                    position: chess.fen(),
                    boardOrientation,
                    onSquareClick: handleSquareClick,
                    onPieceDrop: handlePieceDrop,
                    squareStyles: highlights,
                    boardStyle: { borderRadius: "0" },
                    darkSquareStyle: { backgroundColor: "#B58863" },
                    lightSquareStyle: { backgroundColor: "#F0D9B5" },
                    allowDragging: isMyTurn && !moveLoading && !aiThinking,
                    animationDurationInMs: 150,
                  } as ChessboardOptions}
                />
              </motion.div>

              {/* AI thinking overlay */}
              <AnimatePresence>
                {aiThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/10 dark:bg-black/30 flex items-center justify-center rounded-xl"
                  >
                    <div className="glass-card px-5 py-3 flex items-center gap-3">
                      <Bot className="w-5 h-5 text-brand-500 animate-pulse" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        ChessBuddy AI is thinking…
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Self (bottom) */}
            <PlayerInfo
              player={boardOrientation === "white" ? whitePlayer : blackPlayer}
              color={boardOrientation === "white" ? "white" : "black"}
              isActive={currentTurn === (boardOrientation === "white" ? "white" : "black")}
              timeMs={boardOrientation === "white" ? whiteTime : blackTime}
              isMe
            />

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4" /> {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Sidebar ── */}
          <div className="w-full xl:w-72 flex flex-col gap-4 xl:sticky xl:top-20">

            {/* Match info */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Match</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode</span>
                  <span className="font-medium capitalize text-slate-900 dark:text-white">
                    {match.mode === "ai" ? `vs AI (${match.difficulty})` : "vs Human"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pool</span>
                  <span className="font-medium text-brand-500">{match.poolCRC} CRC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={cn(
                    "font-medium",
                    match.status === "active" ? "text-green-500" : "text-slate-500"
                  )}>
                    {isMyTurn ? "Your turn" : aiThinking ? "AI thinking…" : "Opponent's turn"}
                  </span>
                </div>
              </div>
            </div>

            {/* Move history */}
            <MoveHistory moves={match.moves} />

            {/* Captured pieces */}
            <CapturedPieces fen={chess.fen()} />

            {/* Draw offer banner */}
            <AnimatePresence>
              {(match.drawStatus === "offered_by_white" && playerColor === "black") ||
               (match.drawStatus === "offered_by_black" && playerColor === "white") ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-4 border border-yellow-400/30"
                >
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3 font-medium">
                    Your opponent offered a draw.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={acceptDraw} className="flex-1 btn-primary py-2 text-sm">Accept</button>
                    <button
                      onClick={() => fetch(`/api/matches/${id}/draw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerAddress: wallet.address, action: "decline" }) })}
                      className="flex-1 btn-secondary py-2 text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Game controls */}
            {match.status === "active" && playerColor && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions</h3>
                <div className="flex flex-col gap-2">
                  {match.mode === "human" && (
                    <button
                      onClick={() => setModal("draw_offer")}
                      className="btn-secondary py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      <Handshake className="w-4 h-4" />
                      Offer Draw
                    </button>
                  )}
                  <button
                    onClick={() => setModal("resign")}
                    className="btn-danger py-2.5 text-sm flex items-center justify-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Resign
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === "resign" && (
          <Modal onClose={() => setModal(null)}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flag className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Resign Match?</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Your opponent wins. Your staked CRC goes to them.</p>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 btn-secondary">Cancel</button>
                <button onClick={resign} className="flex-1 btn-danger">Yes, Resign</button>
              </div>
            </div>
          </Modal>
        )}
        {modal === "draw_offer" && (
          <Modal onClose={() => setModal(null)}>
            <div className="text-center">
              <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-7 h-7 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Offer a Draw?</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                If your opponent accepts, the match ends and each player gets 0.9 CRC back.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 btn-secondary">Cancel</button>
                <button onClick={offerDraw} className="flex-1 btn-primary">Send Offer</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function PlayerInfo({
  player, color, isActive, timeMs, isAI, isMe,
}: {
  player?: { address: string; isAI?: boolean } | undefined;
  color: "white" | "black";
  isActive: boolean;
  timeMs: number;
  isAI?: boolean;
  isMe?: boolean;
}) {
  const isLow = timeMs < 30_000;

  return (
    <div className={cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-2 transition-colors",
      isActive
        ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700"
        : "bg-slate-50 dark:bg-slate-800/50"
    )}>
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "w-6 h-6 rounded-full border-2",
          color === "white" ? "bg-white border-slate-300" : "bg-slate-900 border-slate-600"
        )} />
        <div>
          {isAI ? (
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">ChessBuddy AI</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {player ? shortenAddress(player.address) : "Waiting…"}
                {isMe && <span className="ml-1.5 text-xs text-brand-500 font-semibold">(you)</span>}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold",
        isActive ? "bg-brand-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
        isLow && isActive && "bg-red-500 text-white animate-pulse"
      )}>
        <Clock className="w-3.5 h-3.5" />
        {formatTimer(timeMs)}
      </div>
    </div>
  );
}

function MoveHistory({ moves }: { moves: string[] }) {
  const pairs: [string, string?][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);

  return (
    <div className="glass-card p-4 max-h-64 flex flex-col">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <RotateCcw className="w-3.5 h-3.5" /> Moves
      </h3>
      <div className="overflow-y-auto flex-1 space-y-1">
        {pairs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No moves yet</p>
        ) : (
          pairs.map(([white, black], i) => (
            <div key={i} className="flex items-center gap-1 text-sm">
              <span className="w-8 text-slate-400 font-mono text-xs">{i + 1}.</span>
              <span className="flex-1 font-mono text-slate-800 dark:text-slate-200 text-xs">{white}</span>
              <span className="flex-1 font-mono text-slate-800 dark:text-slate-200 text-xs">{black ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CapturedPieces({ fen }: { fen: string }) {
  const chess = new Chess(fen);
  const board = chess.board();

  const counts: Record<string, number> = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };
  board.flat().forEach((p) => { if (p) counts[p.type === p.type.toUpperCase() ? p.type : p.type]++;  });

  const startCounts: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };

  const whiteCaptured = Object.entries(startCounts)
    .filter(([k]) => k === k.toLowerCase())
    .flatMap(([k, start]) => Array(Math.max(0, start - (counts[k] ?? 0))).fill(pieceSymbol(k)));
  const blackCaptured = Object.entries(startCounts)
    .filter(([k]) => k === k.toUpperCase())
    .flatMap(([k, start]) => Array(Math.max(0, start - (counts[k] ?? 0))).fill(pieceSymbol(k)));

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Captured</h3>
      <div className="space-y-2">
        <div>
          <span className="text-xs text-slate-400 mr-1">White:</span>
          <span className="text-base">{whiteCaptured.join("") || "—"}</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 mr-1">Black:</span>
          <span className="text-base">{blackCaptured.join("") || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function pieceSymbol(type: string): string {
  const symbols: Record<string, string> = {
    p: "♟", n: "♞", b: "♝", r: "♜", q: "♛",
    P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕",
  };
  return symbols[type] ?? "";
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-card p-8 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
