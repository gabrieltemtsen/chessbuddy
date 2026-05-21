"use client";

/**
 * CirclesContext
 *
 * Supports two connection modes:
 *
 * 1. **Embedded miniapp** — running inside the Circles host iframe.
 *    `isMiniappMode()` returns true; the host sends the user's Gnosis/Circles
 *    address via postMessage. No user action required — wallet auto-connects.
 *
 * 2. **Standalone browser** — regular web app.
 *    User clicks "Connect Wallet" → MetaMask / Rabby EIP-1193 flow.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  initSdk,
  initSdkWithRunner,
  getCRCBalanceFormatted,
  getCRCBalance,
  transferCRC,
  getCirclesProfile,
} from "@/lib/circles/sdk";
import type { WalletState, CirclesProfile } from "@/types";
import { STAKE_AMOUNT_WEI } from "@/lib/constants";

interface CirclesContextValue {
  wallet: WalletState;
  isMiniApp: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  stakeForMatch: (adminWallet: string) => Promise<string>; // returns tx hash
  hasEnough: boolean;
}

const defaultWallet: WalletState = {
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  crcBalance: "0.0000",
  crcBalanceRaw: 0n,
  error: null,
  profile: null,
};

const CirclesContext = createContext<CirclesContextValue | null>(null);

export function CirclesProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(defaultWallet);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const balanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const [formatted, raw] = await Promise.all([
        getCRCBalanceFormatted(wallet.address),
        getCRCBalance(wallet.address),
      ]);
      setWallet((prev) => ({
        ...prev,
        crcBalance: formatted,
        crcBalanceRaw: raw,
      }));
    } catch {
      // silently ignore balance refresh errors
    }
  }, [wallet.address]);

  /** Shared post-connect logic: fetch balance + profile, update state */
  const finaliseConnect = useCallback(async (address: string) => {
    const [formatted, raw, profile] = await Promise.all([
      getCRCBalanceFormatted(address),
      getCRCBalance(address),
      getCirclesProfile(address).catch(() => null),
    ]);
    setWallet({
      address,
      isConnected: true,
      isConnecting: false,
      chainId: 100,
      crcBalance: formatted,
      crcBalanceRaw: raw,
      error: null,
      profile: profile as CirclesProfile | null,
    });
  }, []);

  /** Browser / MetaMask connect */
  const connect = useCallback(async () => {
    if (isMiniApp) return; // wallet comes from the host — no action needed
    setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const address = await initSdk();
      await finaliseConnect(address);
    } catch (err) {
      setWallet((prev) => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed.",
      }));
    }
  }, [isMiniApp, finaliseConnect]);

  const disconnect = useCallback(() => {
    if (balanceInterval.current) clearInterval(balanceInterval.current);
    setWallet(defaultWallet);
  }, []);

  /** Stake 1 CRC by transferring to the admin/escrow wallet */
  const stakeForMatch = useCallback(
    async (adminWallet: string): Promise<string> => {
      if (!wallet.address) throw new Error("Wallet not connected.");
      if (wallet.crcBalanceRaw < STAKE_AMOUNT_WEI) {
        throw new Error(
          "Insufficient CRC balance. You need at least 1 CRC to enter a paid match."
        );
      }
      const txHash = await transferCRC(wallet.address, adminWallet, STAKE_AMOUNT_WEI);
      await refreshBalance();
      return txHash;
    },
    [wallet.address, wallet.crcBalanceRaw, refreshBalance]
  );

  // ── Miniapp auto-connect ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dynamically check for miniapp mode to avoid SSR issues
    import("@aboutcircles/miniapp-sdk").then(
      ({ isMiniappMode, onWalletChange }) => {
        if (!isMiniappMode()) return;

        setIsMiniApp(true);

        const unsub = onWalletChange(async (address) => {
          if (address) {
            // Host provided a wallet — bootstrap SDK with the miniapp runner
            try {
              const { createMiniappRunner } = await import(
                "@/lib/circles/miniappRunner"
              );
              const runner = createMiniappRunner(address);
              initSdkWithRunner(runner);
              await finaliseConnect(address);
            } catch (err) {
              setWallet((prev) => ({
                ...prev,
                error:
                  err instanceof Error ? err.message : "Miniapp init failed.",
              }));
            }
          } else {
            // Host wallet disconnected
            disconnect();
          }
        });

        return unsub;
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Balance polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) return;
    balanceInterval.current = setInterval(refreshBalance, 30_000);
    return () => {
      if (balanceInterval.current) clearInterval(balanceInterval.current);
    };
  }, [wallet.isConnected, wallet.address, refreshBalance]);

  // ── Browser wallet event listeners (standalone mode only) ─────────────────
  useEffect(() => {
    if (isMiniApp) return;
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0 || accs[0] !== wallet.address) {
        disconnect();
      }
    };
    const handleChainChanged = () => disconnect();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [isMiniApp, wallet.address, disconnect]);

  const hasEnough = wallet.crcBalanceRaw >= STAKE_AMOUNT_WEI;

  return (
    <CirclesContext.Provider
      value={{
        wallet,
        isMiniApp,
        connect,
        disconnect,
        refreshBalance,
        stakeForMatch,
        hasEnough,
      }}
    >
      {children}
    </CirclesContext.Provider>
  );
}

export function useCircles() {
  const ctx = useContext(CirclesContext);
  if (!ctx) throw new Error("useCircles must be used within CirclesProvider");
  return ctx;
}
