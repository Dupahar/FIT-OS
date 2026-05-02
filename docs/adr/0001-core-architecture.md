# ADR 0001: Core Architecture Choices

Date: 2026-03-11
Status: Accepted

## Context
We are building a multi-tenant B2B fitness SaaS for the Indian market with strict requirements for usage metering, WhatsApp automation, UPI billing, GST compliance, and biometric access control.

## Decisions
1. **Monorepo** using pnpm workspaces for `apps/api` and `apps/web`.
2. **Backend stack**: Node.js + TypeScript for rapid iteration and integration velocity.
3. **Database**: PostgreSQL with Row Level Security (RLS) and `tenant_id`-scoped access.
4. **Usage Ledger** as a first-class domain object; every billable event is recorded.
5. **Outbox pattern** for reliable integration events (WhatsApp, payments, devices).
6. **Tenant promotion path**: shared DB ? dedicated DB using logical replication + dual-write cutover.
7. **Data provenance** fields for imports to prevent ML contamination.

## Consequences
- All services must emit usage events and outbox events from day one.
- RLS enforcement requires setting `app.tenant_id` per request.
- Migration tooling must support tenant-specific cutovers without downtime.
