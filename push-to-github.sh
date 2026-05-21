#!/usr/bin/env bash
# Run this from your terminal (not the sandbox) inside the chessbuddy/ folder:
#   chmod +x push-to-github.sh && ./push-to-github.sh
set -e

echo "⟳  Cleaning any stale git lock files..."
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

echo "⟳  Configuring git identity..."
git config user.email "gabrieltemtsen@gmail.com"
git config user.name "Gabriel Temtsen"

echo "⟳  Renaming branch to main..."
git branch -m main 2>/dev/null || true

echo "⟳  Committing..."
git add -A
git commit -m "feat: initial ChessBuddy release

- Full Web3 chess platform built on Circles Protocol (Gnosis Chain)
- Play vs Human (matchmaking queue) and Play vs AI (Easy/Medium/Hard)
- 1 CRC stake per paid match; winner receives 90% of pool
- Circles SDK integration: browser EIP-1193 runner + server private-key runner
- Chess engine: chess.js validation, minimax AI with alpha-beta pruning + PSTs
- API routes: match lifecycle, move validation, payout, matchmaking, leaderboard
- JSON-file persistence (.data/) for matches, queue, leaderboard
- Next.js 15 App Router, TypeScript, Tailwind CSS, framer-motion, next-themes
- Light/dark mode, chess.com-inspired layout, mobile-friendly
- Hydration fix: next-themes SSR mount guard in Header" || echo "Nothing new to commit."

echo "⟳  Adding remote and pushing..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/gabrieltemtsen/chessbuddy.git
git push -u origin main

echo ""
echo "✔  Pushed to https://github.com/gabrieltemtsen/chessbuddy"
