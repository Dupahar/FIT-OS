import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function tenantContext(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.header(config.tenantHeader);

  if (!tenantId) {
    res.status(400).json({ error: "missing_tenant_id" });
    return;
  }

  res.locals.tenantId = tenantId;
  next();
}
