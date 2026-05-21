// ─── Match & Game Types ────────────────────────────────────────────────────

export type GameMode = "human" | "ai";
export type AIDifficulty = "easy" | "medium" | "hard";
export type MatchStatus =
  | "waiting"       // waiting for second player
  | "staking"       // players are staking CRC
  | "active"        // game in progress
  | "completed"     // game finished
  | "cancelled";    // cancelled before start

export type GameResult =
  | "white_wins"
  | "black_wins"
  | "draw"
  | "stalemate"
  | "timeout_white"
  | "timeout_black"
  | "resign_white"
  | "resign_black"
  | null;

export type DrawStatus = "none" | "offered_by_white" | "offered_by_black" | "accepted";

export interface Player {
  address: string;        // Ethereum address
  color: "white" | "black";
  hasStaked: boolean;
  stakeTxHash?: string;
  timeRemainingMs: number;
  isAI?: boolean;
}

export interface Match {
  id: string;
  mode: GameMode;
  difficulty?: AIDifficulty;
  status: MatchStatus;
  players: {
    white?: Player;
    black?: Player;
  };
  fen: string;            // current board position (FEN string)
  pgn: string;            // full game notation
  moves: string[];        // list of moves in algebraic notation
  result: GameResult;
  drawStatus: DrawStatus;
  createdAt: number;      // unix ms
  startedAt?: number;
  endedAt?: number;
  payoutTxHash?: string;
  payoutComplete: boolean;
  poolCRC: number;        // total CRC staked (in CRC units, not wei)
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  address: string;
  displayName?: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  points: number;       // 3 for win, 1 for draw, 0 for loss
  crcEarned: number;   // lifetime CRC won
}

// ─── Circles / Wallet ──────────────────────────────────────────────────────

export interface CirclesProfile {
  name?: string;
  description?: string;
  previewImageUrl?: string;
  imageUrl?: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  crcBalance: string;      // human-readable CRC balance
  crcBalanceRaw: bigint;   // raw balance in wei-equivalent
  error: string | null;
  profile: CirclesProfile | null;
}

// ─── API request / response shapes ────────────────────────────────────────

export interface CreateMatchRequest {
  mode: GameMode;
  difficulty?: AIDifficulty;
  playerAddress: string;
  stakeTxHash?: string;   // provided after the staking tx is submitted
}

export interface CreateMatchResponse {
  match: Match;
}

export interface JoinMatchRequest {
  matchId: string;
  playerAddress: string;
  stakeTxHash?: string;
}

export interface SubmitMoveRequest {
  from: string;
  to: string;
  promotion?: string;
  playerAddress: string;
}

export interface SubmitMoveResponse {
  match: Match;
  aiMove?: string;        // next AI move in LAN (e.g. "e7e5")
}

export interface PayoutRequest {
  matchId: string;
}

export interface PayoutResponse {
  txHash: string;
  winnerAddress: string;
  winnerAmount: string;
  adminAmount: string;
}

// ─── UI state ─────────────────────────────────────────────────────────────

export type SquareHighlight = {
  [square: string]: { background: string };
};

export type ModalType =
  | "stake_confirm"
  | "resign_confirm"
  | "draw_offer"
  | "draw_received"
  | "game_result"
  | "no_opponent"
  | null;
