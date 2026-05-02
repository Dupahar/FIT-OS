-- Worker role and grants (run as a DB admin)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fit_worker') THEN
    CREATE ROLE fit_worker LOGIN PASSWORD 'change_me';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO fit_worker;
GRANT SELECT, INSERT, UPDATE ON outbox_events TO fit_worker;
GRANT SELECT ON members TO fit_worker;
GRANT SELECT ON memberships TO fit_worker;
GRANT SELECT, INSERT ON usage_ledger TO fit_worker;
