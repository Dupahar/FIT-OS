import "dotenv/config";
import { Client } from "pg";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const TENANT_ID = process.env.TENANT_ID ?? "11111111-1111-1111-1111-111111111111";
const TENANT_HEADER = process.env.TENANT_HEADER ?? "x-tenant-id";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const TIMEOUT_MS = Number.parseInt(process.env.OUTBOX_E2E_TIMEOUT_MS ?? "10000", 10);
const POLL_INTERVAL_MS = Number.parseInt(process.env.OUTBOX_E2E_POLL_MS ?? "500", 10);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the outbox e2e test");
}

const emitUrl = `${API_BASE_URL}/v1/outbox-events/emit`;

const payload = {
  event_type: "whatsapp.message.send",
  payload: {
    to: "+910000000000",
    template: "renewal_nudge",
    test: true
  }
};

async function emitEvent() {
  const response = await fetch(emitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TENANT_HEADER]: TENANT_ID
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Emit failed (${response.status}): ${text}`);
  }

  const parsed = JSON.parse(text);
  const eventId = parsed?.data?.id;
  if (!eventId) {
    throw new Error("Emit response missing data.id");
  }

  return String(eventId);
}

async function pollForDelivery(client, eventId) {
  const start = Date.now();

  while (Date.now() - start < TIMEOUT_MS) {
    const result = await client.query(
      "SELECT status, attempt_count, error_message FROM outbox_events WHERE id = $1",
      [eventId]
    );

    const row = result.rows[0];
    if (row) {
      if (row.status === "delivered") {
        return row;
      }

      if (row.status === "dead_letter") {
        throw new Error(`Event ${eventId} dead_lettered: ${row.error_message ?? "unknown"}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out after ${TIMEOUT_MS}ms waiting for delivery of ${eventId}`);
}

async function run() {
  const eventId = await emitEvent();
  console.log(`[outbox-e2e] Emitted event ${eventId}`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_ID]);

  try {
    const row = await pollForDelivery(client, eventId);
    console.log(`[outbox-e2e] Delivered event ${eventId} after ${row.attempt_count} attempt(s)`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(`[outbox-e2e] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
