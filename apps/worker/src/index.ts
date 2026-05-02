import "dotenv/config";
import { Pool, PoolClient } from "pg";
import { createServer } from "node:http";
import { sendWhatsAppTemplate } from "./lib/whatsapp";

const CONFIG = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  pollIntervalMs: Number.parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "5000", 10),
  batchSize: Number.parseInt(process.env.WORKER_BATCH_SIZE ?? "10", 10),
  maxRetries: Number.parseInt(process.env.WORKER_MAX_RETRIES ?? "5", 10),
  processingTimeoutSeconds: Number.parseInt(
    process.env.WORKER_PROCESSING_TIMEOUT_SECONDS ?? "300",
    10
  ),
  healthPort: Number.parseInt(process.env.WORKER_HEALTH_PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development"
};

if (!CONFIG.databaseUrl) {
  throw new Error("DATABASE_URL is required for the worker");
}

type OutboxEventStatus = "pending" | "processing" | "delivered" | "failed" | "dead_letter";

type OutboxEvent = {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempt_count: number;
  last_attempted_at: Date | null;
  error_message: string | null;
  created_at: Date;
  processed_at: Date | null;
};

type DispatchResult = {
  success: boolean;
  error?: string;
};

const pool = new Pool({ connectionString: CONFIG.databaseUrl });

async function setTenantContext(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}

async function withTenantClient<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantContext(client, tenantId);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function markStaleProcessing(client: PoolClient) {
  await client.query(
    `UPDATE outbox_events
     SET status = 'dead_letter', error_message = 'processing_timeout'
     WHERE status = 'processing'
       AND attempt_count >= $1
       AND last_attempted_at < NOW() - ($2 * INTERVAL '1 second')`,
    [CONFIG.maxRetries, CONFIG.processingTimeoutSeconds]
  );
}

async function claimBatch(client: PoolClient): Promise<OutboxEvent[]> {
  const result = await client.query<OutboxEvent>(
    `WITH claim AS (
      SELECT id
      FROM outbox_events
      WHERE
        (status IN ('pending', 'failed')
          OR (status = 'processing'
            AND (last_attempted_at IS NULL
              OR last_attempted_at < NOW() - ($3 * INTERVAL '1 second'))))
        AND attempt_count < $1
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events
    SET
      status = 'processing',
      last_attempted_at = NOW(),
      attempt_count = attempt_count + 1
    FROM claim
    WHERE outbox_events.id = claim.id
    RETURNING outbox_events.*;`,
    [CONFIG.maxRetries, CONFIG.batchSize, CONFIG.processingTimeoutSeconds]
  );

  return result.rows;
}

async function markDelivered(client: PoolClient, eventId: string): Promise<void> {
  await client.query(
    `UPDATE outbox_events
     SET status = 'delivered', processed_at = NOW(), error_message = NULL
     WHERE id = $1`,
    [eventId]
  );
}

async function markFailed(
  client: PoolClient,
  eventId: string,
  error: string,
  attemptCount: number
): Promise<void> {
  const nextStatus: OutboxEventStatus =
    attemptCount >= CONFIG.maxRetries ? "dead_letter" : "failed";

  await client.query(
    `UPDATE outbox_events
     SET status = $1, error_message = $2
     WHERE id = $3`,
    [nextStatus, error, eventId]
  );

  if (nextStatus === "dead_letter") {
    console.error(
      `[worker] Event ${eventId} moved to dead_letter after ${attemptCount} attempts. Error: ${error}`
    );
  }
}

