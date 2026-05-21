/**
 * POST /api/matches/[id]/draw
 *
 * action: "offer" | "accept" | "decline"
 *
 * Draw payout rule (simplest fair option):
 *   - PvP draw: each player gets 0.9 CRC back, admin keeps 0.2 CRC total
 *   - AI draw:  player gets 0.9 CRC back, admin keeps 0.1 CRC
 * (Documented in README as the chosen draw split)
 */

import { NextRequest, NextResponse } from "next/server";
import { getMatch, saveMatch } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { playerAddress, action } = await req.json();

  const match = getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "active") return NextResponse.json({ error: "Match is not active." }, { status: 400 });

  const isWhite = match.players.white?.address === playerAddress;
  const isBlack = match.players.black?.address === playerAddress;
  if (!isWhite && !isBlack) return NextResponse.json({ error: "Not a participant." }, { status: 403 });

  if (action === "offer") {
    match.drawStatus = isWhite ? "offered_by_white" : "offered_by_black";
    saveMatch(match);
    return NextResponse.json({ match });
  }

  if (action === "accept") {
    // Verify the other player offered
    const validOffer =
      (isBlack && match.drawStatus === "offered_by_white") ||
      (isWhite && match.drawStatus === "offered_by_black");

    if (!validOffer) {
      return NextResponse.json({ error: "No draw offer to accept." }, { status: 400 });
    }

    match.drawStatus = "accepted";
    match.result = "draw";
    match.status = "completed";
    match.endedAt = Date.now();
    saveMatch(match);
    return NextResponse.json({ match });
  }

  if (action === "decline") {
    match.drawStatus = "none";
    saveMatch(match);
    return NextResponse.json({ match });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
