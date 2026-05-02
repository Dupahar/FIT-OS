# FIT Fitness SaaS

Monorepo for the Indian fitness management SaaS MVP.

## Structure
- `apps/api` - Node.js/TypeScript API (multi-tenant core, usage ledger, outbox)
- `apps/web` - Admin web app (React, mobile-first)
- `apps/worker` - Background worker (outbox drain, scheduled jobs)
- `docs/adr` - Architecture decision records

## Prerequisites (local dev)
- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

## Quickstart (local)
1. `pnpm install`
2. `pnpm --filter @fit/api dev`
3. `pnpm --filter @fit/web dev`
4. `pnpm --filter @fit/worker dev`

## Notes
This repo is being bootstrapped. Infrastructure and DB schema are in `apps/api/db`.

