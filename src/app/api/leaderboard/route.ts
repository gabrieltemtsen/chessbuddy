import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db";

export async function GET() {
  const leaderboard = getLeaderboard();
  return NextResponse.json({ leaderboard: leaderboard.slice(0, 50) });
}
