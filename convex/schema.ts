import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Matches ─────────────────────────────────────────────────────────────────
  matches: defineTable({
    matchId: v.string(),          // UUID — used as the public ID in URLs
    mode: v.union(v.literal("ai"), v.literal("human")),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))
    ),
    status: v.union(
      v.literal("waiting"),
      v.literal("active"),
      v.literal("completed")
    ),
    // Stored as a JSON string to avoid deep-nesting complexity in Convex schema
    playersJson: v.string(),
    fen: v.string(),
    pgn: v.string(),
    movesJson: v.string(),        // JSON array of move objects
    result: v.optional(v.string()),
    drawStatus: v.string(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    payoutComplete: v.boolean(),
    payoutTxHash: v.optional(v.string()),
    poolCRC: v.number(),
  })
    .index("by_matchId", ["matchId"])
    .index("by_status", ["status"]),

  // ── Matchmaking queue ────────────────────────────────────────────────────────
  queue: defineTable({
    address: v.string(),
    matchId: v.string(),
    joinedAt: v.number(),
  }).index("by_address", ["address"]),

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  leaderboard: defineTable({
    address: v.string(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    totalGames: v.number(),
    points: v.number(),
    crcEarned: v.number(),
  }).index("by_address", ["address"]),
});
