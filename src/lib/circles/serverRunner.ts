/**
 * Server-side Circles runner using a private key.
 * Used only by API route handlers (payout logic).
 * The private key NEVER leaves the server.
 */

import { createPublicClient, createWalletClient, http, privateKeyToAccount } from "viem";
import { gnosis } from "viem/chains";
import type { ContractRunner, Address, TransactionRequest } from "@aboutcircles/sdk-types";
import { CIRCLES_RPC_URL } from "@/lib/constants";

export async function createPrivateKeyRunner(privateKey: `0x${string}`): Promise<ContractRunner> {
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(CIRCLES_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: gnosis,
    transport: http(CIRCLES_RPC_URL),
  });

  const runner: ContractRunner = {
    address: account.address as Address,
    // publicClient required by ContractRunner interface
    publicClient,

    async init() {
      // Private key runner is already initialised
    },

    estimateGas: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.estimateGas({ account: account.address, ...(tx as any) }),

    call: (tx: TransactionRequest) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.call({ account: account.address, ...(tx as any) })
        .then((r: { data?: string }) => r?.data ?? "0x"),

    resolveName: (name: string) =>
      publicClient.getEnsAddress({ name }).then((a: string | null) => a ?? null),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async sendTransaction(txs: TransactionRequest[]): Promise<any> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receipt: any;
      for (const tx of txs) {
        const hash = await walletClient.sendTransaction({
          account,
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
}
