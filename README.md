# fridge-monorepo

Backend for a **receipt-scanning and shared fridge inventory** app. Users photograph a grocery receipt; the API parses it with **Google Gemini**, extracts the items and adds them to a shared household inventory.

## Architecture

| Path | Responsibility |
|---|---|
| `core/fridge-core` | Domain logic: inventory, households, account lifecycle |
| `services/fridge-api` | REST API layer, security headers, uploads |
| `packages/modules` | Reusable internal modules |
| `db-schemas` | Versioned SQL schema files |
| `test` | Jest test suite |

## Tech Stack

Node.js, Express, PostgreSQL, Google Gemini API, Docker (dev & prod compose files), Jest.

## Getting started

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install
npm start
```
