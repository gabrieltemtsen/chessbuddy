import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Get leaderboard sorted by points desc ──────────────────────────────────
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("leaderboard").collect();
    return rows
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .slice(0, 50);
  },
});

// ── Record a match result for a player ─────────────────────────────────────
export const record = mutation({
  args: {
    address: v.string(),
    result: v.union(v.literal("win"), v.literal("loss"), v.literal("draw")),
    crcEarned: v.number(),
  },
  handler: async (ctx, { address, result, crcEarned }) => {
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalGames: existing.totalGames + 1,
        crcEarned: existing.crcEarned + crcEarned,
        wins: result === "win" ? existing.wins + 1 : existing.wins,
        losses: result === "loss" ? existing.losses + 1 : existing.losses,
        draws: result === "draw" ? existing.draws + 1 : existing.draws,
        points:
          existing.points +
          (result === "win" ? 3 : result === "draw" ? 1 : 0),
      });
    } else {
      await ctx.db.insert("leaderboard", {
        address,
        wins: result === "win" ? 1 : 0,
        losses: result === "loss" ? 1 : 0,
        draws: result === "draw" ? 1 : 0,
        totalGames: 1,
        points: result === "win" ? 3 : result === "draw" ? 1 : 0,
        crcEarned,
      });
    }
  },
});
