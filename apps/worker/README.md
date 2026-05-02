# FIT Worker

Background worker for draining the outbox and running scheduled jobs.

## Local dev

1. Ensure PostgreSQL is running and `DATABASE_URL` is set.
2. Start the worker:

```bash
pnpm --filter @fit/worker dev
```

## Outbox E2E test

Requires the API and worker to be running.

```bash
pnpm --filter @fit/worker e2e:outbox
```

Environment variables:

- `API_BASE_URL` (default: http://localhost:4000)
- `TENANT_ID` (default: demo tenant UUID)
- `TENANT_HEADER` (default: x-tenant-id)
- `OUTBOX_E2E_TIMEOUT_MS` (default: 10000)
- `OUTBOX_E2E_POLL_MS` (default: 500)
- `DATABASE_URL` (required)

## Environment

- `DATABASE_URL` (required)
- `WORKER_POLL_INTERVAL_MS` (default: 5000)
- `WORKER_BATCH_SIZE` (default: 10)
- `WORKER_MAX_RETRIES` (default: 5)
- `WORKER_PROCESSING_TIMEOUT_SECONDS` (default: 300)
- `WORKER_HEALTH_PORT` (default: 3001)

## Database role (required for production)

Do not run the worker as a superuser or with `BYPASSRLS`.
Instead, create a dedicated role and grant only the tables it needs.

Run the script:

```bash
psql -f apps/api/db/worker.sql $DATABASE_URL
```

Then set `DATABASE_URL` to use the `fit_worker` role.
