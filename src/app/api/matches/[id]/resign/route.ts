import { NextRequest, NextResponse } from "next/server";
import { getMatch, saveMatch } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { playerAddress } = await req.json();

  const match = getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "active") return NextResponse.json({ error: "Match is not active." }, { status: 400 });

  const isWhite = match.players.white?.address === playerAddress;
  const isBlack = match.players.black?.address === playerAddress;
  if (!isWhite && !isBlack) return NextResponse.json({ error: "Not a participant." }, { status: 403 });

  match.result = isWhite ? "resign_white" : "resign_black";
  match.status = "completed";
  match.endedAt = Date.now();
  saveMatch(match);

  return NextResponse.json({ match });
}
