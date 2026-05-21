# ♟ ChessBuddy — Web3 Chess on Circles

ChessBuddy is a chess platform where players stake **CRC** (Circles social money) to enter matches. Winners take 90% of the pool; the platform retains 10%. Built on [Gnosis Chain](https://www.gnosis.io/) using the [Circles Protocol](https://aboutcircles.com).

---

## Table of Contents

1. [Features](#features)
2. [Setup](#setup)
3. [Environment Variables](#environment-variables)
4. [Circles Setup](#circles-setup)
5. [How Staking Works](#how-staking-works)
6. [How Payout Works](#how-payout-works)
7. [AI Opponent](#ai-opponent)
8. [Leaderboard](#leaderboard)
9. [Architecture](#architecture)
10. [Known Limitations](#known-limitations)

---

## Features

- **Play vs Human** — matchmaking queue, real-time polling
- **Play vs AI** — Easy (free), Medium & Hard (1 CRC stake each)
- **Circles / CRC wallet integration** — balance display, staking, payout
- **Full chess engine** — legal move validation, checkmate, stalemate, draw detection
- **Move history**, **captured pieces**, **player timers** (10 min each)
- **Resign** and **Offer Draw** with fair payout handling
- **Leaderboard** — wins, losses, draws, points, CRC earned
- **Light / Dark mode**
- **Mobile-friendly** responsive layout

---

## Setup

### Prerequisites

- Node.js ≥ 18
- A browser wallet (MetaMask or Rabby) configured for **Gnosis Chain (chainId 100)**
- A small amount of **xDAI** for gas
- A registered **Circles account** with some CRC

### Install & run

```bash
cd chessbuddy
npm install --legacy-peer-deps

cp .env.example .env.local
# fill in .env.local (see Environment Variables section)

npm run dev
# open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ADMIN_WALLET_ADDRESS` | Yes | Gnosis Chain address that holds staked CRC and sends payouts |
| `ADMIN_WALLET_PRIVATE_KEY` | Recommended | Private key for automatic payouts. If omitted, payouts are queued manually |
| `NEXT_PUBLIC_STAKING_ENABLED` | No | Set to `false` to play without staking (dev mode) |

---

## Circles Setup

ChessBuddy uses the official [`@aboutcircles/sdk`](https://docs.aboutcircles.com/circles-sdk/getting-started-with-the-sdk.md) on **Gnosis Chain mainnet**.

### What you need

1. A **Circles v2 account** (invite-based; you can self-register via the Circles app).
2. A **browser wallet** (MetaMask / Rabby) with your Circles address on Gnosis Chain.
3. At least **1 CRC** in your balance to enter paid matches (check demurrage — balances decay ~7%/year).

### Admin wallet requirements

The admin wallet must be:
- Registered as a Circles account (human or organisation avatar)
- Trusted by — or trust — the users it will send payouts to

> **Important:** CRC transfers use the Circles *trust path* (transitive flow). The admin wallet must have a valid trust path to the winner's address, otherwise the payout fails. For a production deployment, consider using a **Circles Group token** for direct transfers without trust constraints — see the [Circles docs](https://docs.aboutcircles.com) for group setup.

---

## How Staking Works

When a player starts a paid match, the app calls `avatar.transfer.advanced()` to send **1 CRC** from the player to the admin/escrow wallet **before** the match begins. This is an on-chain transaction the user signs in their browser wallet.

```
Player → 1 CRC → Admin wallet   (on match start)
```

For **PvP matches**, both players stake 1 CRC:
```
Player A → 1 CRC → Admin wallet
Player B → 1 CRC → Admin wallet
Pool = 2 CRC
```

For **AI matches (Medium/Hard)**, only the human player stakes:
```
Player → 1 CRC → Admin wallet
Pool = 1 CRC
```

**Easy AI** is free — no staking required.

---

## How Payout Works

Payouts are triggered server-side after a match completes. The admin wallet sends CRC back to winner(s) using the same Circles SDK pathfinding transfer.

### Win/Loss

| Scenario | Winner receives | Admin keeps |
|---|---|---|
| PvP win | 1.8 CRC (90% of 2 CRC pool) | 0.2 CRC |
| AI win (user beats AI) | 0.9 CRC (90% of 1 CRC pool) | 0.1 CRC |
| AI loss (user loses to AI) | 0 CRC | 1 CRC |

### Draw

The simplest fair split: **each staking player gets 90% of their stake back**.

| Scenario | Each player receives | Admin keeps |
|---|---|---|
| PvP draw | 0.9 CRC each | 0.2 CRC total |
| AI draw | 0.9 CRC | 0.1 CRC |

### Automatic vs Manual payouts

If `ADMIN_WALLET_PRIVATE_KEY` is set, payouts are automatic (triggered after the match ends). If it is not set, payouts are marked `pending_manual` in the match record — an admin must send them manually via the admin dashboard or directly through the Circles app.

---

## AI Opponent

The ChessBuddy AI uses a custom **minimax with alpha-beta pruning** engine, with piece-square tables for positional evaluation.

| Difficulty | Behaviour | Stake |
|---|---|---|
| Easy | Random legal moves | Free |
| Medium | 2-ply minimax | 1 CRC |
| Hard | 4-ply minimax + alpha-beta | 1 CRC |

AI moves are computed server-side in the `/api/matches/[id]/move` route and returned in the same response as the player's move.

---

## Leaderboard

Match results and CRC earnings are recorded server-side in `.data/leaderboard.json`. Points:
- **Win** = 3 points
- **Draw** = 1 point
- **Loss** = 0 points

The leaderboard shows the top 50 addresses sorted by points. Each address links to its Gnosis Chain explorer page for transparency.

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── play/page.tsx         # Game mode + difficulty selection
│   ├── waiting/page.tsx      # Matchmaking waiting room
│   ├── match/[id]/page.tsx   # Chess board (main game view)
│   ├── result/[id]/page.tsx  # Game result + payout status
│   ├── leaderboard/page.tsx  # Top players
│   └── api/
│       ├── matches/          # Create, get, move, resign, draw, payout
│       ├── matchmaking/      # Queue polling + cancel
│       └── leaderboard/      # Leaderboard data
├── contexts/
│   └── CirclesContext.tsx    # Wallet state, CRC balance, staking
├── lib/
│   ├── circles/
│   │   ├── runner.ts         # Browser EIP-1193 ContractRunner
│   │   ├── serverRunner.ts   # Private-key server ContractRunner
│   │   └── sdk.ts            # Circles SDK helpers
│   ├── chess/
│   │   └── ai.ts             # Minimax AI engine
│   ├── db/
│   │   └── index.ts          # JSON file-based match store
│   └── constants.ts          # Stake amounts, chain config, timers
└── types/
    └── index.ts              # Shared TypeScript types
```

---

## Known Limitations

1. **Trust path required for payouts** — Circles transfers require a trust path between sender and recipient. If the admin wallet doesn't trust a user, the automatic payout will fail and fall back to manual. Consider a Circles Group for production.

2. **File-based storage** — Match state is stored in `.data/*.json`. This is fine for MVP / single-instance deployments. Replace with PostgreSQL for production.

3. **No WebSockets** — PvP match updates use polling every 2 seconds. This means a ~2s lag for opponent moves. WebSockets (e.g. via Pusher or Ably) would improve this significantly.

4. **Single-server matchmaking** — The matchmaking queue is in-process. Horizontal scaling requires a shared store (Redis recommended).

5. **No move time enforcement** — Player timers are displayed client-side but not enforced server-side in this MVP. A server-side timer job would be needed for production.

6. **Easy AI** — Easy mode uses pure random moves. This is intentional for a beginner experience. Stockfish WASM could replace it for a stronger-but-configurable Easy.

7. **Circles demurrage** — CRC balances decay ~7%/year. The app always fetches live balances and does not cache them. However, a balance fetched seconds before a transaction is signed could theoretically have slightly decayed by the time the tx is confirmed. This is negligible in practice.

8. **Admin wallet trust** — For the app to pay out to users automatically, the admin wallet must have CRC trust paths to all users. In a fresh deployment, this means manually trusting each new user, or registering the admin as a Circles Organisation (which has more flexible trust rules).

---

## Built with

- [Next.js 15](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [chess.js](https://github.com/jhlywa/chess.js)
- [react-chessboard](https://github.com/Clariity/react-chessboard)
- [@aboutcircles/sdk](https://docs.aboutcircles.com/circles-sdk/getting-started-with-the-sdk.md)
- [viem](https://viem.sh/)
- [framer-motion](https://www.framer.com/motion/)
- [Gnosis Chain](https://www.gnosis.io/)

---

*ChessBuddy was built as a [Circles Garage](https://garage.aboutcircles.com) mini-app entry.*
