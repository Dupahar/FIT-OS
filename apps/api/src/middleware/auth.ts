import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { verifyToken } from "../lib/jwt";

export function authContext(req: Request, res: Response, next: NextFunction) {
  const headerKey = config.tenantHeader.toLowerCase();
  const devTenantId = req.header(config.tenantHeader) ?? "";

  if (req.headers[headerKey]) {
    delete req.headers[headerKey];
  }

  const authHeader = req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    if ((config.env === "development" || config.env === "test") && devTenantId) {
      console.warn("[DEV ONLY] Using x-tenant-id header fallback for tenant context");
      res.locals.tenantId = devTenantId;
      res.locals.userId = "dev-user";
      res.locals.role = "owner";
      return next();
    }

    res.status(401).json({ error: "missing_token" });
    return;
  }

  try {
    const payload = verifyToken(token);
    res.locals.tenantId = payload.tenant_id;
    res.locals.userId = payload.sub;
    res.locals.role = payload.role;
    // DB tenant context must be set per-query via withTenant(res.locals.tenantId).
    // Never use request headers or body as the tenant source in database calls.
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}