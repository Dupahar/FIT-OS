import { Router } from "express";
import { z } from "zod";
import { withTenant } from "../../db";
import { verifyPassword } from "../../lib/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashRefreshToken,
  expiryToDate,
  type JwtPayload
} from "../../lib/jwt";
import { config } from "../../config";
import { authContext } from "../../middleware/auth";

const authRouter = Router();

const uuid = z.string().uuid();
const roleSchema = z.enum(["owner", "staff", "trainer"]);

const loginSchema = z.object({
  tenant_id: uuid,
  email: z.string().email(),
  password: z.string().min(1)
});

type UserRow = {
  id: string;
  tenant_id: string;
  role: "owner" | "staff" | "trainer";
  password_hash: string;
  is_active: boolean;
};

type RefreshDeleteRow = {
  user_id: string;
  tenant_id: string;
};

type UserRoleRow = {
  role: "owner" | "staff" | "trainer";
  is_active: boolean;
};

// Precomputed argon2id hash to normalize login timing for missing users.
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$g9rqQ//7axToAyayBTUQyA$jgxhe2O8/Hm95L+GyVJ/p2+CeV2hQaJMGQj9/1hquZA";

function asyncHandler(handler: (req: any, res: any) => Promise<void>) {
  return (req: any, res: any) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.status(500).json({ error: "internal_error" });
      console.error(err);
    });
  };
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const { tenant_id, email, password } = parsed.data;

    const result = await withTenant(tenant_id, (client) =>
      client.query<UserRow>(
        `SELECT id, tenant_id, role, password_hash, is_active
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [email]
      )
    );

    const user = result.rows[0];
    const hashToVerify = user?.password_hash ?? DUMMY_HASH;
    const valid = await verifyPassword(hashToVerify, password);

    if (!user || !user.is_active || !valid || !roleSchema.safeParse(user.role).success) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const claims = { sub: user.id, tenant_id: user.tenant_id, role: user.role };
    const accessToken = signAccessToken(claims);
    const refreshToken = signRefreshToken(claims);
    const refreshHash = hashRefreshToken(refreshToken);
    const refreshExpiresAt = expiryToDate(config.refreshTokenExpiry);

    // Use tenant_id from the verified user record for all writes (never from request body).
    await withTenant(user.tenant_id, async (client) => {
      await client.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);
      await client.query(
        `INSERT INTO refresh_tokens (user_id, tenant_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, user.tenant_id, refreshHash, refreshExpiresAt]
      );
    });

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: config.jwtExpiry
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = typeof req.body?.refresh_token === "string" ? req.body.refresh_token : "";
    if (!refreshToken) {
      res.status(401).json({ error: "missing_token" });
      return;
    }

    let payload: JwtPayload;
    try {
      payload = verifyToken(refreshToken);
    } catch {
      res.status(401).json({ error: "invalid_or_expired_token" });
      return;
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const result = await withTenant(payload.tenant_id, async (client) => {
      const deleted = await client.query<RefreshDeleteRow>(
        `DELETE FROM refresh_tokens
         WHERE token_hash = $1 AND expires_at > NOW()
         RETURNING user_id, tenant_id`,
        [tokenHash]
      );

      if (deleted.rowCount === 0) {
        const existing = await client.query(
          `SELECT id FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
          [tokenHash]
        );

        if ((existing.rowCount ?? 0) > 0) {
          await client.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
          return { outcome: "expired" as const };
        }

        // Possible refresh token replay - invalidate entire session for this user.
        await client.query(
          `DELETE FROM refresh_tokens WHERE user_id = $1 AND tenant_id = $2`,
          [payload.sub, payload.tenant_id]
        );
        return { outcome: "replay" as const };
      }

      const { user_id, tenant_id } = deleted.rows[0];

      const userResult = await client.query<UserRoleRow>(
        `SELECT role, is_active FROM users WHERE id = $1`,
        [user_id]
      );

      const userRow = userResult.rows[0];
      if (!userRow || !userRow.is_active || !roleSchema.safeParse(userRow.role).success) {
        return { outcome: "inactive" as const };
      }

      const claims = { sub: user_id, tenant_id, role: userRow.role };
      const nextAccessToken = signAccessToken(claims);
      const nextRefreshToken = signRefreshToken(claims);
      const nextRefreshHash = hashRefreshToken(nextRefreshToken);
      const nextRefreshExpiresAt = expiryToDate(config.refreshTokenExpiry);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, tenant_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user_id, tenant_id, nextRefreshHash, nextRefreshExpiresAt]
      );

      return {
        outcome: "ok" as const,
        tokens: { access_token: nextAccessToken, refresh_token: nextRefreshToken }
      };
    });

    if (!result || result.outcome !== "ok") {
      res.status(401).json({ error: "invalid_or_expired_token" });
      return;
    }

    res.json({
      ...result.tokens,
      token_type: "Bearer",
      expires_in: config.jwtExpiry
    });
  })
);

authRouter.post(
  "/logout",
  authContext,
  asyncHandler(async (req, res) => {
    const refreshToken = typeof req.body?.refresh_token === "string" ? req.body.refresh_token : "";
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const tenantId = res.locals.tenantId as string;
      await withTenant(tenantId, (client) =>
        client.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash])
      );
    }

    res.status(204).send();
  })
);

export { authRouter };
