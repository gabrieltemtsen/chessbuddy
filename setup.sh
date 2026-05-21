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

# 2. Clean install (remove corrupted node_modules if present)
if [ -d "node_modules" ]; then
  echo "⟳  Removing existing node_modules (this may take a moment)…"
  rm -rf node_modules
fi

echo "⟳  Installing dependencies…"
npm install --legacy-peer-deps

# 3. Copy .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo ""
  echo "✔  Created .env.local from .env.example"
  echo ""
  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│  ACTION REQUIRED — edit .env.local before starting the app:    │"
  echo "│                                                                 │"
  echo "│  NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=0x...  (your Gnosis wallet)  │"
  echo "│  ADMIN_WALLET_PRIVATE_KEY=0x...          (server-side only)    │"
  echo "│                                                                 │"
  echo "│  Set NEXT_PUBLIC_STAKING_ENABLED=false to skip staking         │"
  echo "│  during development / testing.                                  │"
  echo "└─────────────────────────────────────────────────────────────────┘"
else
  echo "✔  .env.local already exists — skipping"
fi

# 4. Create data directory for JSON persistence
mkdir -p .data
echo "✔  .data/ directory ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete! Start the dev server with:"
echo ""
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
