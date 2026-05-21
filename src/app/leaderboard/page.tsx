"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Loader2, ExternalLink } from "lucide-react";
import { Header } from "@/components/layout/Header";
import type { LeaderboardEntry } from "@/types";
import { shortenAddress, cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => { setEntries(d.leaderboard); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      <main className="max-w-3xl mx-auto w-full px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Leaderboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Top ChessBuddy players tracked on-chain</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500">No games played yet. Be the first!</p>
            </div>
          ) : (
            <>
              {/* Top 3 podium */}
              {topThree.length > 0 && (
                <div className="grid grid-cols-3 gap-4 items-end mb-8">
                  {[1, 0, 2].map((idx) => {
                    const entry = topThree[idx];
                    if (!entry) return <div key={idx} />;
                    const rank = idx + 1;
                    const heights = { 0: "h-36", 1: "h-28", 2: "h-24" };
                    const colors = {
                      0: "from-yellow-400 to-yellow-600",
                      1: "from-slate-300 to-slate-500",
                      2: "from-orange-400 to-orange-600",
                    };
                    const medals = { 0: "🥇", 1: "🥈", 2: "🥉" };
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex flex-col items-center"
                      >
                        <div className="text-2xl mb-1">{medals[idx as 0|1|2]}</div>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-2 truncate max-w-full">
                          {shortenAddress(entry.address, 3)}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">{entry.points} pts</div>
                        <div className={cn(
                          "w-full rounded-t-xl bg-gradient-to-b flex items-end justify-center pb-3",
                          heights[idx as 0|1|2],
                          `bg-gradient-to-b ${colors[idx as 0|1|2]}`
                        )}>
                          <span className="text-white text-xs font-bold">{rank}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Full table */}
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {["Rank", "Player", "W", "L", "D", "Points", "CRC Earned"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => (
                      <motion.tr
                        key={entry.address}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn(
                          "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          i < 3 && "bg-brand-50/30 dark:bg-brand-900/10"
                        )}
                      >
                        <td className="px-4 py-3">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                            <span className="text-slate-400 font-mono">#{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://gnosisscan.io/address/${entry.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-brand-500 hover:underline flex items-center gap-1"
                          >
                            {shortenAddress(entry.address)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold">{entry.wins}</td>
                        <td className="px-4 py-3 text-red-500 font-semibold">{entry.losses}</td>
                        <td className="px-4 py-3 text-yellow-600 dark:text-yellow-400 font-semibold">{entry.draws}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-white">{entry.points}</span>
                        </td>
                        <td className="px-4 py-3 text-brand-500 font-semibold">
                          {entry.crcEarned.toFixed(2)} CRC
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-center text-slate-400">
                Points: 3 for win · 1 for draw · 0 for loss · CRC earnings tracked on Gnosis Chain
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
