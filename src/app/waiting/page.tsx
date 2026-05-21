"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, X, Bot, Users } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import { MATCH_POLL_INTERVAL_MS, MATCHMAKING_TIMEOUT_MS } from "@/lib/constants";
import type { Match } from "@/types";

export default function WaitingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const matchId = params.get("matchId");
  const { wallet } = useCircles();

  const [waitMs, setWaitMs] = useState(0);
  const [match, setMatch] = useState<Match | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [suggestAI, setSuggestAI] = useState(false);

  const cancelMatch = useCallback(async () => {
    if (!wallet.address || !matchId) return;
    setCancelled(true);
    await fetch("/api/matchmaking", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: wallet.address, matchId }),
    });
    router.push("/play");
  }, [wallet.address, matchId, router]);

  useEffect(() => {
    if (!matchId || !wallet.address) return;

    const start = Date.now();
    const interval = setInterval(async () => {
      const elapsed = Date.now() - start;
      setWaitMs(elapsed);

      if (elapsed > MATCHMAKING_TIMEOUT_MS) {
        setSuggestAI(true);
      }

      try {
        const res = await fetch(`/api/matchmaking?address=${wallet.address}`);
        const data = await res.json();

        if (data.status === "matched" && data.match) {
          setMatch(data.match);
          clearInterval(interval);
          router.push(`/match/${data.match.id}`);
        }
      } catch {
        // ignore poll errors
      }
    }, MATCH_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [matchId, wallet.address, router]);

  async function switchToAI() {
    // Cancel the human match and redirect to AI play
    await cancelMatch();
    router.push("/play?mode=ai");
  }

  const minutes = Math.floor(waitMs / 60000);
  const seconds = Math.floor((waitMs % 60000) / 1000);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              <Loader2 className="w-10 h-10 text-brand-500" />
            </motion.div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Finding an opponent…
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Waiting for a human player to join your match.
          </p>

          {/* Timer */}
          <div className="text-4xl font-mono font-bold text-brand-500 mb-2">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <p className="text-xs text-slate-400 mb-8">Time in queue</p>

          {/* Animated dots */}
          <div className="flex justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-brand-400"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </div>

          {/* Suggest AI */}
          {suggestAI && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700"
            >
              <p className="text-sm text-brand-700 dark:text-brand-300 mb-3">
                No opponent found yet. Want to play against the ChessBuddy AI instead?
              </p>
              <button
                onClick={switchToAI}
                className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
              >
                <Bot className="w-4 h-4" />
                Switch to AI Match
              </button>
            </motion.div>
          )}

          {/* Cancel */}
          <button
            onClick={cancelMatch}
            disabled={cancelled}
            className="btn-ghost text-sm flex items-center gap-2 mx-auto text-slate-500"
          >
            <X className="w-4 h-4" />
            {cancelled ? "Cancelling…" : "Cancel & Go Back"}
          </button>

          {/* Match info */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Match ID: <span className="font-mono">{matchId?.slice(0, 8)}…</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
