"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChessboardOptions = any;
import { Chess } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag, Handshake, RotateCcw, Bot, User,
  Loader2, AlertCircle, ArrowLeft, Zap,
} from "lucide-react";
import { useCircles } from "@/contexts/CirclesContext";
import type { Match, SquareHighlight } from "@/types";
import { formatTimer, getWinnerColor, shortenAddress, cn } from "@/lib/utils";
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

  const [whiteTime, setWhiteTime] = useState(600_000);
  const [blackTime, setBlackTime] = useState(600_000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerColor =
    match?.players.white?.address === wallet.address ? "white"
    : match?.players.black?.address === wallet.address ? "black"
    : null;

  const isMyTurn =
    match?.status === "active" &&
    playerColor !== null &&
    chess.turn() === (playerColor === "white" ? "w" : "b");

  // ── Fetch match ────────────────────────────────────────────────────────────
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
        await fetch(`/api/matches/${id}/payout`, { method: "POST" });
        router.push(`/result/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match.");
    } finally {
      setLoading(false);
    }
  }, [id, chess, router]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  useEffect(() => {
    if (!match || match.mode === "ai" || match.status !== "active") return;
    if (isMyTurn) return;
    const interval = setInterval(fetchMatch, MATCH_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [match, isMyTurn, fetchMatch]);

  useEffect(() => {
    if (!match || match.status !== "active") return;
    timerRef.current = setInterval(() => {
      const turn = chess.turn();
      if (turn === "w") setWhiteTime((t) => Math.max(0, t - 1000));
      else setBlackTime((t) => Math.max(0, t - 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match, chess]);

  // ── Square click ──────────────────────────────────────────────────────────
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
    const legalMoves = chess.moves({ square: square as Square, verbose: true });
    const newHighlights: SquareHighlight = {
      [square]: { background: "rgba(255,255,0,0.4)" },
    };
    legalMoves.forEach((m) => {
      newHighlights[m.to] = {
        background: chess.get(m.to as Square)
          ? "rgba(255,80,80,0.4)"
          : "radial-gradient(circle, rgba(0,0,0,0.18) 25%, transparent 27%)",
      };
    });
    setHighlights(newHighlights);
  }

  function handlePieceDrop({ sourceSquare, targetSquare, piece }: {
    piece: string | null | undefined;
    sourceSquare: string;
    targetSquare: string;
  }): boolean {
    if (!isMyTurn || moveLoading || aiThinking) return false;
    const pieceStr = typeof piece === "string" ? piece : "";
    const promotion =
      pieceStr.toLowerCase().includes("p") &&
      ((sourceSquare[1] === "7" && targetSquare[1] === "8") ||
        (sourceSquare[1] === "2" && targetSquare[1] === "1"))
        ? "q" : undefined;
    attemptMove(sourceSquare, targetSquare, promotion);
    setSelectedSquare(null);
    setHighlights({});
    return true;
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
      if (updatedMatch.mode === "ai" && !data.aiMove) {
        setAiThinking(true);
        setTimeout(() => setAiThinking(false), AI_MOVE_DELAY_MS[updatedMatch.difficulty ?? "medium"]);
      } else {
        setAiThinking(false);
      }
      return true;
    } catch {
      setError("Move failed. Please try again.");
      return false;
    } finally {
      setMoveLoading(false);
    }
  }

  async function resign() {
    setModal(null);
    const res = await fetch(`/api/matches/${id}/resign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerAddress: wallet.address }),
    });
    if (res.ok) {
      await fetch(`/api/matches/${id}/payout`, { method: "POST" });
      router.push(`/result/${id}`);
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

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

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] gap-3">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-sm text-slate-500">Loading match…</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-slate-500">Match not found.</p>
      </div>
    );
  }

  const boardOrientation = playerColor === "black" ? "black" : "white";
  const topPlayer    = boardOrientation === "white" ? match.players.black : match.players.white;
  const bottomPlayer = boardOrientation === "white" ? match.players.white : match.players.black;
  const topColor     = boardOrientation === "white" ? "black" : "white";
  const bottomColor  = boardOrientation === "white" ? "white" : "black";
  const topTimeMs    = boardOrientation === "white" ? blackTime : whiteTime;
  const bottomTimeMs = boardOrientation === "white" ? whiteTime : blackTime;
  const currentTurn  = chess.turn() === "w" ? "white" : "black";
  const topIsAI    = match.mode === "ai" && topPlayer?.isAI;
  const drawOfferedToMe =
    (match.drawStatus === "offered_by_white" && playerColor === "black") ||
    (match.drawStatus === "offered_by_black" && playerColor === "white");

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">

      {/* ── Slim top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={() => router.push("/play")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">New Game</span>
        </button>

        <div className="flex items-center gap-2">
          {match.poolCRC > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {match.poolCRC} CRC Pool
              </span>
            </div>
          )}
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold",
            match.status === "active"
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "bg-slate-200 dark:bg-slate-700 text-slate-500"
          )}>
            {match.status === "active"
              ? isMyTurn ? "Your turn" : aiThinking ? "AI thinking…" : "Waiting…"
              : "Finished"}
          </div>
        </div>
      </div>

      {/* ── Main board area ── */}
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-3 py-3">

        {/* Opponent (top) */}
        <PlayerBar
          player={topPlayer}
          color={topColor}
          isActive={currentTurn === topColor}
          timeMs={topTimeMs}
          isAI={topIsAI}
          isMe={false}
        />

        {/* Board */}
        <div className="relative w-full mb-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl overflow-hidden shadow-2xl"
          >
            <Chessboard
              options={{
                position: chess.fen(),
                boardOrientation,
                onSquareClick: handleSquareClick,
                onPieceDrop: handlePieceDrop,
                squareStyles: highlights,
                boardStyle: { borderRadius: "0", width: "100%" },
                darkSquareStyle: { backgroundColor: "#B58863" },
                lightSquareStyle: { backgroundColor: "#F0D9B5" },
                allowDragging: isMyTurn && !moveLoading && !aiThinking,
                animationDurationInMs: 120,
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
                className="absolute inset-0 bg-black/20 flex items-end justify-center pb-4 rounded-xl"
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm">
                  <Bot className="w-4 h-4 text-brand-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">AI is thinking…</span>
                  <span className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-brand-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Move error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/90 text-white text-xs font-semibold shadow-lg"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Me (bottom) */}
        <PlayerBar
          player={bottomPlayer}
          color={bottomColor}
          isActive={currentTurn === bottomColor}
          timeMs={bottomTimeMs}
          isAI={false}
          isMe={true}
        />

        {/* Move history strip */}
        <MoveStrip moves={match.moves} />

        {/* Draw offer banner */}
        <AnimatePresence>
          {drawOfferedToMe && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30"
            >
              <Handshake className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium flex-1">
                Opponent offered a draw
              </p>
              <button
                onClick={acceptDraw}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-500 text-white"
              >
                Accept
              </button>
              <button
                onClick={() => fetch(`/api/matches/${id}/draw`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ playerAddress: wallet.address, action: "decline" }),
                })}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Decline
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {match.status === "active" && playerColor && (
          <div className="mt-3 flex gap-3">
            {match.mode === "human" && (
              <button
                onClick={() => setModal("draw_offer")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-secondary)] text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 transition-all"
              >
                <Handshake className="w-4 h-4" />
                Draw
              </button>
            )}
            <button
              onClick={() => setModal("resign")}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition-all"
            >
              <Flag className="w-4 h-4" />
              Resign
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === "resign" && (
          <BottomSheet onClose={() => setModal(null)}>
            <div className="text-center pb-2">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flag className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Resign match?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Your opponent wins and receives the CRC pool.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-[var(--border)] text-sm font-bold text-slate-700 dark:text-slate-200">
                  Cancel
                </button>
                <button onClick={resign} className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold">
                  Yes, Resign
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
        {modal === "draw_offer" && (
          <BottomSheet onClose={() => setModal(null)}>
            <div className="text-center pb-2">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-7 h-7 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Offer a draw?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                If accepted, both players each get 0.9 CRC back.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-[var(--border)] text-sm font-bold text-slate-700 dark:text-slate-200">
                  Cancel
                </button>
                <button onClick={offerDraw} className="flex-1 py-3 rounded-2xl bg-brand-500 text-white text-sm font-bold">
                  Send Offer
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Player Bar ────────────────────────────────────────────────────────────────

function PlayerBar({
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
      "flex items-center justify-between px-3.5 py-2.5 rounded-2xl mb-1.5 transition-all duration-300",
      isActive
        ? "bg-[var(--bg-secondary)] border border-brand-500/30 shadow-sm"
        : "bg-transparent"
    )}>
      <div className="flex items-center gap-2.5">
        {/* Avatar circle */}
        <div className={cn(
          "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold",
          color === "white"
            ? "bg-[#F0D9B5] border-[#B58863] text-[#5a3e28]"
            : "bg-[#2d2d2d] border-[#B58863] text-[#F0D9B5]"
        )}>
          {isAI ? "AI" : isMe ? "ME" : color === "white" ? "♔" : "♚"}
        </div>

        <div>
          {isAI ? (
            <div className="flex items-center gap-1.5">
              <Bot className="w-3 h-3 text-brand-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">ChessBuddy AI</span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {player ? shortenAddress(player.address) : "Waiting…"}
              {isMe && <span className="ml-1.5 text-[11px] text-brand-500 font-bold">(you)</span>}
            </span>
          )}
          <p className="text-[10px] text-slate-500 capitalize">{color} pieces</p>
        </div>
      </div>

      {/* Timer */}
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold min-w-[72px] justify-center transition-all",
        isActive
          ? isLow
            ? "bg-red-500 text-white animate-pulse"
            : "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
      )}>
        {formatTimer(timeMs)}
      </div>
    </div>
  );
}

// ── Move Strip ────────────────────────────────────────────────────────────────

function MoveStrip({ moves }: { moves: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [moves]);

  if (moves.length === 0) return null;

  const pairs: [string, string?][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);

  return (
    <div className="mt-3 flex items-center gap-2">
      <RotateCcw className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div
        ref={ref}
        className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {pairs.map(([white, black], i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-slate-400 font-mono w-4 text-right">{i + 1}.</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-slate-700 dark:text-slate-200">
              {white}
            </span>
            {black && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-slate-700 dark:text-slate-200">
                {black}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-t-3xl sm:rounded-3xl px-6 pt-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-5 sm:hidden" />
        {children}
      </motion.div>
    </motion.div>
  );
}