async function dispatchWhatsappMessage(event: OutboxEvent): Promise<DispatchResult> {
  const {
    to,
    template,
    member_name,
    amount_paise,
    invoice_number,
    payment_link,
    days_until_expiry
  } = event.payload as {
    to: string;
    template: string;
    member_name?: string;
    amount_paise?: number;
    invoice_number?: string;
    payment_link?: string;
    days_until_expiry?: number | string;
  };

  if (!to || !template) {
    return { success: false, error: "missing required fields: to, template" };
  }

  try {
    const result = await sendWhatsAppTemplate({
      to,
      template_name: template,
      language_code: "en",
      components: buildComponents(template, {
        member_name,
        amount_paise,
        invoice_number,
        payment_link,
        days_until_expiry
      })
    });

    // Log to usage ledger for cost tracking
    await logWhatsAppUsage(event.tenant_id, event.id, result.message_id);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function dispatchMembershipExpiryReminder(
  event: OutboxEvent
): Promise<DispatchResult> {
  const { member_phone, member_name, days_until_expiry, payment_link } = event.payload as {
    member_phone: string;
    member_name?: string;
    days_until_expiry?: number | string;
    payment_link?: string | null;
  };

  if (!member_phone) {
    return { success: false, error: "missing required fields: member_phone" };
  }

  try {
    const result = await sendWhatsAppTemplate({
      to: member_phone,
      template_name: "membership_renewal_reminder",
      language_code: "en",
      components: buildComponents("membership_renewal_reminder", {
        member_name,
        days_until_expiry,
        payment_link
      })
    });

    await logWhatsAppUsage(event.tenant_id, event.id, result.message_id);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function buildComponents(template: string, data: Record<string, unknown>): object[] {
  switch (template) {
    case "payment_receipt":
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(data.member_name ?? "Member") },
            { type: "text", text: formatPaise(Number(data.amount_paise ?? 0)) },
            { type: "text", text: String(data.invoice_number ?? "") }
          ]
        }
      ];
    case "membership_renewal_reminder":
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(data.member_name ?? "Member") },
            { type: "text", text: String(data.days_until_expiry ?? "7") },
            { type: "text", text: String(data.payment_link ?? "") }
          ]
        }
      ];
    default:
      return [];
  }
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

async function logWhatsAppUsage(
  tenant_id: string,
  event_id: string,
  message_id: string
): Promise<void> {
  await withTenantClient(tenant_id, async (client) => {
    await client.query(
      `INSERT INTO usage_ledger
        (tenant_id, event_type, quantity, unit, amount_paise, currency, source, metadata)
       VALUES ($1, 'whatsapp_business_initiated', 1, 'message', 0, 'INR', 'worker', $2)`,
      [tenant_id, JSON.stringify({ event_id, message_id })]
    );
  });
}

async function dispatchPaymentWebhook(event: OutboxEvent): Promise<DispatchResult> {
  console.log(`[dispatcher:payment] Event ${event.id} tenant ${event.tenant_id}`);
  return { success: true };
}

async function dispatchBiometricSync(event: OutboxEvent): Promise<DispatchResult> {
  console.log(`[dispatcher:biometric] Event ${event.id} tenant ${event.tenant_id}`);
  return { success: true };
}

async function dispatchUsageLedgerAggregation(event: OutboxEvent): Promise<DispatchResult> {
  await withTenantClient(event.tenant_id, async (_client) => {
    // TODO: aggregate usage_ledger rows and write billing summaries.
  });
  return { success: true };
}

async function runRenewalNudgeJob(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      id: string;
      tenant_id: string;
      end_date: string;
      member_phone: string | null;
      member_name: string | null;
      days_until_expiry: number;
    }>(`
      SELECT m.id,
             m.tenant_id,
             m.end_date,
             mem.phone AS member_phone,
             CONCAT_WS(' ', mem.first_name, mem.last_name) AS member_name,
             (m.end_date - CURRENT_DATE) AS days_until_expiry
      FROM memberships m
      JOIN members mem ON mem.id = m.member_id
      WHERE m.status = 'active'
        AND m.end_date IN (CURRENT_DATE + 7, CURRENT_DATE + 3, CURRENT_DATE + 1)
        AND NOT EXISTS (
          SELECT 1 FROM outbox_events o
          WHERE o.event_type = 'membership.expiry.reminder'
            AND o.payload->>'membership_id' = m.id::text
            AND DATE(o.created_at) = CURRENT_DATE
        )
    `);

    let queuedCount = 0;

    for (const row of result.rows) {
      if (!row.member_phone) {
        continue;
      }

      const daysUntil = Number(row.days_until_expiry);

      await client.query(
        `INSERT INTO outbox_events (tenant_id, event_type, payload)
         VALUES ($1, 'membership.expiry.reminder', $2)`,
        [
          row.tenant_id,
          JSON.stringify({
            membership_id: row.id,
            member_phone: row.member_phone,
            member_name: row.member_name ?? "Member",
            days_until_expiry: Number.isFinite(daysUntil) ? daysUntil : null,
            payment_link: null
          })
        ]
      );

      queuedCount += 1;
    }

    if (queuedCount > 0) {
      console.log(`[renewal-nudge] Queued ${queuedCount} reminder(s)`);
    }
  } finally {
    client.release();
  }
}

