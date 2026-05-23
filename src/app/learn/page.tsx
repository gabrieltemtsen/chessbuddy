"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ChevronRight, ChevronLeft, BookOpen, Swords, CircleCheck } = require("lucide-react") as any;
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

/* ─── Lesson definitions ───────────────────────────────────────── */

interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tip: string;
  /** FEN to display on the board */
  fen: string;
  /** Squares to highlight as "can move here" */
  highlights: string[];
  /** Square the piece sits on (for origin highlight) */
  pieceSquare?: string;
  /** Whether the player can interact (drag) */
  interactive?: boolean;
  /** If interactive, the FEN after the correct move */
  interactiveFen?: string;
  /** Correct move in algebraic notation (e.g. "e2e4") */
  interactiveMove?: string;
}

const LESSONS: Lesson[] = [
  {
    id: "board",
    title: "The Board",
    subtitle: "8×8 squares, two armies",
    description:
      "Chess is played on an 8×8 board. Your pieces (White) start at the bottom; your opponent (Black) is at the top. Columns are called files (a–h) and rows are called ranks (1–8). You always start with White.",
    tip: "💡 The bottom-right square is always light — remember: 'light on right'.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    highlights: [],
  },
  {
    id: "pawn",
    title: "The Pawn ♙",
    subtitle: "Your frontline soldiers",
    description:
      "Pawns move forward one square at a time (or two squares on their very first move). They capture diagonally — one square forward-left or forward-right. They can never move backward. Reach the other end of the board and a pawn promotes to any piece you like (usually a Queen).",
    tip: "💡 Try it — drag the pawn on e2 forward!",
    fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
    highlights: ["e3", "e4"],
    pieceSquare: "e2",
    interactive: true,
    interactiveFen: "8/8/8/8/4P3/8/8/8 w - - 0 1",
    interactiveMove: "e2e4",
  },
  {
    id: "rook",
    title: "The Rook ♖",
    subtitle: "The straight-line powerhouse",
    description:
      "The Rook moves any number of squares horizontally or vertically — but cannot jump over other pieces. Two Rooks working together can control entire rows and columns. They're especially powerful in the endgame when the board opens up.",
    tip: "💡 Rooks love open files with no pawns blocking them.",
    fen: "8/8/8/8/4R3/8/8/8 w - - 0 1",
    highlights: ["e1", "e2", "e3", "e5", "e6", "e7", "e8", "a4", "b4", "c4", "d4", "f4", "g4", "h4"],
    pieceSquare: "e4",
  },
  {
    id: "knight",
    title: "The Knight ♘",
    subtitle: "The only piece that jumps",
    description:
      "The Knight moves in an 'L' shape: two squares in one direction, then one square perpendicular (or vice versa). Crucially, it can jump over any pieces in its way. Knights are trickiest for beginners to see — count the L-shape carefully.",
    tip: "💡 A Knight in the center controls up to 8 squares. Near a corner it only controls 2!",
    fen: "8/8/8/8/4N3/8/8/8 w - - 0 1",
    highlights: ["d6", "f6", "g5", "g3", "f2", "d2", "c3", "c5"],
    pieceSquare: "e4",
  },
  {
    id: "bishop",
    title: "The Bishop ♗",
    subtitle: "The diagonal ruler",
    description:
      "The Bishop moves any number of squares diagonally. Each player has two bishops — one stays on light squares, the other on dark squares, forever. Bishops are most powerful on open boards where long diagonals are available.",
    tip: "💡 A Bishop on b2 pointing at g7 is called a 'fianchettoed' bishop — very common in openings.",
    fen: "8/8/8/8/4B3/8/8/8 w - - 0 1",
    highlights: ["d5", "c6", "b7", "a8", "f5", "g6", "h7", "f3", "g2", "h1", "d3", "c2", "b1"],
    pieceSquare: "e4",
  },
  {
    id: "queen",
    title: "The Queen ♕",
    subtitle: "The most powerful piece",
    description:
      "The Queen combines the powers of the Rook and Bishop — she can move any number of squares in any direction: horizontally, vertically, or diagonally. Protect her carefully; losing the Queen early is almost always game over.",
    tip: "💡 Don't bring your Queen out too early — she can be chased away by smaller pieces, wasting moves.",
    fen: "8/8/8/8/4Q3/8/8/8 w - - 0 1",
    highlights: [
      "e1","e2","e3","e5","e6","e7","e8",
      "a4","b4","c4","d4","f4","g4","h4",
      "d5","c6","b7","a8","f5","g6","h7",
      "f3","g2","h1","d3","c2","b1",
    ],
    pieceSquare: "e4",
  },
  {
    id: "king",
    title: "The King ♔",
    subtitle: "Protect him at all costs",
    description:
      "The King moves exactly one square in any direction. He is the most important piece — if he is checkmated, you lose. The King can never move into a square where he would be captured. Castle early to keep him safe behind pawns.",
    tip: "💡 Castling moves your King two squares toward a Rook and jumps the Rook to the other side — the quickest way to safety.",
    fen: "8/8/8/8/4K3/8/8/8 w - - 0 1",
    highlights: ["d5","e5","f5","d4","f4","d3","e3","f3"],
    pieceSquare: "e4",
  },
  {
    id: "check",
    title: "Check & Checkmate",
    subtitle: "The goal of the game",
    description:
      "You put the opponent's King in 'check' when you attack it. They must escape check immediately — by moving the King, blocking with a piece, or capturing the attacker. If they can't escape, that's 'checkmate' and you win! In the position below, White's Queen delivers checkmate on h7 — the Black King has no escape.",
    tip: "💡 Always look for checks — they force your opponent to react, giving you control.",
    fen: "6k1/6Q1/5K2/8/8/8/8/8 w - - 0 1",
    highlights: ["h7", "h8", "g8"],
    pieceSquare: "g7",
  },
  {
    id: "ready",
    title: "You're Ready! 🎉",
    subtitle: "Time to play your first game",
    description:
      "You now know how every piece moves, what check and checkmate mean, and the basic goal of chess. The fastest way to improve is to play — start with Easy AI (free, no CRC needed) and practice what you just learned. Have fun!",
    tip: "💡 Don't worry about losing early games. Every grandmaster started exactly where you are now.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    highlights: [],
  },
];

