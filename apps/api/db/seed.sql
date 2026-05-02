-- Seed data for local dev
INSERT INTO tenants (id, name, slug, gstin, state_code, legal_name, address)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Gym',
  'demo-gym',
  '27AABCU9603R1ZX',
  '27',
  'Demo Gym Pvt Ltd',
  '123 Demo Street, Mumbai, MH'
)
ON CONFLICT (id) DO UPDATE
  SET gstin = EXCLUDED.gstin,
      state_code = EXCLUDED.state_code,
      legal_name = EXCLUDED.legal_name,
      address = EXCLUDED.address;

INSERT INTO users (tenant_id, email, password_hash, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'owner@demo.local', '$argon2id$v=19$m=65536,t=3,p=4$J39nlx2rYaIahnXn2daWrQ$VC1uzAvcucVwMgNWnRlCWWERYq3PxqqPxd6on+LLl0E', 'owner')
ON CONFLICT DO NOTHING;
