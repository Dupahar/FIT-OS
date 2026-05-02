# FIT Fitness SaaS - Architecture Overview

Last updated: 2026-03-11

---

## What We Built (Current Baseline)

- A monorepo MVP foundation for a multi-tenant B2B fitness SaaS focused on the Indian market.
- An API service with tenant-aware data access, core domain tables, and a versioned `v1` REST surface.
- A minimal admin web app shell to anchor the product direction and future workflows.
- A PostgreSQL schema with Row Level Security (RLS) and first-class Usage Ledger, Outbox, and Data Provenance tables.

---

## Architecture Principles

1. Multi-tenant from day one. Data isolation via `tenant_id` and row-level security in the primary database.
2. Event-driven core. Outbox pattern keeps integrations and analytics reliable and decoupled.
3. Ledger-first billing. Every transaction is auditable, reversible, and GST-compliant.
4. WhatsApp and biometric access as platform services, not optional plugins.
5. Observability and security baked in before scale, not retrofitted.

---

## System Components

| Component | Stack |
|---|---|
| `apps/api` | Node.js + TypeScript + Express |
| `apps/web` | React + Vite admin web app |
| `apps/worker` | Background worker (outbox drain + usage aggregation) - in progress |
| Database | PostgreSQL 14+ with RLS |

### High-Level Flow

```
Gym Staff / Owner
      |
      v
Admin Web App (React + Vite)
      |
      v
API Service (Express + TypeScript)
      |
  +---+----------------------+
  |                          |
  v                          v
PostgreSQL + RLS         Outbox Events Table
                              |
                              v
                        Background Worker
                              |
              +---------------+---------------+
              v               v               v
        WhatsApp BSP    Payment Gateway   Biometric Devices
```

---

## Backend Architecture

### API Service

- Express app with JSON parsing, CORS, Helmet, and request logging.
- `/health` for liveness checks.
- `/v1` routes mounted behind tenant context middleware.

### Tenant Context - DECISION REQUIRED (see ADR-001)

Current behavior: Tenant context is resolved from `x-tenant-id` request header.

Production risk: Any client can spoof a tenant ID with this approach. A raw header-based tenant resolution is not safe for production without authentication.

Decision locked (see ADR-001): Tenant context will be sourced from JWT claims after authentication is implemented. The `x-tenant-id` header is acceptable for local development only and must be removed from all non-development environments.

Transition rule. The tenant context middleware must be updated to:
1. Extract `tenant_id` from the validated JWT payload.
2. Strip any inbound `x-tenant-id` header before it reaches route handlers.
3. Set `app.tenant_id` on the database connection from the JWT-derived value only.

This decision must be implemented before any production deployment and before authentication is built around the header approach.

---

### API Capabilities (v1)

Read/list/create endpoints are provided for core resources:

- `members`
- `users`
- `plans`
- `memberships`
- `invoices` + `invoice-items`
- `payments`
- `devices`
- `attendance-events`
- `usage-ledger`
- `outbox-events`
- `audit-log`
- `data-provenance`

Additional: `GET /v1/tenants/me`

Pagination: List endpoints support `?limit=` (default 50, max 200).

### Mutation Gap - MUST CLOSE BEFORE PILOT

Write/update/delete endpoints are currently absent. A pilot gym cannot operate on read and create alone. The following mutations are on the critical path for Phase 2:

| Entity | Required Mutations |
|---|---|
| `members` | update contact details, soft-delete |
| `memberships` | freeze, unfreeze, upgrade, transfer, cancel |
| `invoices` | void, mark-paid |
| `payments` | refund, adjust |
| `plans` | update pricing, deactivate |
| `devices` | update status, deregister |

These must be implemented in the Phase 2 sprint (Weeks 10-17) before the pilot gym onboarding window.

---

## Background Worker - HIGHEST PRIORITY AFTER AUTH

### Worker Priority

The outbox pattern only delivers reliability guarantees if the worker draining it is resilient. An unprocessed outbox is not a degraded state; it is a silent failure mode. The worker is the first thing built after authentication, before any integration work (WhatsApp, payments, biometrics) begins.

### Worker Responsibilities

| Job | Trigger | Destination |
|---|---|---|
| Outbox drain | Polling / LISTEN-NOTIFY | WhatsApp BSP, Payment Gateway, Biometric Device API |
| Usage ledger aggregation | Scheduled (hourly) | Internal analytics, tenant billing |
| Churn risk scoring (rules-based) | Scheduled (daily) | Internal alerts, WhatsApp nudge queue |

### Worker Design Requirements

- At-least-once delivery with idempotency keys on all outbound API calls.
- Exponential backoff with dead-letter queue for failed events.
- Event status tracked in `outbox_events` (`pending` -> `processing` -> `delivered` / `failed`).
- Worker health exposed via `/health` endpoint on a separate port.
- Tenant context set from outbox event payload, never from environment variable.

---

## Data Architecture

### Core Tables

