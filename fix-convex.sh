#!/usr/bin/env bash
# ─── ChessBuddy — Fix Convex bundling conflict ───────────────────────────────
# Run this from the chessbuddy/ directory:
#   chmod +x fix-convex.sh && ./fix-convex.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ChessBuddy — Fix Convex Bundling           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 1. Remove stale compiled .js artefacts from convex/
# These were accidentally created and conflict with Convex's own bundler.
echo "⟳  Removing stale compiled artefacts from convex/..."

FILES=(
  "convex/matches.js"
  "convex/matches.js.map"
  "convex/queue.js"
  "convex/queue.js.map"
  "convex/leaderboard.js"
  "convex/leaderboard.js.map"
  "convex/schema.js"
  "convex/schema.js.map"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    echo "  ✔  Removed $f"
  fi
done

echo ""
echo "✅  Done! convex/ directory now contains only .ts sources."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT STEPS:"
echo ""
echo "  1. In one terminal, start Convex:"
echo "       npx convex dev"
echo "     It should now bundle cleanly and deploy your functions."
echo ""
echo "  2. In another terminal, start Next.js:"
echo "       npm run dev"
echo ""
echo "  3. Open http://localhost:3000 — everything should work!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
