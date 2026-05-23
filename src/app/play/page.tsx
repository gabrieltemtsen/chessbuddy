"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, Zap, Shield, Trophy, ArrowRight, Loader2, AlertCircle } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BookOpen } = require("lucide-react") as any;
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import type { GameMode, AIDifficulty } from "@/types";
import { cn } from "@/lib/utils";
import { ADMIN_WALLET_ADDRESS } from "@/lib/constants";

const DIFFICULTY_INFO = {
  easy: { label: "Easy", desc: "Beginner friendly · Free to play", color: "green", free: true },
  medium: { label: "Medium", desc: "Decent AI · 1 CRC stake", color: "yellow", free: false },
  hard: { label: "Hard", desc: "Strong AI · 1 CRC stake", color: "red", free: false },
};

export default function PlayPage() {
  const router = useRouter();
  const { wallet, connect, stakeForMatch, hasEnough } = useCircles();

  const [mode, setMode] = useState<GameMode | null>(null);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid =
    mode === "human" || (mode === "ai" && difficulty !== "easy");

  async function handleStart() {
    if (!wallet.isConnected) { await connect(); return; }

    setError(null);
    setLoading(true);

    try {
      let stakeTxHash: string | undefined;

      if (isPaid) {
        if (!hasEnough) {
          setError("You need at least 1 CRC to enter a paid match.");
          setLoading(false);
          return;
        }
        stakeTxHash = await stakeForMatch(ADMIN_WALLET_ADDRESS);
      }

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          difficulty: mode === "ai" ? difficulty : undefined,
          playerAddress: wallet.address,
          stakeTxHash,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create match.");

      if (mode === "human" && data.match.status === "waiting") {
        router.push(`/waiting?matchId=${data.match.id}`);
      } else {
        router.push(`/match/${data.match.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">New Game</h1>
            <p className="text-slate-500 dark:text-slate-400">Choose your game mode and difficulty, then start playing.</p>
          </div>

          {/* Wallet info */}
          {wallet.isConnected && (
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-brand-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{wallet.crcBalance} CRC available</div>
                  <div className="text-xs text-slate-500">{wallet.address?.slice(0, 10)}…</div>
                </div>
              </div>
              {!hasEnough && (
                <span className="badge badge-red flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Low balance
                </span>
              )}
            </div>
          )}

          {/* Step 1: Mode */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              1 · Game Mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModeCard
                icon={Users}
                title="vs Human"
                desc="Join matchmaking and face a real player. Both stake 1 CRC."
                badge="1 CRC each"
                badgeColor="blue"
                selected={mode === "human"}
                onClick={() => setMode("human")}
              />
              <ModeCard
                icon={Bot}
                title="vs AI Agent"
                desc="Always available. Easy is free; Medium & Hard cost 1 CRC."
                badge="Free / 1 CRC"
                badgeColor="green"
                selected={mode === "ai"}
                onClick={() => setMode("ai")}
              />
            </div>
          </div>

          {/* Step 2: Difficulty (AI only) */}
          <AnimatePresence>
            {mode === "ai" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  2 · Difficulty
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => {
                    const info = DIFFICULTY_INFO[d];
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          difficulty === d
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <div className="font-semibold text-slate-900 dark:text-white mb-1">{info.label}</div>
                        <div className="text-xs text-slate-500">{info.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stake info */}
          <AnimatePresence>
            {mode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-5 flex items-start gap-4"
              >
                <Shield className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {isPaid ? (
                    <>
                      <span className="font-semibold text-slate-900 dark:text-white">1 CRC will be staked</span> from your wallet and held by the platform.
                      {mode === "human"
                        ? " If you win, you receive 1.8 CRC (90% of the 2 CRC pool). On a draw, both players get 0.9 CRC back."
                        : " Beat the AI and receive 0.9 CRC back. On a draw, you get 0.9 CRC back."}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-900 dark:text-white">Easy AI is free</span> — no CRC is staked. Just play and have fun!
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            disabled={!mode || loading}
            onClick={handleStart}
            className="btn-primary w-full text-base py-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isPaid ? "Staking CRC…" : "Starting…"}
              </>
            ) : (
              <>
                {!wallet.isConnected ? "Connect Wallet to Play" : "Start Match"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Quick links */}
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <a href="/leaderboard" className="flex items-center gap-1.5 hover:text-brand-500 transition-colors">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </a>
            <a href="/learn" className="flex items-center gap-1.5 hover:text-brand-500 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> New to chess? Learn first
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function ModeCard({
  icon: Icon, title, desc, badge, badgeColor, selected, onClick,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  badge: string;
  badgeColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-5 rounded-2xl border-2 text-left transition-all hover:shadow-md",
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          selected ? "bg-brand-500" : "bg-slate-100 dark:bg-slate-700"
        )}>
          <Icon className={cn("w-5 h-5", selected ? "text-white" : "text-slate-600 dark:text-slate-300")} />
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      <div className="font-bold text-slate-900 dark:text-white mb-1">{title}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">{desc}</div>
      <span className={`badge badge-${badgeColor}`}>{badge}</span>
    </button>
  );
}
