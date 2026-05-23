#!/usr/bin/env bash
# ─── ChessBuddy — one-shot setup ─────────────────────────────────────────────
# Run this from the chessbuddy/ directory:
#   chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        ChessBuddy — Setup Script             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 1. Node version check
REQUIRED=18
CURRENT=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$CURRENT" -lt "$REQUIRED" ]; then
  echo "❌  Node $REQUIRED+ required (found v$CURRENT). Please upgrade."
  exit 1
fi
echo "✔  Node v$(node --version | tr -d v)"

# 2. Clean install
if [ -d "node_modules" ]; then
  echo "⟳  Removing existing node_modules…"
  rm -rf node_modules
fi

echo "⟳  Installing dependencies…"
npm install --legacy-peer-deps

# 3. Copy .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "✔  Created .env.local from .env.example"
fi

# 4. Convex setup
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP: Set up Convex (database)"
echo ""
echo "  1. Run:  npx convex dev"
echo "     This will ask you to log in at dashboard.convex.dev"
echo "     and create a 'chessbuddy' project."
echo ""
echo "  2. It prints two lines like:"
echo "       CONVEX_URL=https://happy-animal-123.convex.cloud"
echo "       NEXT_PUBLIC_CONVEX_URL=https://happy-animal-123.convex.cloud"
echo ""
echo "  3. Paste BOTH into .env.local"
echo ""
echo "  Keep 'npx convex dev' running in a separate terminal"
echo "  while you develop — it deploys your schema changes live."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  STEP: Fill in .env.local"
echo ""
echo "  NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=0x9aCa34983D694e07ce0369a74F63094C989FDf2c"
echo "  ADMIN_WALLET_PRIVATE_KEY=0xYOUR_SAFE_OWNER_KEY"
echo "  NEXT_PUBLIC_STAKING_ENABLED=false   ← set false while testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Once both steps are done, start the dev server:"
echo ""
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