const DISPATCHERS: Record<string, (event: OutboxEvent) => Promise<DispatchResult>> = {
  "whatsapp.message.send": dispatchWhatsappMessage,
  "whatsapp.renewal_nudge.send": dispatchWhatsappMessage,
  "whatsapp.payment_receipt.send": dispatchWhatsappMessage,
  "membership.expiry.reminder": dispatchMembershipExpiryReminder,
  "payment.webhook.received": dispatchPaymentWebhook,
  "payment.reconciliation.run": dispatchPaymentWebhook,
  "biometric.member.sync": dispatchBiometricSync,
  "biometric.member.revoke": dispatchBiometricSync,
  "usage.ledger.aggregate": dispatchUsageLedgerAggregation
};

async function dispatch(event: OutboxEvent): Promise<DispatchResult> {
  const handler = DISPATCHERS[event.event_type];
  if (!handler) {
    return {
      success: false,
      error: `No dispatcher registered for event_type '${event.event_type}'`
    };
  }

  return handler(event);
}

async function processBatch(): Promise<void> {
  const client = await pool.connect();
  let events: OutboxEvent[] = [];

  try {
    await client.query("BEGIN");
    await markStaleProcessing(client);
    events = await claimBatch(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (events.length === 0) {
    return;
  }

  console.log(`[worker] Claimed ${events.length} event(s)`);

  for (const event of events) {
    const statusClient = await pool.connect();
    try {
      const result = await dispatch(event);

      await statusClient.query("BEGIN");

      if (result.success) {
        await markDelivered(statusClient, event.id);
        console.log(`[worker] Delivered event ${event.id} (${event.event_type})`);
      } else {
        await markFailed(
          statusClient,
          event.id,
          result.error ?? "dispatch returned failure",
          event.attempt_count
        );
      }

      await statusClient.query("COMMIT");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] Unhandled error dispatching event ${event.id}: ${message}`);
      await statusClient.query("ROLLBACK");
      await statusClient.query("BEGIN");
      await markFailed(statusClient, event.id, message, event.attempt_count);
      await statusClient.query("COMMIT");
    } finally {
      statusClient.release();
    }
  }
}

function startHealthServer(): void {
  const server = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          worker: "outbox-drain",
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(CONFIG.healthPort, () => {
    console.log(`[worker] Health endpoint listening on port ${CONFIG.healthPort}`);
  });
}

let running = true;

function shutdown(signal: string): void {
  console.log(`[worker] Received ${signal} - shutting down`);
  running = false;
  pool.end().then(() => {
    console.log("[worker] Database pool closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function run(): Promise<void> {
  console.log(`[worker] Starting (env: ${CONFIG.nodeEnv})`);
  console.log(
    `[worker] Poll interval: ${CONFIG.pollIntervalMs}ms | Batch size: ${CONFIG.batchSize} | Max retries: ${CONFIG.maxRetries}`
  );

  startHealthServer();

  let lastNudgeRun = 0;

  while (running) {
    try {
      await processBatch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] Poll cycle error: ${message}`);
    }

    if (Date.now() - lastNudgeRun > 3600000) {
      try {
        await runRenewalNudgeJob();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[renewal-nudge] Job error: ${message}`);
      }
      lastNudgeRun = Date.now();
    }

    await new Promise((resolve) => setTimeout(resolve, CONFIG.pollIntervalMs));
  }
}

run().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});


