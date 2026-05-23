/**
 * Database layer — backed by Convex
 *
 * All API routes import from here exactly as before.
 * Internally this calls the Convex HTTP client, which talks to the
 * Convex cloud deployment over HTTPS (no websocket needed server-side).
 *
 * Set CONVEX_URL in .env.local (you get this from `npx convex dev`).
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Match, LeaderboardEntry } from "@/types";

function getClient(): ConvexHttpClient {
  // CONVEX_URL is server-side only; NEXT_PUBLIC_CONVEX_URL is written by `npx convex dev`.
  // Accept either — both are available in Next.js server-side context.
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url || url.includes("your-deployment")) {
    throw new Error(
      "CONVEX_URL is not set. Run `npx convex dev` and add the printed URL to .env.local."
    );
  }
  return new ConvexHttpClient(url);
}

// ── Matches ────────────────────────────────────────────────────────────────

export async function getMatch(id: string): Promise<Match | null> {
  return (await getClient().query(api.matches.get, { matchId: id })) as Match | null;
}

export async function saveMatch(match: Match): Promise<void> {
  await getClient().mutation(api.matches.save, { match });
}

export async function getAllMatches(): Promise<Match[]> {
  return (await getClient().query(api.matches.getAll, {})) as Match[];
}

export async function deleteMatch(id: string): Promise<void> {
  await getClient().mutation(api.matches.remove, { matchId: id });
}

// ── Matchmaking queue ──────────────────────────────────────────────────────

export async function enqueuePlayer(address: string, matchId: string): Promise<void> {
  await getClient().mutation(api.queue.enqueue, { address, matchId });
}

export async function dequeuePlayer(address: string): Promise<void> {
  await getClient().mutation(api.queue.dequeue, { address });
}

export async function getQueueHead(
  excludeAddress: string
): Promise<{ address: string; matchId: string; joinedAt: number } | null> {
  return getClient().query(api.queue.getHead, { excludeAddress });
}

export async function getQueueEntry(
  address: string
): Promise<{ address: string; matchId: string; joinedAt: number } | null> {
  return getClient().query(api.queue.getEntry, { address });
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return (await getClient().query(api.leaderboard.getAll, {})) as LeaderboardEntry[];
}

export async function recordMatchResult(
  address: string,
  result: "win" | "loss" | "draw",
  crcEarned: number
): Promise<void> {
  await getClient().mutation(api.leaderboard.record, { address, result, crcEarned });
}
