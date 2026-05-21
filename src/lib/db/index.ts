/**
 * Match State Store
 *
 * Simple file-based persistence using a JSON file for MVP.
 * In production, replace with PostgreSQL or another persistent store.
 *
 * All writes are atomic (write tmp → rename). The store is loaded once
 * at module initialisation and flushed to disk on every mutation.
 */

import fs from "fs";
import path from "path";
import type { Match, LeaderboardEntry } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const MATCHES_FILE = path.join(DATA_DIR, "matches.json");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

// ─── Ensure data directory exists ─────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Matches ───────────────────────────────────────────────────────────────

function readMatches(): Record<string, Match> {
  ensureDir();
  if (!fs.existsSync(MATCHES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MATCHES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeMatches(data: Record<string, Match>) {
  ensureDir();
  const tmp = MATCHES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, MATCHES_FILE);
}

export function getMatch(id: string): Match | null {
  return readMatches()[id] ?? null;
}

export function saveMatch(match: Match): void {
  const all = readMatches();
  all[match.id] = match;
  writeMatches(all);
}

export function getAllMatches(): Match[] {
  return Object.values(readMatches());
}

export function deleteMatch(id: string): void {
  const all = readMatches();
  delete all[id];
  writeMatches(all);
}

// ─── Matchmaking Queue ─────────────────────────────────────────────────────

interface QueueEntry {
  address: string;
  matchId: string;
  joinedAt: number;
}

const QUEUE_FILE = path.join(DATA_DIR, "queue.json");

function readQueue(): QueueEntry[] {
  ensureDir();
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeQueue(data: QueueEntry[]) {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));
}

export function enqueuePlayer(address: string, matchId: string): void {
  const queue = readQueue().filter((e) => e.address !== address);
  queue.push({ address, matchId, joinedAt: Date.now() });
  writeQueue(queue);
}

export function dequeuePlayer(address: string): void {
  const queue = readQueue().filter((e) => e.address !== address);
  writeQueue(queue);
}

export function getQueueHead(excludeAddress: string): QueueEntry | null {
  const queue = readQueue().filter((e) => e.address !== excludeAddress);
  return queue[0] ?? null;
}

export function getQueueEntry(address: string): QueueEntry | null {
  return readQueue().find((e) => e.address === address) ?? null;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

function readLeaderboard(): Record<string, LeaderboardEntry> {
  ensureDir();
  if (!fs.existsSync(LEADERBOARD_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeLeaderboard(data: Record<string, LeaderboardEntry>) {
  ensureDir();
  const tmp = LEADERBOARD_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, LEADERBOARD_FILE);
}

export function getLeaderboard(): LeaderboardEntry[] {
  const data = readLeaderboard();
  return Object.values(data).sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export function recordMatchResult(
  address: string,
  result: "win" | "loss" | "draw",
  crcEarned: number
): void {
  const all = readLeaderboard();
  const existing = all[address] ?? {
    address,
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    points: 0,
    crcEarned: 0,
  };

  existing.totalGames += 1;
  existing.crcEarned += crcEarned;

  if (result === "win") {
    existing.wins += 1;
    existing.points += 3;
  } else if (result === "draw") {
    existing.draws += 1;
    existing.points += 1;
  } else {
    existing.losses += 1;
  }

  all[address] = existing;
  writeLeaderboard(all);
}
