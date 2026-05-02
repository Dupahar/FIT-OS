# ADR-001: Tenant Context Source - JWT Claims vs Request Header

Status: Decided
Date: 2026-03-11
Deciders: Founding team
Supersedes: N/A
Superseded by: N/A

---

## Context

The API service must resolve a `tenant_id` on every authenticated request to enforce Row Level Security (RLS) at the database layer. Two approaches are available:

Option A - Request Header (`x-tenant-id`)
The client passes a `x-tenant-id` header and the middleware trusts it directly, setting `app.tenant_id` on the database connection.

Option B - JWT Claims
The client authenticates and receives a signed JWT. The `tenant_id` is embedded in the token payload at issuance. The middleware validates the token and extracts `tenant_id` from the claims.

This decision was triggered by identifying Option A as a production security liability during architecture review.

---

## Problem with Option A (Current State)

The current implementation uses Option A for local development convenience. It has a critical flaw in any non-development environment:

- Any client can set `x-tenant-id: <any_tenant_uuid>` on a request.
- Without token validation, the API has no way to verify the caller is authorized for that tenant.
- RLS protects the database layer, but the API layer, including rate limiting, audit logging, and permission checks, operates on an unverified tenant identity.
- A malicious or misconfigured client could enumerate or pollute another tenant's data before RLS even fires.

This is not a theoretical risk. In a multi-tenant SaaS serving gym businesses, a data breach between tenants would be a commercial and legal catastrophe.

---

## Decision

Use Option B: JWT Claims as the authoritative tenant context source in all non-development environments.

Rationale:

1. The JWT is signed by the auth server. Tampering with claims invalidates the signature. A client cannot forge a `tenant_id` in a valid token.
2. `tenant_id` is set once at token issuance, tied to the authenticated user's account. It cannot drift or be overridden per-request.
3. Audit logs, rate limiting, and permission checks all operate on a verified identity.
4. This is the standard approach in multi-tenant SaaS and requires no custom security model.

---

## Implementation Rules

### Token Issuance

When a user authenticates, the JWT payload must include:

```json
{
  "sub": "<user_uuid>",
  "tenant_id": "<tenant_uuid>",
  "role": "<owner | staff | trainer>",
  "iat": <issued_at>,
  "exp": <expiry>
}
```

`tenant_id` and `role` are written at issuance and are non-negotiable claims. They cannot be set by the client.

### Middleware Behavior (Post-Auth)

The tenant context middleware must:

1. Validate the JWT signature and expiry. Reject with `401` if invalid or expired.
2. Extract `tenant_id` from the validated payload.
3. Strip any inbound `x-tenant-id` header before it reaches any route handler. This is non-negotiable.
4. Set `app.tenant_id` on the database connection from the JWT-derived value only.
5. Attach the decoded token (user, tenant, role) to `req.context` for downstream use.

```typescript
// Correct middleware shape (post-auth implementation)
async function tenantContextMiddleware(req, res, next) {
  // 1. Strip spoofable header unconditionally
  delete req.headers['x-tenant-id'];

  // 2. Validate token
  const token = extractBearerToken(req);
  const payload = await verifyJwt(token); // throws on invalid/expired

  // 3. Set DB connection scope from verified claim
  await db.query(`SET app.tenant_id = $1`, [payload.tenant_id]);

  // 4. Attach to request context
  req.context = {
    userId: payload.sub,
    tenantId: payload.tenant_id,
    role: payload.role,
  };

  next();
}
```

### Local Development Exception

In `NODE_ENV=development` or `NODE_ENV=test`, the middleware may accept `x-tenant-id` as a fallback when no Bearer token is present. This allows local development and integration tests without a full auth stack.

This exception must be:

- Guarded by environment check, never active in staging or production.
- Logged as a warning on every request that uses it.
- Removed entirely once the auth flow is stable.

```typescript
if (process.env.NODE_ENV === 'development' && !token) {
  const devTenantId = req.headers['x-tenant-id'];
  if (devTenantId) {
    console.warn('[DEV ONLY] Using x-tenant-id header - not safe for production');
    await db.query(`SET app.tenant_id = $1`, [devTenantId]);
    req.context = { tenantId: devTenantId, role: 'owner', userId: 'dev-user' };
    return next();
  }
}
```

---

## Consequences

### Positive

- Tenant identity is cryptographically verified on every request.
- No client-side spoofing of tenant context is possible in production.
- Audit logs capture verified identity, not self-reported headers.
- Aligns with standard multi-tenant SaaS security practice.

### Negative / Trade-offs

- Auth must be implemented before any production deployment. This is a hard dependency.
- JWT expiry requires refresh token handling to avoid forcing gym staff to re-login mid-shift.
- Token payload size increases slightly with tenant claims. Negligible in practice.

### Risks

- If JWT signing keys are compromised, tenant isolation is compromised. Mitigate with key rotation policy and short token expiry (15-60 minutes) with refresh tokens.

---

## Alternatives Considered

| Option | Rejected Reason |
|---|---|
| `x-tenant-id` header (permanent) | Spoofable. Not acceptable in production. |
| API key per tenant (no JWT) | Does not encode user identity or role. Cannot support per-user RBAC. |
| Session cookie with server-side store | Adds stateful session infrastructure. JWT is simpler and more compatible with mobile/PWA clients. |
| Subdomain-based tenant resolution | Adds DNS and TLS complexity. Not necessary at current scale. |

---

## Review Criteria

This ADR should be revisited if:

- A machine-to-machine API client (e.g., biometric device webhook sender) needs to authenticate without a user JWT. In that case, a separate service token flow with tenant-scoped API keys is required.
- The platform moves to a federated identity model (SSO / SAML) for enterprise tenants.
