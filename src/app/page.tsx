"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Trophy, Zap, Shield, Users, Bot } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useCircles } from "@/contexts/CirclesContext";

// Per-item animation helpers using motion props directly (avoids Variants type complexity)
function itemAnim(i: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  };
}


export default function LandingPage() {
  const { wallet, connect, isMiniApp } = useCircles();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />

      {/* Hero */}
      <section className="flex-1 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-purple-600/5 dark:from-brand-600/5 dark:to-purple-600/10 pointer-events-none" />

        {/* Decorative board pattern */}
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-5 dark:opacity-10 pointer-events-none"
          style={{
            backgroundImage: `repeating-conic-gradient(#22c55e 0% 25%, transparent 0% 50%)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">
              <div>
                <motion.div {...itemAnim(0)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-sm font-semibold mb-6">
                  <Zap className="w-3.5 h-3.5" />
                  Built on Circles · Powered by CRC
                </motion.div>

                <motion.h1 {...itemAnim(1)} className="text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight mb-6">
                  Play Chess.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-brand-700">
                    Earn CRC.
                  </span>
                </motion.h1>

                <motion.p {...itemAnim(2)} className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mb-8 leading-relaxed">
                  ChessBuddy is a Web3 chess platform where every paid match puts real CRC on the line.
                  Challenge human players or our AI agent — winner takes 90% of the pool.
                </motion.p>

                <motion.div {...itemAnim(3)} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  {wallet.isConnected ? (
                    <Link href="/play" className="btn-primary text-base py-3.5 px-8 inline-flex items-center gap-2">
                      <Swords className="w-5 h-5" />
                      Start Playing
                    </Link>
                  ) : isMiniApp ? (
                    /* In miniapp mode the host is sending the wallet — show a spinner */
                    <button disabled className="btn-primary text-base py-3.5 px-8 inline-flex items-center gap-2 opacity-70">
                      <Swords className="w-5 h-5 animate-pulse" />
                      Connecting wallet…
                    </button>
                  ) : (
                    <button
                      onClick={connect}
                      disabled={wallet.isConnecting}
                      className="btn-primary text-base py-3.5 px-8 inline-flex items-center gap-2"
                    >
                      <Swords className="w-5 h-5" />
                      {wallet.isConnecting ? "Connecting…" : "Connect & Play"}
                    </button>
                  )}
                  <Link href="/leaderboard" className="btn-secondary text-base py-3.5 px-8 inline-flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Leaderboard
                  </Link>
                </motion.div>

                {wallet.error && (
                  <p className="mt-3 text-sm text-red-500">{wallet.error}</p>
                )}
              </div>
            </div>

            {/* Right: mini chess board visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex-shrink-0"
            >
              <MiniBoard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">How it works</h2>
            <p className="text-slate-500 dark:text-slate-400">Four simple steps to your first match</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, step: "1", title: "Connect Wallet", desc: "Connect your MetaMask or Rabby wallet on Gnosis Chain." },
              { icon: Swords, step: "2", title: "Choose Mode", desc: "Play vs a human opponent or our AI agent." },
              { icon: Zap, step: "3", title: "Stake 1 CRC", desc: "Stake 1 CRC to enter a paid match (Easy AI is free)." },
              { icon: Trophy, step: "4", title: "Win & Earn", desc: "Win the game and receive 90% of the CRC pool." },
            ].map(({ icon: Icon, step, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass-card p-6 text-center"
              >
                <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="text-xs font-bold text-brand-500 mb-2">STEP {step}</div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Game modes */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Game Modes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass-card p-8 flex items-start gap-5 cursor-pointer"
            >
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Play vs Human</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-3">Enter the matchmaking queue and face a real opponent. Both players stake 1 CRC — winner takes 1.8 CRC.</p>
                <span className="badge badge-blue">1 CRC stake</span>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass-card p-8 flex items-start gap-5 cursor-pointer"
            >
              <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bot className="w-7 h-7 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Play vs ChessBuddy AI</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-3">Always available. Easy mode is free. Medium & Hard require 1 CRC — beat the AI and take 0.9 CRC home.</p>
                <div className="flex gap-2">
                  <span className="badge badge-green">Easy — Free</span>
                  <span className="badge badge-yellow">Medium / Hard — 1 CRC</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-400">
          ChessBuddy · Built with the{" "}
          <a href="https://aboutcircles.com" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
            Circles Protocol
          </a>{" "}
          on Gnosis Chain · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

function MiniBoard() {
  const light = "#F0D9B5";
  const dark = "#B58863";
  const pieces: Record<string, string> = {
    "0,0": "♜", "1,0": "♞", "2,0": "♝", "3,0": "♛", "4,0": "♚", "5,0": "♝", "6,0": "♞", "7,0": "♜",
    "0,1": "♟", "1,1": "♟", "2,1": "♟", "3,1": "♟", "4,1": "♟", "5,1": "♟", "6,1": "♟", "7,1": "♟",
    "0,6": "♙", "1,6": "♙", "2,6": "♙", "3,6": "♙", "4,6": "♙", "5,6": "♙", "6,6": "♙", "7,6": "♙",
    "0,7": "♖", "1,7": "♘", "2,7": "♗", "3,7": "♕", "4,7": "♔", "5,7": "♗", "6,7": "♘", "7,7": "♖",
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-board border-4 border-slate-700 dark:border-slate-900">
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: 8 }, (_, col) => {
            const isLight = (row + col) % 2 === 0;
            const piece = pieces[`${col},${row}`];
            return (
              <div
                key={col}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-xl sm:text-2xl select-none"
                style={{ backgroundColor: isLight ? light : dark }}
              >
                {piece}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
