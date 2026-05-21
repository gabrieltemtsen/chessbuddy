"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Trophy, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { useCircles } from "@/contexts/CirclesContext";
import { shortenAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const { wallet, connect, disconnect } = useCircles();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-md">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
              Chess<span className="text-brand-600">Buddy</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/play" className="btn-ghost text-sm">Play</Link>
            <Link href="/leaderboard" className="btn-ghost text-sm flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn-ghost p-2 rounded-lg"
              aria-label="Toggle theme"
            >
              {/* Render nothing until mounted to avoid SSR/client mismatch */}
              {mounted && (theme === "dark" ? (
                <Sun className="w-4 h-4 text-slate-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              ))}
            </button>

            {/* Wallet */}
            {wallet.isConnected ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {wallet.crcBalance} CRC
                  </span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {shortenAddress(wallet.address!)}
                  </span>
                </div>
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full bg-brand-500 shadow-glow-green animate-pulse-slow"
                  )}
                />
                <button
                  onClick={disconnect}
                  className="text-xs text-slate-500 hover:text-red-500 transition-colors font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={wallet.isConnecting}
                className="btn-primary text-sm py-2 px-4"
              >
                {wallet.isConnecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
