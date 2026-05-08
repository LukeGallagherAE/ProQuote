# ProQuote 2.1

Electrical quoting tool — Node/Express backend with PostgreSQL storage.

## Prerequisites

- Node.js 18+
- PostgreSQL (local install or cloud connection string)

## Setup

### 1. Create the database

```bash
createdb proquote
psql -d proquote -f db/schema.sql
```

### 2. Configure environment

Copy `.env.example` to `.env` and update the connection string if needed:

```
DATABASE_URL=postgresql://localhost:5432/proquote
PORT=3000
```

For a cloud database (Supabase, Railway, Neon etc.) just paste the connection string they provide.

### 3. Install dependencies

```bash
npm install
```

### 4. Run

```bash
npm start          # production
npm run dev        # development (auto-restarts on file changes)
```

Open http://localhost:3000 in your browser.

## Project structure

```
ProQuote 2.1/
├── server.js           — Express app entry point
├── db/
│   ├── index.js        — PostgreSQL connection pool
│   └── schema.sql      — Table definitions (run once)
├── routes/
│   ├── storage.js      — GET/PUT /api/storage  (all workspace settings)
│   └── quotes.js       — CRUD  /api/quotes/:id (individual quotes)
└── public/
    └── index.html      — Frontend (ProQuote UI, unchanged except API shim)
```

## How it works

The frontend is the original ProQuote UI with a small shim injected before the main script.
The shim replaces `localStorage` with an in-memory cache that automatically syncs to the
server via two endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/storage` | Load all workspace settings on startup |
| `PUT /api/storage` | Debounced flush (1.5s) of all settings |
| `GET /api/quotes` | Not used by UI yet (available for future features) |
| `PUT /api/quotes/:id` | Debounced save of the active quote |
| `DELETE /api/quotes/:id` | Called when a quote tab is closed |

## What's stored where

| PostgreSQL table | Content |
|---|---|
| `settings` | All workspace data: profile, clients, pricelist, templates, variations, tracker, theme, etc. |
| `quotes` | Each quote tab individually (mirrors `proquote_session_quotes` in settings) |

## Next steps (planned)

- [ ] User authentication (JWT)
- [ ] Per-user data isolation
- [ ] Cloud hosting (Railway / Supabase)
- [ ] Desktop packaging (Electron / Tauri)
