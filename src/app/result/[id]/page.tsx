"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Handshake, Swords, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";
import type { Match } from "@/types";
import { resultLabel, getWinnerColor, shortenAddress, cn } from "@/lib/utils";

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
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        </div>
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
      ? `+${(match.poolCRC * 0.9 / (match.mode === "human" ? 2 : 1)).toFixed(2)} CRC`
      : match.poolCRC > 0
      ? `-${(1).toFixed(2)} CRC`
      : "Free match";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="glass-card p-10 max-w-md w-full text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
              iWon ? "bg-brand-100 dark:bg-brand-900/40"
                : isDraw ? "bg-yellow-100 dark:bg-yellow-900/40"
                : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            {iWon ? (
              <Trophy className="w-12 h-12 text-brand-500" />
            ) : isDraw ? (
              <Handshake className="w-12 h-12 text-yellow-500" />
            ) : (
              <Swords className="w-12 h-12 text-slate-400" />
            )}
          </motion.div>

          {/* Result headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "text-3xl font-extrabold mb-2",
              iWon ? "text-brand-500"
                : isDraw ? "text-yellow-500"
                : "text-slate-900 dark:text-white"
            )}
          >
            {iWon ? "You Won!" : isDraw ? "It's a Draw!" : "You Lost"}
          </motion.h1>

          <p className="text-slate-500 dark:text-slate-400 mb-6">{resultLabel(match.result)}</p>

          {/* CRC result */}
          {match.poolCRC > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-lg mb-6",
                iWon ? "bg-brand-500 text-white"
                  : isDraw ? "bg-yellow-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              )}
            >
              {prizeCRC}
            </motion.div>
          )}

          {/* Match details */}
          <div className="space-y-2 mb-8 text-sm">
            <Row label="Mode" value={match.mode === "ai" ? `vs AI (${match.difficulty})` : "vs Human"} />
            <Row label="Pool" value={`${match.poolCRC} CRC`} />
            {match.payoutTxHash && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Payout Tx</span>
                <a
                  href={`https://gnosisscan.io/tx/${match.payoutTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:underline flex items-center gap-1 font-mono text-xs"
                >
                  {match.payoutTxHash.slice(0, 10)}… <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {match.payoutComplete === false && match.poolCRC > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Payout pending. Contact admin if CRC hasn't arrived within 24h.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Link href="/play" className="btn-primary flex items-center justify-center gap-2">
              <Swords className="w-5 h-5" />
              Play Again
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/leaderboard" className="btn-secondary flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