/* ─── Component ────────────────────────────────────────────────── */

export default function LearnPage() {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [interactiveDone, setInteractiveDone] = useState(false);
  const [currentFen, setCurrentFen] = useState(LESSONS[0].fen);
  const [wrongMove, setWrongMove] = useState(false);

  const lesson = LESSONS[index];
  const isLast = index === LESSONS.length - 1;
  const isFirst = index === 0;

  const goTo = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);
      setInteractiveDone(false);
      setWrongMove(false);
      setCurrentFen(LESSONS[newIndex].fen);
    },
    []
  );

  const goNext = () => {
    if (!isLast) {
      setCompleted((prev) => new Set(prev).add(lesson.id));
      goTo(index + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) goTo(index - 1);
  };

  /* Handle interactive board drops */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onPieceDrop({ sourceSquare, targetSquare }: any): boolean {
    if (!lesson.interactive || interactiveDone) return false;

    const move = `${sourceSquare}${targetSquare}`;
    if (move === lesson.interactiveMove) {
      setCurrentFen(lesson.interactiveFen!);
      setInteractiveDone(true);
      setWrongMove(false);
      return true;
    }

    // Wrong move — shake feedback
    setWrongMove(true);
    setTimeout(() => setWrongMove(false), 600);
    return false;
  }

  /* Square highlight styles */
  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (lesson.pieceSquare) {
    customSquareStyles[lesson.pieceSquare] = {
      backgroundColor: "rgba(34, 197, 94, 0.4)",
      borderRadius: "4px",
    };
  }

  lesson.highlights.forEach((sq) => {
    customSquareStyles[sq] = {
      background:
        "radial-gradient(circle, rgba(34,197,94,0.55) 36%, transparent 40%)",
    };
  });

  const progress = ((index) / (LESSONS.length - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <BookOpen className="w-4 h-4" />
              Chess Basics
            </div>
            <span className="text-sm text-slate-400">
              {index + 1} / {LESSONS.length}
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Step pills */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {LESSONS.map((l, i) => (
              <button
                key={l.id}
                onClick={() => goTo(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-brand-500"
                    : completed.has(l.id)
                    ? "w-2 bg-brand-300"
                    : "w-2 bg-slate-300 dark:bg-slate-600"
                )}
                title={l.title}
              />
            ))}
          </div>
        </div>

        {/* Main card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
          >
            {/* Board side */}
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={wrongMove ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Chessboard options={{
                  position: currentFen,
                  allowDragging: !!lesson.interactive && !interactiveDone,
                  onPieceDrop,
                  squareStyles: customSquareStyles,
                  boardOrientation: "white",
                  boardStyle: {
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  },
                } as any} />
              </motion.div>

              {/* Interactive feedback */}
              {lesson.interactive && (
                <AnimatePresence>
                  {interactiveDone ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-semibold"
                    >
                      <CircleCheck className="w-4 h-4" />
                      Nice move! Keep going →
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "text-sm px-4 py-2 rounded-xl text-center",
                        wrongMove
                          ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}
                    >
                      {wrongMove ? "Not quite — try again!" : "Drag the highlighted piece to try it out"}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Text side */}
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">
                  Lesson {index + 1}
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
                  {lesson.title}
                </h1>
                <p className="text-brand-600 dark:text-brand-400 font-medium">
                  {lesson.subtitle}
                </p>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base">
                {lesson.description}
              </p>

              <div className="glass-card p-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {lesson.tip}
              </div>

              {/* Piece summary (non-board lessons) */}
              {lesson.id === "ready" && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { piece: "♙", name: "Pawn", move: "Forward" },
                    { piece: "♖", name: "Rook", move: "Straight" },
                    { piece: "♘", name: "Knight", move: "L-shape" },
                    { piece: "♗", name: "Bishop", move: "Diagonal" },
                    { piece: "♕", name: "Queen", move: "Any dir." },
                    { piece: "♔", name: "King", move: "1 square" },
                  ].map(({ piece, name, move }) => (
                    <div
                      key={name}
                      className="glass-card p-2 flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">{piece}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {name}
                      </span>
                      <span className="text-slate-400">{move}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-3 mt-2">
                {!isFirst && (
                  <button
                    onClick={goPrev}
                    className="btn-secondary flex items-center gap-2 px-5 py-3"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}

                {isLast ? (
                  <Link
                    href="/play"
                    className="btn-primary flex items-center gap-2 px-6 py-3 flex-1 justify-center"
                  >
                    <Swords className="w-5 h-5" />
                    Play Easy AI — Free!
                  </Link>
                ) : (
                  <button
                    onClick={goNext}
                    className="btn-primary flex items-center gap-2 px-6 py-3 flex-1 justify-center"
                  >
                    {index === 0 ? "Start Learning" : "Got it — Next"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lesson index chips */}
              <div className="flex flex-wrap gap-2 mt-1">
                {LESSONS.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => goTo(i)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      i === index
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-semibold"
                        : completed.has(l.id)
                        ? "border-brand-200 dark:border-brand-800 text-brand-400 bg-brand-50/50 dark:bg-brand-900/10"
                        : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                    )}
                  >
                    {completed.has(l.id) ? "✓ " : ""}{l.title}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
