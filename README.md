# FIT OS

FIT OS is a multi-tenant fitness business operating system for Indian gyms, studios, and fitness chains. It combines member management, GST-ready billing, payments, leads, inventory, biometric access events, WhatsApp workflows, and usage metering in one product-grade SaaS foundation.

The repository is built as a TypeScript monorepo with a PostgreSQL core, a protected Express API, a React dashboard, and a background worker for reliable asynchronous jobs.

## What It Does

- Runs a tenant-aware gym management backend with PostgreSQL Row Level Security.
- Manages members, memberships, plans, invoices, payments, attendance, devices, leads, inventory, users, and tenant settings.
- Issues GST-aware invoices with invoice numbers, HSN codes, CGST/SGST/IGST fields, PDF invoice output, and CSV/Tally-style export.
- Supports JWT login, refresh tokens, role-based access, and development-only tenant fallback.
- Queues integration work through an outbox table so WhatsApp, payment, and biometric events can be retried safely.
- Tracks billable events through a usage ledger for future subscription and overage billing.
- Includes a polished React/Vite admin dashboard in `Frontend` for the full product experience.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `Frontend` | Main React + Vite dashboard with routing, auth, member workflows, billing, analytics, inventory, leads, and settings. |
| `apps/api` | Express + TypeScript API, auth, tenant-aware routes, payment hooks, invoice export, and database access. |
| `apps/web` | Minimal React shell kept as a lightweight workspace app. |
| `apps/worker` | Background worker for outbox dispatch, retries, usage logging, and scheduled jobs. |
| `apps/api/db` | PostgreSQL schema, seed data, and worker role setup. |
| `docs` | Architecture notes and ADRs. |
| `docker-compose.yml` | Local PostgreSQL and Redis services. |
| `start-all.bat` | Windows helper that starts database setup, API, worker, and frontend. |

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, Recharts, Radix UI, Lucide icons |
| API | Node.js, Express, TypeScript, Zod, JWT, Argon2, PostgreSQL, PDFKit, Razorpay |
| Worker | Node.js, TypeScript, PostgreSQL polling, HTTP health endpoint |
| Database | PostgreSQL 14+, UUID extension, Row Level Security, outbox pattern |
| Tooling | pnpm workspaces, npm for the standalone `Frontend` app, Docker Compose |

## Main Features

### Member Operations

- Member directory and profiles
- Membership lifecycle fields including active, frozen, and cancelled states
- Attendance event history
- Role-aware access for owners, staff, and trainers

### Billing And GST

- Plan catalog with GST rate support
- Invoice creation with calculated tax fields
- Manual and Razorpay payment records
- Invoice status updates
- PDF invoice generation
- CSV export for accounting workflows

### Leads And Front Desk

- Lead capture by source
- Follow-up and event tracking
- Conversion metadata
- Front-desk activity logging in the dashboard

### Inventory

- Inventory item catalog
- Stock movement records
- Reorder levels, supplier fields, and movement reasons
- Optional invoice creation from item movement flows

### Platform Core

- Tenant-scoped tables with RLS policies
- JWT access tokens and rotating refresh tokens
- Outbox table for reliable integration events
- Worker retries with dead-letter handling
- Usage ledger for billable event tracking
- Data provenance tables for migrated data safety

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- npm, included with Node.js
- Docker Desktop, or a local PostgreSQL 14+ installation
- Git

On Windows, the included `start-all.bat` expects PostgreSQL 17 at `C:\Program Files\PostgreSQL\17\bin\psql.exe`. If you use Docker instead, follow the manual setup below.

## Quick Start

### Option 1: Windows Helper

```bat
start-all.bat
```

The helper starts PostgreSQL, applies the schema, updates the demo tenant, opens API and worker terminals, starts the frontend, and opens the browser at:

```text
http://localhost:5173
```

### Option 2: Manual Setup

Start the database:

```bash
docker compose up -d db redis
```

Install workspace dependencies:

```bash
pnpm install
```

Install the main dashboard dependencies if needed:

```bash
cd Frontend
npm install
cd ..
```

Create an API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Apply schema and seed data:

```bash
psql "postgres://fit:fit@localhost:5432/fit" -f apps/api/db/schema.sql
psql "postgres://fit:fit@localhost:5432/fit" -f apps/api/db/seed.sql
```

Run the services in separate terminals:

```bash
pnpm --filter @fit/api dev
pnpm --filter @fit/worker dev
cd Frontend && npm run dev
```

