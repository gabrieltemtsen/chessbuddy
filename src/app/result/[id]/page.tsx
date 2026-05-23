"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, Handshake, Swords, ArrowRight, Loader2, ExternalLink, RotateCcw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import type { Match } from "@/types";
import { resultLabel, getWinnerColor, cn } from "@/lib/utils";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet, refreshBalance } = useCircles();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then((d) => { setMatch(d.match); setLoading(false); })
      .catch(() => setLoading(false));
    refreshBalance();
  }, [id, refreshBalance]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!match) return null;

  const winnerColor = getWinnerColor(match.result);
  const isDraw = winnerColor === "draw";
  const myColor = match.players.white?.address === wallet.address ? "white" : "black";
  const iWon = winnerColor === myColor;
  const iLost = !isDraw && winnerColor !== null && !iWon;

  const prizeCRC =
    iWon && match.poolCRC > 0
      ? `+${(match.poolCRC * 0.9).toFixed(2)} CRC`
      : isDraw && match.poolCRC > 0
      ? `+${(0.9).toFixed(2)} CRC`
      : match.poolCRC > 0
      ? `−1.00 CRC`
      : null;

  const accent = iWon ? "#22c55e" : isDraw ? "#f59e0b" : "#64748b";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />

      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6">

        {/* Hero result card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 240 }}
          className="relative overflow-hidden rounded-3xl mb-4"
          style={{ background: `linear-gradient(135deg, ${accent}18 0%, transparent 60%)` }}
        >
          {/* Chessboard pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative px-6 py-8 text-center">
            {/* Trophy / icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 14 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: `${accent}22`, border: `2px solid ${accent}40` }}
            >
              {iWon ? (
                <Trophy className="w-10 h-10" style={{ color: accent }} />
              ) : isDraw ? (
                <Handshake className="w-10 h-10" style={{ color: accent }} />
              ) : (
                <Swords className="w-10 h-10" style={{ color: accent }} />
              )}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-4xl font-black mb-1"
              style={{ color: accent }}
            >
              {iWon ? "Victory!" : isDraw ? "Draw!" : "Defeat"}
            </motion.h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {resultLabel(match.result)}
            </p>

            {/* CRC badge */}
            {prizeCRC && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: "spring" }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-lg"
                style={{ backgroundColor: `${accent}22`, color: accent, border: `1px solid ${accent}40` }}
              >
                {prizeCRC}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Match details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] divide-y divide-[var(--border)] mb-4"
        >
          <DetailRow label="Mode" value={match.mode === "ai" ? `vs AI · ${match.difficulty ?? "easy"}` : "vs Human"} />
          <DetailRow label="Pool" value={match.poolCRC > 0 ? `${match.poolCRC} CRC` : "Free match"} />
          <DetailRow label="Platform fee" value={match.poolCRC > 0 ? "10%" : "—"} />
          {match.payoutTxHash && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500">Payout Tx</span>
              <a
                href={`https://gnosisscan.io/tx/${match.payoutTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-mono text-brand-500 hover:underline"
              >
                {match.payoutTxHash.slice(0, 12)}…
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {match.payoutComplete === false && match.poolCRC > 0 && (
            <p className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
              Payout pending — CRC will arrive shortly.
            </p>
          )}
        </motion.div>

        <div className="flex-1" />

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3"
        >
          <button
            onClick={() => router.push("/play")}
            className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center justify-center gap-2.5 transition-colors shadow-lg shadow-brand-500/25"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/leaderboard")}
            className="w-full py-3.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-secondary)] font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors hover:border-slate-400"
          >
            <Trophy className="w-4 h-4 text-brand-500" />
            View Leaderboard
          </button>
        </motion.div>

      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
