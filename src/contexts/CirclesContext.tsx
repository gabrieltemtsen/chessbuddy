"use client";

/**
 * CirclesContext
 *
 * Provides wallet connection state and CRC helpers to the entire app.
 * Handles wallet events (account/chain change) and updates UI state accordingly.
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
  getCRCBalanceFormatted,
  getCRCBalance,
  transferCRC,
  getCirclesProfile,
} from "@/lib/circles/sdk";
import type { WalletState, CirclesProfile } from "@/types";
import { STAKE_AMOUNT_WEI } from "@/lib/constants";

interface CirclesContextValue {
  wallet: WalletState;
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

  const connect = useCallback(async () => {
    setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const address = await initSdk();

      // Fetch balance + profile in parallel
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
    } catch (err) {
      setWallet((prev) => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed.",
      }));
    }
  }, []);

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
          `Insufficient CRC balance. You need at least 1 CRC to enter a paid match.`
        );
      }
      const txHash = await transferCRC(wallet.address, adminWallet, STAKE_AMOUNT_WEI);
      // Refresh balance after staking
      await refreshBalance();
      return txHash;
    },
    [wallet.address, wallet.crcBalanceRaw, refreshBalance]
  );

  // Poll balance every 30s while connected
  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) return;

    balanceInterval.current = setInterval(refreshBalance, 30_000);
    return () => {
      if (balanceInterval.current) clearInterval(balanceInterval.current);
    };
  }, [wallet.isConnected, wallet.address, refreshBalance]);

  // Listen for wallet account/chain changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        disconnect();
      } else if (accs[0] !== wallet.address) {
        disconnect();
      }
    };

    const handleChainChanged = () => {
      disconnect();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [wallet.address, disconnect]);

  const hasEnough = wallet.crcBalanceRaw >= STAKE_AMOUNT_WEI;

  return (
    <CirclesContext.Provider
      value={{ wallet, connect, disconnect, refreshBalance, stakeForMatch, hasEnough }}
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
