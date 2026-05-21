/**
 * Lucide-react shim — provides module declaration so TypeScript
 * doesn't complain about missing CJS type declarations.
 * Remove once lucide-react is fully installed.
 */
declare module "lucide-react" {
  import type { FC, SVGProps } from "react";
  export type LucideProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string };
  export type LucideIcon = FC<LucideProps>;
  // Named icon exports used in ChessBuddy
  export const Swords: LucideIcon;
  export const Trophy: LucideIcon;
  export const Zap: LucideIcon;
  export const Shield: LucideIcon;
  export const Users: LucideIcon;
  export const Bot: LucideIcon;
  export const Sun: LucideIcon;
  export const Moon: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Loader2: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const Clock: LucideIcon;
  export const Flag: LucideIcon;
  export const Handshake: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const User: LucideIcon;
  export const X: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Medal: LucideIcon;
}

/**
 * Viem type shim — provides the minimum types needed for the Circles runner
 * files when viem's own _types/index.d.ts is missing (e.g. partial install).
 * This file is NOT needed in production — a complete `npm install` generates
 * the real viem types at node_modules/viem/_types/index.d.ts.
 *
 * Remove this file once viem is fully installed.
 */

declare module "viem" {
  export type Address = `0x${string}`;
  export type Hash = `0x${string}`;
  export type Hex = `0x${string}`;

  export interface TransactionReceipt {
    transactionHash: Hash;
    blockNumber: bigint;
    blockHash: Hash;
    status: "success" | "reverted";
  }

  export interface PublicClient {
    estimateGas: (args: Record<string, unknown>) => Promise<bigint>;
    call: (args: Record<string, unknown>) => Promise<{ data?: Hex }>;
    getEnsAddress: (args: { name: string }) => Promise<Address | null>;
    waitForTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>;
  }

  export interface WalletClient {
    sendTransaction: (args: Record<string, unknown>) => Promise<Hash>;
    getChainId: () => Promise<number>;
  }

  export function createPublicClient(args: Record<string, unknown>): PublicClient;
  export function createWalletClient(args: Record<string, unknown>): WalletClient;
  export function http(url?: string): unknown;
  export function custom(provider: unknown): unknown;
  export function privateKeyToAccount(pk: `0x${string}`): { address: Address };
}

declare module "viem/chains" {
  export const gnosis: {
    id: 100;
    name: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: Record<string, { http: string[] }>;
  };
}
