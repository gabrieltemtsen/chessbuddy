import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Add player to queue (upsert — one entry per address) ───────────────────
export const enqueue = mutation({
  args: { address: v.string(), matchId: v.string() },
  handler: async (ctx, { address, matchId }) => {
    // Remove any existing entry first (player can only queue once)
    const existing = await ctx.db
      .query("queue")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert("queue", { address, matchId, joinedAt: Date.now() });
  },
});

// ── Remove player from queue ────────────────────────────────────────────────
export const dequeue = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const row = await ctx.db
      .query("queue")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

// ── Get the first queued player (excluding the given address) ───────────────
export const getHead = query({
  args: { excludeAddress: v.string() },
  handler: async (ctx, { excludeAddress }) => {
    const rows = await ctx.db.query("queue").order("asc").collect();
    const entry = rows.find((r) => r.address !== excludeAddress);
    return entry ?? null;
  },
});

// ── Get queue entry for a specific address ──────────────────────────────────
export const getEntry = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    return await ctx.db
      .query("queue")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
  },
});