Open:

```text
Frontend: http://localhost:5173
API:      http://localhost:4000
Worker:   http://localhost:3001/health
```

## Demo Login

Use the seeded local account:

| Field | Value |
| --- | --- |
| Tenant ID | `11111111-1111-1111-1111-111111111111` |
| Email | `owner@demo.local` |
| Password | `Fit@12345` |

These credentials are for local development only.

## Environment Variables

### API

Create `apps/api/.env` from `apps/api/.env.example`.

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PORT` | API port. Defaults to `4000`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret for signing access and refresh tokens. Use a strong value outside local dev. |
| `JWT_EXPIRY` | Access token lifetime, for example `15m`. |
| `REFRESH_TOKEN_EXPIRY` | Refresh token lifetime, for example `30d`. |
| `RAZORPAY_KEY_ID` | Razorpay key for order creation. |
| `RAZORPAY_KEY_SECRET` | Razorpay secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret. |
| `WHATSAPP_*` | WhatsApp Cloud API configuration for worker-dispatched messages. |

### Frontend

The dashboard defaults to `http://localhost:4000`. To override it, create `Frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

### Worker

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Worker database connection string. |
| `WORKER_POLL_INTERVAL_MS` | Poll interval. Defaults to `5000`. |
| `WORKER_BATCH_SIZE` | Claimed outbox events per poll. Defaults to `10`. |
| `WORKER_MAX_RETRIES` | Retry limit before dead-letter. Defaults to `5`. |
| `WORKER_HEALTH_PORT` | Health server port. Defaults to `3001`. |

## Useful Commands

```bash
# Type-check all pnpm workspace apps
pnpm -r typecheck

# Run all workspace dev scripts
pnpm -r dev

# API only
pnpm --filter @fit/api dev
pnpm --filter @fit/api typecheck

# Worker only
pnpm --filter @fit/worker dev
pnpm --filter @fit/worker e2e:outbox

# Main dashboard
cd Frontend
npm run dev
npm run build
```

## API Overview

Public routes:

- `GET /health`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/payments/webhook`

Protected routes use a Bearer token:

- `GET /v1/tenants/me`
- `PATCH /v1/tenants/me`
- `GET /v1/members`
- `POST /v1/members`
- `PATCH /v1/members/:id`
- `GET /v1/plans`
- `POST /v1/plans`
- `PATCH /v1/plans/:id`
- `GET /v1/memberships`
- `POST /v1/memberships`
- `PATCH /v1/memberships/:id`
- `GET /v1/invoices`
- `POST /v1/invoices`
- `PATCH /v1/invoices/:id`
- `GET /v1/invoices/export`
- `GET /v1/invoices/:id/export`
- `GET /v1/invoices/:id/pdf`
- `GET /v1/payments`
- `POST /v1/payments`
- `GET /v1/devices`
- `POST /v1/devices/:id/sync`
- `GET /v1/attendance-events`
- `GET /v1/leads`
- `POST /v1/leads`
- `PATCH /v1/leads/:id`
- `GET /v1/leads/export`
- `GET /v1/inventory-items`
- `POST /v1/inventory-items`
- `PATCH /v1/inventory-items/:id`
- `POST /v1/inventory-items/:id/movements`

List endpoints generally support `?limit=` with a default of `50` and maximum of `200`.

## Security Notes

- Production tenant context must come from signed JWT claims, not from client-provided tenant headers.
- The `x-tenant-id` fallback is development-only and should not be enabled in production.
- Do not commit `.env`, payment keys, database dumps, logs, or local generated output.
- The worker should use the dedicated database role created by `apps/api/db/worker.sql`, not a superuser.
- Rotate `JWT_SECRET`, Razorpay secrets, and WhatsApp tokens before any public deployment.

## Verification

Current local verification commands:

```bash
node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit
node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
node apps/worker/node_modules/typescript/bin/tsc -p apps/worker/tsconfig.json --noEmit
cd Frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

The direct `node ...` form is useful on Windows machines where shell shims or sandboxed shells block `pnpm`, `npm`, or esbuild child processes.

## Roadmap

- Harden production auth and tenant context enforcement.
- Add automated API integration tests around auth, billing, and tenant isolation.
- Expand worker destinations for WhatsApp, Razorpay, and biometric devices.
- Add migration tooling for importing legacy gym data with provenance tracking.
- Build deployment configuration for production hosting.

## License

Private project. All rights reserved unless a license is added later.
