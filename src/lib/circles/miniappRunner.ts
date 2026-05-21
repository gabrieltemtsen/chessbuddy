/**
 * Circles Miniapp Runner
 *
 * Used when ChessBuddy is embedded inside the Circles miniapp host (iframe).
 * The host provides the user's Gnosis/Circles Safe address via postMessage and
 * handles transaction signing — no MetaMask or private key needed.
 *
 * Flow:
 *  1. Host sends wallet_connected → onWalletChange fires with the address
 *  2. CirclesContext creates this runner with that address
 *  3. avatar.transfer.advanced() builds tx calldata and calls runner.sendTransaction()
 *  4. We forward the raw tx to the host via sendTransactions() (postMessage)
 *  5. Host signs & broadcasts; we await the receipt via publicClient
 */

import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";
import { sendTransactions as miniappSendTxs } from "@aboutcircles/miniapp-sdk";
import type { ContractRunner, Address, TransactionRequest } from "@aboutcircles/sdk-types";
import { CIRCLES_RPC_URL } from "@/lib/constants";

export function createMiniappRunner(address: string): ContractRunner {
  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(CIRCLES_RPC_URL),
  });

  const runner: ContractRunner = {
    address: address as Address,
    // publicClient required by ContractRunner interface
    publicClient,

    async init() {
      // No-op: address is already known from the host's wallet_connected message
    },

    estimateGas: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.estimateGas({ account: runner.address!, ...(tx as any) }),

    call: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.call({ account: runner.address!, ...(tx as any) })
        .then((r: { data?: string }) => r?.data ?? "0x"),

    resolveName: (name: string) =>
      publicClient.getEnsAddress({ name }).then((a: string | null) => a ?? null),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async sendTransaction(txs: TransactionRequest[]): Promise<any> {
      if (!runner.address) throw new Error("Miniapp runner has no address set.");

      // Map viem TransactionRequest → miniapp-sdk Transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = txs.map((tx: any) => ({
        to: tx.to as string,
        data: (tx.data as string | undefined) ?? undefined,
        // value must be a hex string; BigInt(0) → "0x0"
        value:
          tx.value !== undefined && tx.value !== null
            ? "0x" + BigInt(tx.value).toString(16)
            : undefined,
      }));

      // The host signs and broadcasts; returns an array of tx hashes
      const hashes = await miniappSendTxs(mapped);
      const lastHash = hashes[hashes.length - 1] as `0x${string}`;

      // Poll the public RPC for the receipt (host has already confirmed it's mined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receipt = (await publicClient.waitForTransactionReceipt({
        hash: lastHash,
      })) as any;

      return receipt;
    },
  };

  return runner;
}
