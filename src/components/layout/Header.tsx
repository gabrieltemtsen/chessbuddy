"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Swords, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useCircles } from "@/contexts/CirclesContext";
import { shortenAddress, cn } from "@/lib/utils";

export function Header() {
  const { wallet, connect, disconnect, isMiniApp } = useCircles();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-between h-12">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow">
              <Swords className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              Chess<span className="text-brand-500">Buddy</span>
            </span>
          </Link>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            {/* Leaderboard icon link */}
            <Link
              href="/leaderboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 transition-colors"
              title="Leaderboard"
            >
              <Trophy className="w-4 h-4" />
            </Link>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (
                theme === "dark"
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Wallet state */}
            {wallet.isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end leading-none">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {wallet.crcBalance} CRC
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {shortenAddress(wallet.address!)}
                  </span>
                </div>
                <div className={cn(
                  "w-2 h-2 rounded-full bg-brand-500 flex-shrink-0",
                  "shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                )} />
                {!isMiniApp && (
                  <button
                    onClick={disconnect}
                    className="text-[10px] text-slate-400 hover:text-red-500 transition-colors font-medium"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : isMiniApp ? (
              <span className="text-xs text-slate-400 animate-pulse">Connecting…</span>
            ) : (
              <button
                onClick={connect}
                disabled={wallet.isConnecting}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {wallet.isConnecting ? "…" : "Connect"}
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
