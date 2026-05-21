/**
 * Circles Browser Runner
 *
 * Creates a viem-based ContractRunner that satisfies the @aboutcircles/sdk-types
 * ContractRunner interface. Uses window.ethereum (MetaMask / Rabby / any EIP-1193
 * provider) for signing and the Circles RPC for reads.
 *
 * ASSUMPTION: Users connect via a standard EIP-1193 browser wallet on Gnosis Chain.
 * Safe-based flows are not implemented in this MVP but can be swapped in via
 * SafeBrowserRunner from @aboutcircles/sdk-runner without changing any other code.
 */

import { createPublicClient, createWalletClient, custom, http } from "viem";
import { gnosis } from "viem/chains";
import type { ContractRunner, Address, TransactionRequest } from "@aboutcircles/sdk-types";
import { CIRCLES_RPC_URL, GNOSIS_CHAIN_ID } from "@/lib/constants";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export const createBrowserRunner = (): ContractRunner => {
  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(CIRCLES_RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: gnosis,
    transport: custom(
      typeof window !== "undefined" ? window.ethereum! : ({} as never)
    ),
  });

  const runner: ContractRunner = {
    address: undefined,
    // publicClient is required by the ContractRunner interface
    publicClient,

    async init() {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No browser wallet detected. Please install MetaMask or Rabby.");
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned. Did you unlock your wallet?");
      }

      runner.address = accounts[0] as Address;

      // Enforce Gnosis Chain
      const chainIdHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const chainId = parseInt(chainIdHex, 16);

      if (chainId !== GNOSIS_CHAIN_ID) {
        // Try to switch automatically
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${GNOSIS_CHAIN_ID.toString(16)}` }],
          });
        } catch {
          throw new Error(
            `Wrong network. Please switch your wallet to Gnosis Chain (Chain ID ${GNOSIS_CHAIN_ID}).`
          );
        }
      }
    },

    estimateGas: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.estimateGas({ account: runner.address!, ...(tx as any) }),

    call: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.call({ account: (tx as any).from || runner.address!, ...(tx as any) })
        .then((r: { data?: string }) => r?.data ?? "0x"),

    resolveName: (name: string) =>
      publicClient.getEnsAddress({ name }).then((a: string | null) => a ?? null),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async sendTransaction(txs: TransactionRequest[]): Promise<any> {
      if (!runner.address) throw new Error("Runner not initialised. Call init() first.");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receipt: any;

      for (const tx of txs) {
        const hash = await walletClient.sendTransaction({
          account: runner.address,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(tx as any),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receipt = (await publicClient.waitForTransactionReceipt({ hash })) as any;
      }

      if (!receipt) throw new Error("No transactions were submitted.");
      return receipt;
    },
  };

  return runner;
};