| Table | Purpose |
|---|---|
| `tenants` | Tenant registry, status |
| `users` | Tenant-scoped users with roles |
| `members` | Gym members, contact data |
| `plans` | Membership plans with GST metadata |
| `memberships` | Plan subscriptions per member |
| `invoices` + `invoice_items` | Billing primitives |
| `payments` | Payment records |
| `devices` | Biometric device registry |
| `attendance_events` | Access control events |
| `usage_ledger` | Billable events ledger (WhatsApp, biometric syncs, API calls) |
| `outbox_events` | Integration events for async dispatch |
| `audit_log` | Traceable actions per tenant |
| `data_provenance` | Imported data tracking with confidence metadata |

### Row Level Security (RLS)

- Enabled on all tenant-scoped tables.
- Policies restrict access to rows where `tenant_id` matches `app.tenant_id`.
- `app.tenant_id` is set per-request at connection scope from JWT claims (post-auth) or header (local dev only).

### Data Provenance (ML Poisoning Prevention)

All records imported via QuickSync migration carry provenance metadata:

```sql
source_system     TEXT,      -- e.g. 'fitness_force', 'traqade', 'csv_import'
imported_at       TIMESTAMPTZ,
confidence_level  TEXT       -- 'native' | 'migrated' | 'reconciled'
```

ML training rule: Only records with `confidence_level = 'native'` are eligible for ML feature pipelines. Migrated data is visible in analytics dashboards but flagged and excluded from model training sets.

---

## Multi-Tenancy Model

### Tenant Classes

| Class | DB Strategy | Sync Frequency |
|---|---|---|
| SMB | Shared cluster + RLS | Standard (5-min biometric sync) |
| Mid | Shared cluster + RLS | Enhanced (2-min biometric sync) |
| Enterprise | Dedicated DB shard | Real-time push |

### Tenant Promotion (Shared -> Dedicated DB)

For Enterprise tenants requiring DB isolation, the zero-downtime promotion playbook is:

1. Pre-provision dedicated database with identical schema and extensions.
2. Start logical replication filtered by `tenant_id`.
3. Dual-write window: writes go to both shared and dedicated DB for the tenant.
4. Shadow reads from dedicated DB for a traffic subset to validate parity.
5. Cutover: route all tenant traffic to dedicated DB at a low-traffic window.
6. Stop replication and archive the shared tenant slice as read-only.

This playbook is documented as a formal runbook with automated health checks. It is not required at MVP.

---

## Usage Ledger

The usage ledger is a first-class billing primitive, not a logging table. Every billable event writes to `usage_ledger` before it is dispatched.

### Billable Event Types

| Event Type | Pass-Through Tier | Included Tier |
|---|---|---|
| `whatsapp_business_initiated` | SMB (pass-through) | Growth, Enterprise (included quota) |
| `whatsapp_user_initiated` | All tiers | - |
| `biometric_sync` | SMB (pass-through above threshold) | Growth, Enterprise |
| `api_call_export` | Enterprise only | - |

### Cost Visibility

Usage ledger data feeds:

- Tenant-facing cost dashboards (Phase 7)
- Automated overage invoicing (Phase 3)
- Internal cost-to-serve reporting per tenant

---

## ML Retention Engine - Staged Rollout

AI is not a launch promise. The retention engine ships in three stages:

| Stage | Timeline | Mechanism |
|---|---|---|
| Stage 1 | Launch (Month 1) | Rules-based churn scoring (attendance decay, renewal proximity, payment failures) |
| Stage 2 | Months 3-6 | Cohort-based baselines; interventions trigger on divergence from cohort median |
| Stage 3 | Months 6-12 | ML model (Random Forest / Boosted Trees) after sufficient native data accumulates |

Cold-start rule: The ML model does not go live until it demonstrably outperforms Stage 1 rules-based scoring on a held-out pilot cohort. Only `confidence_level = 'native'` data is used in training.

---

## Frontend

### Web App

- React + Vite admin shell.
- Note: Current serif design direction should be validated with real front desk staff before the Phase 2 pilot. B2B admin dashboards optimize for scan-speed and error-rate under operational conditions, not aesthetic differentiation. Run a 1-hour usability test with one gym employee before committing to typography and layout choices.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### Quickstart

```bash
pnpm install
pnpm --filter @fit/api dev
pnpm --filter @fit/web dev
```

### Database Setup

```bash
docker-compose up -d db
psql -f apps/api/db/schema.sql $DATABASE_URL
psql -f apps/api/db/seed.sql $DATABASE_URL
```

---

## Known Gaps and Priority Order

| Gap | Priority | Target Phase |
|---|---|---|
| Authentication (JWT + password hashing) | P0 - blocks everything | Phase 1 completion |
| Tenant context moved from header to JWT claims | P0 - security | Alongside auth |
| Background worker (outbox drain + usage aggregation) | P1 - first after auth | Phase 1 completion |
| Mutation endpoints (update, delete, freeze, etc.) | P1 - blocks pilot | Phase 2 Week 10-11 |
| Tenant provisioning API | P2 | Phase 2 |
| Richer filtering on list endpoints | P2 | Phase 2 |

---

## Decision Log

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Tenant context source: JWT claims vs header | Decided - see `docs/adr/ADR-001-tenant-context.md` |
