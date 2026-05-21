import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatCRC(wei: bigint | string | number): string {
  const num = typeof wei === "bigint" ? Number(wei) / 1e18 : Number(wei);
  return num.toFixed(4);
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function resultLabel(result: string | null): string {
  const labels: Record<string, string> = {
    white_wins: "White wins",
    black_wins: "Black wins",
    draw: "Draw",
    stalemate: "Stalemate",
    timeout_white: "White lost on time",
    timeout_black: "Black lost on time",
    resign_white: "White resigned",
    resign_black: "Black resigned",
  };
  return result ? (labels[result] ?? result) : "In progress";
}

export function getWinnerColor(result: string | null): "white" | "black" | "draw" | null {
  if (!result) return null;
  if (["white_wins", "resign_black", "timeout_black"].includes(result)) return "white";
  if (["black_wins", "resign_white", "timeout_white"].includes(result)) return "black";
  if (["draw", "stalemate"].includes(result)) return "draw";
  return null;
}
