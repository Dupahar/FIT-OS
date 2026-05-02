import crypto from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";

const roleSchema = z.enum(["owner", "staff", "trainer"]);

const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: roleSchema,
  iat: z.number(),
  exp: z.number()
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type JwtClaims = Omit<JwtPayload, "iat" | "exp">;

export function signAccessToken(claims: JwtClaims): string {
  const options: SignOptions = { expiresIn: config.jwtExpiry as SignOptions["expiresIn"] };
  return jwt.sign(claims, config.jwtSecret, options);
}

export function signRefreshToken(claims: JwtClaims): string {
  const options: SignOptions = {
    expiresIn: config.refreshTokenExpiry as SignOptions["expiresIn"]
  };
  const jti =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
  const refreshClaims = { ...claims, jti };
  return jwt.sign(refreshClaims, config.jwtSecret, options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  const parsed = jwtPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("invalid_token_payload");
  }
  return parsed.data;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function expiryToDate(expiry: string): Date {
  return new Date(Date.now() + durationToMs(expiry));
}

function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(`invalid_duration:${value}`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount * 1000;
  }
}
