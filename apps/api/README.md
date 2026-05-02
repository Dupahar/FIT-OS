# FIT API

## Local setup (manual)
1. Start Postgres: `docker-compose up -d db`
2. Apply schema: `psql -f apps/api/db/schema.sql $DATABASE_URL`
3. Seed data: `psql -f apps/api/db/seed.sql $DATABASE_URL`

## Tenant header
All tenant-scoped requests must include the header defined by `TENANT_HEADER`.
Default: `x-tenant-id`
