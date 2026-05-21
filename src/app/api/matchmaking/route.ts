/**
 * GET  /api/matchmaking?address=0x... — poll for match status
 * POST /api/matchmaking               — cancel / leave queue
 */

import { NextRequest, NextResponse } from "next/server";
import { getQueueEntry, getMatch, dequeuePlayer } from "@/lib/db";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const entry = getQueueEntry(address);
  if (!entry) return NextResponse.json({ status: "not_in_queue" });

  const match = getMatch(entry.matchId);
  if (!match) return NextResponse.json({ status: "not_in_queue" });

  if (match.status === "active") {
    return NextResponse.json({ status: "matched", match });
  }

  return NextResponse.json({ status: "waiting", match, joinedAt: entry.joinedAt });
}

export async function DELETE(req: NextRequest) {
  const { address, matchId } = await req.json();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  dequeuePlayer(address);

  if (matchId) {
    const { getMatch, saveMatch } = await import("@/lib/db");
    const match = getMatch(matchId);
    if (match && match.status === "waiting") {
      match.status = "cancelled";
      saveMatch(match);
    }
  }

  return NextResponse.json({ ok: true });
}
