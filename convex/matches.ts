import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Get a single match by its public matchId ────────────────────────────────
export const get = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const row = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
    if (!row) return null;
    return deserialize(row);
  },
});

// ── Save (upsert) a match ───────────────────────────────────────────────────
export const save = mutation({
  args: { match: v.any() },
  handler: async (ctx, { match }) => {
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", match.id))
      .unique();

    const row = serialize(match);

    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("matches", row);
    }
  },
});

// ── Get all matches (admin / leaderboard use) ───────────────────────────────
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("matches").order("desc").take(100);
    return rows.map(deserialize);
  },
});

// ── Delete a match ──────────────────────────────────────────────────────────
export const remove = mutation({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const row = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

// ── Serialise / deserialise helpers ────────────────────────────────────────
// We store complex nested objects (players, moves) as JSON strings so Convex's
// schema validator doesn't need to know every nested field shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(match: any) {
  return {
    matchId: match.id,
    mode: match.mode,
    difficulty: match.difficulty,
    status: match.status,
    playersJson: JSON.stringify(match.players ?? {}),
    fen: match.fen ?? "",
    pgn: match.pgn ?? "",
    movesJson: JSON.stringify(match.moves ?? []),
    result: match.result ?? undefined,
    drawStatus: match.drawStatus ?? "none",
    createdAt: match.createdAt ?? Date.now(),
    startedAt: match.startedAt,
    completedAt: match.completedAt,
    payoutComplete: match.payoutComplete ?? false,
    payoutTxHash: match.payoutTxHash,
    poolCRC: match.poolCRC ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserialize(row: any) {
  return {
    id: row.matchId,
    mode: row.mode,
    difficulty: row.difficulty,
    status: row.status,
    players: JSON.parse(row.playersJson ?? "{}"),
    fen: row.fen,
    pgn: row.pgn,
    moves: JSON.parse(row.movesJson ?? "[]"),
    result: row.result ?? null,
    drawStatus: row.drawStatus,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    payoutComplete: row.payoutComplete,
    payoutTxHash: row.payoutTxHash,
    poolCRC: row.poolCRC,
  };
}
