"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, Zap, Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import type { GameMode, AIDifficulty } from "@/types";
import { cn } from "@/lib/utils";
import { ADMIN_WALLET_ADDRESS } from "@/lib/constants";

const STAKING_ENABLED = process.env.NEXT_PUBLIC_STAKING_ENABLED !== "false";

export default function PlayPage() {
  const router = useRouter();
  const { wallet, connect, stakeForMatch, hasEnough } = useCircles();

  const [mode, setMode] = useState<GameMode | null>(null);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("easy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = STAKING_ENABLED && (mode === "human" || (mode === "ai" && difficulty !== "easy"));

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

      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pt-5 pb-6">

        {/* Balance strip */}
        {wallet.isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-5 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-brand-500" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none mb-0.5">Your Balance</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{wallet.crcBalance} CRC</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!hasEnough && isPaid && (
                <span className="text-[11px] font-medium text-red-500">Low balance</span>
              )}
              <div className="w-2 h-2 rounded-full bg-brand-500" />
              <span className="text-[11px] font-mono text-slate-500">{wallet.address?.slice(0, 8)}…</span>
            </div>
          </motion.div>
        )}

        {/* Step 1 */}
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          1 · Game Mode
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <ModeCard
            icon={<Users className="w-5 h-5" />}
            title="vs Human"
            subtitle="Matchmaking"
            badge="1 CRC each"
            badgeColor="blue"
            dotColor="#3b82f6"
            selected={mode === "human"}
            onClick={() => setMode("human")}
          />
          <ModeCard
            icon={<Bot className="w-5 h-5" />}
            title="vs AI"
            subtitle="Always available"
            badge="Free / 1 CRC"
            badgeColor="green"
            dotColor="#22c55e"
            selected={mode === "ai"}
            onClick={() => setMode("ai")}
          />
        </div>

        {/* Step 2 - difficulty */}
        <AnimatePresence>
          {mode === "ai" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                2 · Difficulty
              </p>
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => {
                  const info = {
                    easy:   { label: "Easy",   sub: "Free",  emoji: "🌱", accent: "#22c55e" },
                    medium: { label: "Medium", sub: "1 CRC", emoji: "⚡", accent: "#f59e0b" },
                    hard:   { label: "Hard",   sub: "1 CRC", emoji: "🔥", accent: "#ef4444" },
                  }[d];
                  const active = difficulty === d;
                  return (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "flex flex-col items-center py-3.5 rounded-2xl border-2 transition-all",
                        active
                          ? "border-brand-500 bg-brand-500/10"
                          : "border-[var(--border)] bg-[var(--bg-secondary)]"
                      )}
                    >
                      <span className="text-xl mb-1">{info.emoji}</span>
                      <span className={cn(
                        "text-sm font-bold",
                        active ? "text-brand-500" : "text-slate-700 dark:text-slate-200"
                      )}>{info.label}</span>
                      <span className="text-[11px] font-medium mt-0.5" style={{ color: info.accent }}>
                        {info.sub}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stake info banner */}
        <AnimatePresence>
          {mode && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5 rounded-2xl mb-5",
                isPaid
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-brand-500/10 border border-brand-500/20"
              )}
            >
              <Shield className={cn("w-4 h-4 mt-0.5 flex-shrink-0", isPaid ? "text-amber-500" : "text-brand-500")} />
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                {isPaid ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">1 CRC staked.</span>{" "}
                    {mode === "human" ? "Win to earn 1.8 CRC (90% of pool)." : "Beat the AI to earn 0.9 CRC."}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">Free match</span> — no CRC staked. Just have fun!
                  </>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!mode || loading}
          onClick={handleStart}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all duration-200",
            mode && !loading
              ? "bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30"
              : loading
              ? "bg-brand-500 text-white opacity-80"
              : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isPaid ? "Staking CRC…" : "Starting game…"}
            </>
          ) : !wallet.isConnected ? (
            "Connect Wallet to Play"
          ) : mode ? (
            <>Start Match <ArrowRight className="w-5 h-5" /></>
          ) : (
            "Select a Mode Above"
          )}
        </motion.button>

      </main>
    </div>
  );
}

// ── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({
  icon, title, subtitle, badge, badgeColor, dotColor, selected, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: "blue" | "green";
  dotColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-4 rounded-2xl border-2 text-left overflow-hidden transition-all duration-200",
        selected
          ? "border-brand-500 bg-brand-500/10"
          : "border-[var(--border)] bg-[var(--bg-secondary)]"
      )}
    >
      {/* Chessboard pattern BG */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Dot accent */}
      <div
        className="absolute top-3 right-3 w-2 h-2 rounded-full"
        style={{ backgroundColor: selected ? dotColor : "transparent", boxShadow: selected ? `0 0 6px ${dotColor}` : "none", transition: "all 0.2s" }}
      />

      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all",
        selected ? "bg-brand-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
      )}>
        {icon}
      </div>

      <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-0.5">{title}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{subtitle}</p>

      <span className={cn(
        "self-start text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
        badgeColor === "blue"
          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
      )}>
        {badge}
      </span>
    </motion.button>
  );
}
