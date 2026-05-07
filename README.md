# Tutor AI — Backend

Node.js + Express + TypeScript backend for the Tutor AI project.

## Quick start

```bash
cp .env.example .env   # fill in your values
npm install
npm run dev            # starts with nodemon + ts-node on port 3001
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot-reload (nodemon) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled build |
| `npm run lint` | Type-check without emitting |

## Project structure

```
src/
  index.ts          # entry point — app + server bootstrap
  routes/           # Express routers (one file per resource)
  services/         # Business logic (no HTTP concerns)
  middleware/       # Express middleware (logging, error handling, auth…)
  utils/            # Pure helpers (logger, etc.)
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns status, timestamp, uptime |

## Environment variables

See `.env.example` for all required variables.
