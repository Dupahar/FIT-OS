import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string(),
  TENANT_HEADER: z.string().default("x-tenant-id"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1)
});

const parsed = schema.parse(process.env);

export const config = {
  env: parsed.NODE_ENV,
  port: Number(parsed.PORT),
  databaseUrl: parsed.DATABASE_URL,
  tenantHeader: parsed.TENANT_HEADER,
  jwtSecret: parsed.JWT_SECRET,
  jwtExpiry: parsed.JWT_EXPIRY,
  refreshTokenExpiry: parsed.REFRESH_TOKEN_EXPIRY,
  razorpayKeyId: parsed.RAZORPAY_KEY_ID,
  razorpayKeySecret: parsed.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: parsed.RAZORPAY_WEBHOOK_SECRET
};
