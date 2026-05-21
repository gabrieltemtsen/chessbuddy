// ─── CRC Staking Constants ──────────────────────────────────────────────────
// 1 CRC in 18-decimal representation (ERC-1155 / wrapped ERC-20)
export const STAKE_AMOUNT_CRC = 1;
export const STAKE_AMOUNT_WEI = BigInt("1000000000000000000"); // 1e18

// Platform split: winner gets 90%, admin gets 10%
export const WINNER_SHARE = 0.9;
export const ADMIN_SHARE = 0.1;

// For PvP: pool = 2 CRC → winner gets 1.8, admin gets 0.2
// For AI (Medium/Hard): pool = 1 CRC → win: player gets 0.9 back; loss/draw: see README
// On a draw (PvP): each player gets 0.9 CRC back, admin keeps 0.2 CRC total
// On a draw (AI): player gets 0.9 CRC back, admin keeps 0.1 CRC
export const WINNER_AMOUNT_PVP_WEI = BigInt("1800000000000000000"); // 1.8 CRC
export const ADMIN_AMOUNT_PVP_WEI = BigInt("200000000000000000");   // 0.2 CRC
export const WINNER_AMOUNT_AI_WEI = BigInt("900000000000000000");   // 0.9 CRC
export const ADMIN_AMOUNT_AI_WEI = BigInt("100000000000000000");    // 0.1 CRC

// ─── Chain Config ────────────────────────────────────────────────────────────
export const GNOSIS_CHAIN_ID = 100;
export const CIRCLES_RPC_URL = "https://rpc.aboutcircles.com";

// ─── Timer Defaults ──────────────────────────────────────────────────────────
export const TIMER_DURATION_MS = 10 * 60 * 1000; // 10 minutes per player

// ─── AI Delays ───────────────────────────────────────────────────────────────
export const AI_MOVE_DELAY_MS: Record<string, number> = {
  easy: 400,
  medium: 800,
  hard: 1200,
};

// ─── AI Depth (minimax) ──────────────────────────────────────────────────────
export const AI_DEPTH: Record<string, number> = {
  easy: 0,    // random moves
  medium: 2,  // 2-ply minimax
  hard: 4,    // 4-ply minimax with alpha-beta
};

// ─── Matchmaking ─────────────────────────────────────────────────────────────
export const MATCHMAKING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes before suggesting AI
export const MATCH_POLL_INTERVAL_MS = 2000;           // poll every 2s

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;

// ─── Admin wallet (set via env) ───────────────────────────────────────────────
// NEXT_PUBLIC_ADMIN_WALLET is read-only (shown in UI for transparency)
// ADMIN_WALLET_PRIVATE_KEY is server-side only (never exposed to browser)
export const ADMIN_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ?? "0x0000000000000000000000000000000000000000";

// ─── Feature flags ────────────────────────────────────────────────────────────
export const STAKING_ENABLED = process.env.NEXT_PUBLIC_STAKING_ENABLED !== "false";
