import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { withTenant } from "../../db/index";
import { config } from "../../config";
import { hashPassword } from "../../lib/password";
import { calculateGst } from "../../lib/gst";
import { getNextInvoiceNumber } from "../../lib/invoice-number";
// These routes sit above the authContext middleware in app.ts
// so they must NOT be mounted under the protected v1Router.
// Double-check: /v1/auth/login should NOT require a Bearer token.

type Role = "owner" | "staff" | "trainer";

type ResourceSpec = {
  name: string;
  table: string;
  orderBy: string;
  select: readonly string[];
  createSchema: z.ZodTypeAny;
  readRoles?: Role[];
  writeRoles?: Role[];
};

type AnyRow = Record<string, unknown>;

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestampString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ offset: false }));
const jsonRecord = z.record(z.unknown());
const membershipStatus = z.enum(["active", "frozen", "cancelled"]);
const invoiceStatus = z.enum(["pending", "void", "paid"]);
const planStatus = z.enum(["active", "inactive"]);
const userRole = z.enum(["owner", "staff", "trainer"]);
const leadStatus = z.enum(["new", "contacted", "attended", "converted", "lost"]);
const leadSource = z.enum(["call", "frontdesk", "walk_in", "whatsapp", "referral", "other"]);
const leadEventType = z.enum(["call", "follow_up", "visit", "conversion", "note"]);
const inventoryMovementType = z.enum(["in", "out"]);

const memberUpdateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().min(6).optional(),
    email: z.string().email().optional()
  })
  .strict();

const memberCreateSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1).optional(),
    phone: z.string().min(6),
    email: z.string().email().optional(),
    status: z.string().min(1).optional(),
    joined_at: dateString.optional(),
    lead_source: leadSource.optional(),
    lead_staff_id: uuid.optional(),
    lead_notes: z.string().optional()
  })
  .strict()
  .refine((data) => !data.lead_source || !!data.lead_staff_id, {
    message: "lead_staff_required",
    path: ["lead_staff_id"]
  })
  .refine((data) => !data.lead_staff_id || !!data.lead_source, {
    message: "lead_source_required",
    path: ["lead_source"]
  });

const tenantUpdateSchema = z
  .object({
    name: z.string().optional(),
    gstin: z.string().optional(),
    legal_name: z.string().optional(),
    address: z.string().optional(),
    state_code: z.string().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "empty_body" });

const userCreateSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    role: userRole.optional(),
    is_active: z.boolean().optional()
  })
  .strict();

const membershipCreateSchema = z
  .object({
    member_id: uuid,
    plan_id: uuid,
    start_date: dateString,
    end_date: dateString,
    status: membershipStatus.optional()
  })
  .strict();

const membershipUpdateSchema = z
  .object({
    status: membershipStatus.optional(),
    plan_id: uuid.optional(),
    freeze_until: timestampString.optional()
  })
  .refine((data) => Object.keys(data).length > 0, { message: "empty_body" });

const invoiceStatusUpdateSchema = z
  .object({
    status: invoiceStatus
  })
  .strict();

const invoiceCreateSchema = z
  .object({
    member_id: uuid,
    subtotal_paise: z.number().int().nonnegative(),
    issued_at: timestampString.optional(),
    due_at: timestampString.optional(),
    status: invoiceStatus.optional(),
    hsn_code: z.string().min(1).optional()
  })
  .strict();

const paymentCreateSchema = z
  .object({
    invoice_id: uuid.optional(),
    amount_paise: z.number().int().positive(),
    provider: z.enum(["manual", "razorpay"]).default("manual"),
    provider_reference: z.string().optional()
  })
  .strict();

const planUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    price_paise: z.number().int().nonnegative().optional(),
    gst_rate: z.number().nonnegative().optional(),
    status: planStatus.optional()
  })
  .strict();

const leadCreateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().min(6),
    email: z.string().email().optional(),
    source: leadSource,
    assigned_staff_id: uuid.optional(),
    status: leadStatus.optional(),
    attended_at: timestampString.optional(),
    converted_at: timestampString.optional(),
    member_id: uuid.optional(),
    notes: z.string().optional()
  })
  .strict();

const leadUpdateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().min(6).optional(),
    email: z.string().email().optional(),
    source: leadSource.optional(),
    assigned_staff_id: uuid.optional(),
    status: leadStatus.optional(),
    attended_at: timestampString.optional(),
    converted_at: timestampString.optional(),
    member_id: uuid.optional(),
    notes: z.string().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "empty_body" });

const leadEventCreateSchema = z
  .object({
    lead_id: uuid,
    staff_id: uuid.optional(),
    event_type: leadEventType,
    outcome: z.string().optional(),
    duration_seconds: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    metadata: jsonRecord.optional(),
    occurred_at: timestampString.optional()
  })
  .strict();

const inventoryItemCreateSchema = z
  .object({
    name: z.string().min(1),
    sku: z.string().min(1).optional(),
    category: z.string().min(1),
    brand: z.string().min(1).optional(),
    unit_price_paise: z.number().int().nonnegative(),
    unit: z.string().min(1).optional(),
    reorder_level: z.number().int().nonnegative().optional(),
    current_stock: z.number().nonnegative().optional(),
    supplier: z.string().min(1).optional(),
    status: z.string().min(1).optional()
  })
  .strict();

const inventoryItemUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    sku: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    unit_price_paise: z.number().int().nonnegative().optional(),
    unit: z.string().min(1).optional(),
    reorder_level: z.number().int().nonnegative().optional(),
    supplier: z.string().min(1).optional(),
    status: z.string().min(1).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "empty_body" });

const inventoryMovementSchema = z
  .object({
    movement_type: inventoryMovementType,
    quantity: z.number().positive(),
    unit_price_paise: z.number().int().nonnegative().optional(),
    member_id: uuid.optional(),
    reason: z.string().min(1).optional(),
    notes: z.string().optional(),
    occurred_at: timestampString.optional()
  })
  .strict();

const tenantIdSchema = uuid;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  if (parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getTenantId(res: Response) {
  const parsed = tenantIdSchema.safeParse(res.locals.tenantId);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_tenant_id" });
    return null;
  }
  return parsed.data;
}

function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function toDateString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function formatRupees(paise: number) {
  return (paise / 100).toFixed(2);
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type InvoiceExportRow = {
  id: string;
  member_id: string;
  issued_at: string | Date;
  due_at: string | Date | null;
  subtotal_paise: number | string;
  cgst_paise: number | string;
  sgst_paise: number | string;
  igst_paise: number | string;
  total_paise: number | string;
  invoice_number: string | null;
  hsn_code: string | null;
  tenant_name: string;
  legal_name: string | null;
  gstin: string | null;
  address: string | null;
  state_code: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type LeadExportRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string | null;
  attended_at: string | Date | null;
  converted_at: string | Date | null;
  created_at: string | Date | null;
  staff_email: string | null;
};

function buildInvoiceExport(row: InvoiceExportRow) {
  const buyerName =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "Member";
  const hsnCode = row.hsn_code ?? "999311";
  const gstRate = 18;
  const subtotalPaise = toNumber(row.subtotal_paise);
  const cgstPaise = toNumber(row.cgst_paise);
  const sgstPaise = toNumber(row.sgst_paise);
  const igstPaise = toNumber(row.igst_paise);
  const totalPaise = toNumber(row.total_paise);

  return {
    invoice_number: row.invoice_number,
    issued_at: toDateString(row.issued_at),
    due_at: toDateString(row.due_at),
    seller: {
      legal_name: row.legal_name ?? row.tenant_name,
      gstin: row.gstin,
      address: row.address,
      state_code: row.state_code
    },
    buyer: {
      name: buyerName,
      phone: row.phone
    },
    line_items: [
      {
        description: "Membership Services",
        hsn_code: hsnCode,
        quantity: 1,
        unit_price_paise: subtotalPaise,
        gst_rate: gstRate,
        cgst_paise: cgstPaise,
        sgst_paise: sgstPaise,
        igst_paise: igstPaise,
        total_paise: totalPaise
      }
    ],
    subtotal_paise: subtotalPaise,
    cgst_paise: cgstPaise,
    sgst_paise: sgstPaise,
    igst_paise: igstPaise,
    total_paise: totalPaise
  };
}

function escapeCsv(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function fetchInvoiceExportRow(tenantId: string, invoiceId: string) {
  return withTenant(tenantId, async (client) => {
    const result = await client.query<InvoiceExportRow>(
      `SELECT invoices.id,
              invoices.member_id,
              invoices.issued_at,
              invoices.due_at,
              invoices.subtotal_paise,
              invoices.cgst_paise,
              invoices.sgst_paise,
              invoices.igst_paise,
              invoices.total_paise,
              invoices.invoice_number,
              invoices.hsn_code,
              tenants.name AS tenant_name,
              tenants.legal_name,
              tenants.gstin,
              tenants.address,
              tenants.state_code,
              members.first_name,
              members.last_name,
              members.phone
       FROM invoices
       JOIN tenants ON tenants.id = invoices.tenant_id
       JOIN members ON members.id = invoices.member_id
       WHERE invoices.id = $1
       LIMIT 1`,
      [invoiceId]
    );

    return result.rows[0] ?? null;
  });
}

async function fetchInvoiceExportRows(tenantId: string) {
  return withTenant(tenantId, async (client) => {
    const result = await client.query<InvoiceExportRow>(
      `SELECT invoices.id,
              invoices.member_id,
              invoices.issued_at,
              invoices.due_at,
              invoices.subtotal_paise,
              invoices.cgst_paise,
              invoices.sgst_paise,
              invoices.igst_paise,
              invoices.total_paise,
              invoices.invoice_number,
              invoices.hsn_code,
              tenants.name AS tenant_name,
              tenants.legal_name,
              tenants.gstin,
              tenants.address,
              tenants.state_code,
              members.first_name,
              members.last_name,
              members.phone
       FROM invoices
       JOIN tenants ON tenants.id = invoices.tenant_id
       JOIN members ON members.id = invoices.member_id
       WHERE invoices.tenant_id = $1
       ORDER BY invoices.issued_at DESC`,
      [tenantId]
    );

    return result.rows;
  });
}

async function fetchLeadExportRows(tenantId: string) {
  return withTenant(tenantId, async (client) => {
    const result = await client.query<LeadExportRow>(
      `SELECT leads.id,
              leads.first_name,
              leads.last_name,
              leads.phone,
              leads.email,
              leads.source,
              leads.status,
              leads.attended_at,
              leads.converted_at,
              leads.created_at,
              users.email AS staff_email
       FROM leads
       LEFT JOIN users ON users.id = leads.assigned_staff_id
       WHERE leads.tenant_id = $1
       ORDER BY leads.created_at DESC`,
      [tenantId]
    );

    return result.rows;
  });
}


const membersSelectSql = [
  "id",
  "tenant_id",
  "first_name",
  "last_name",
  "phone",
  "email",
  "status",
  "joined_at",
  "created_at"
]
  .map(quoteIdent)
  .join(", ");

const usersSelect = ["id", "tenant_id", "email", "role", "is_active", "created_at"];
const usersSelectSql = usersSelect.map(quoteIdent).join(", ");

const membershipsSelect = [
  "id",
  "tenant_id",
  "member_id",
  "plan_id",
  "start_date",
  "end_date",
  "status",
  "freeze_until",
  "created_at"
];
const membershipsSelectSql = membershipsSelect.map(quoteIdent).join(", ");

const invoicesSelect = [
  "id",
  "tenant_id",
  "member_id",
  "status",
  "subtotal_paise",
  "gst_paise",
  "cgst_paise",
  "sgst_paise",
  "igst_paise",
  "total_paise",
  "invoice_number",
  "hsn_code",
  "issued_at",
  "due_at",
  "razorpay_order_id"
];
const invoicesSelectSql = invoicesSelect.map(quoteIdent).join(", ");

const paymentsSelect = [
  "id",
  "tenant_id",
  "invoice_id",
  "provider",
  "provider_reference",
  "amount_paise",
  "currency",
  "status",
  "paid_at",
  "created_at"
];
const paymentsSelectSql = paymentsSelect.map(quoteIdent).join(", ");

const plansSelectSql = [
  "id",
  "tenant_id",
  "name",
  "price_paise",
  "billing_interval",
  "gst_rate",
  "status",
  "created_at"
]
  .map(quoteIdent)
  .join(", ");

const devicesSelectSql = [
  "id",
  "tenant_id",
  "name",
  "device_type",
  "serial_number",
  "status",
  "last_seen_at",
  "created_at"
]
  .map(quoteIdent)
  .join(", ");

const leadsSelect = [
  "id",
  "tenant_id",
  "first_name",
  "last_name",
  "phone",
  "email",
  "source",
  "assigned_staff_id",
  "status",
  "attended_at",
  "converted_at",
  "member_id",
  "notes",
  "created_at"
];
const leadsSelectSql = leadsSelect.map(quoteIdent).join(", ");

const leadEventsSelect = [
  "id",
  "tenant_id",
  "lead_id",
  "staff_id",
  "event_type",
  "outcome",
  "duration_seconds",
  "notes",
  "metadata",
  "occurred_at"
];
const leadEventsSelectSql = leadEventsSelect.map(quoteIdent).join(", ");

const inventoryItemsSelect = [
  "id",
  "tenant_id",
  "name",
  "sku",
  "category",
  "brand",
  "unit_price_paise",
  "unit",
  "reorder_level",
  "current_stock",
  "supplier",
  "status",
  "created_at"
];
const inventoryItemsSelectSql = inventoryItemsSelect.map(quoteIdent).join(", ");

const inventoryMovementsSelect = [
  "id",
  "tenant_id",
  "item_id",
  "movement_type",
  "quantity",
  "unit_price_paise",
  "total_paise",
  "reason",
  "actor_user_id",
  "member_id",
  "invoice_id",
  "notes",
  "created_at"
];
const inventoryMovementsSelectSql = inventoryMovementsSelect.map(quoteIdent).join(", ");

type ReadOnlySpec = Omit<ResourceSpec, "createSchema" | "writeRoles">;

const OWNER_ONLY: Role[] = ["owner"];
const STAFF_ACCESS: Role[] = ["owner", "staff"];
const TRAINER_READ: Role[] = ["owner", "staff", "trainer"];

function requireRole(res: Response, roles?: Role[]) {
  if (!roles || roles.length === 0) {
    return true;
  }
  const role = res.locals.role as Role | undefined;
  if (!role || !roles.includes(role)) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

function registerReadOnlyResource(router: Router, spec: ReadOnlySpec) {
  const selectSql = spec.select.map(quoteIdent).join(", ");
  const tableSql = quoteIdent(spec.table);
  const orderSql = spec.orderBy ? ` ORDER BY ${quoteIdent(spec.orderBy)} DESC` : "";

  router.get(
    `/${spec.name}`,
    asyncHandler(async (req, res) => {
      if (!requireRole(res, spec.readRoles)) {
        return;
      }
      const tenantId = getTenantId(res);
      if (!tenantId) {
        return;
      }

      const limit = parseLimit(req.query.limit);
      const result = await withTenant(tenantId, (client) =>
        client.query<AnyRow>(
          `SELECT ${selectSql} FROM ${tableSql}${orderSql} LIMIT $1`,
          [limit]
        )
      );

      res.json({ data: result.rows });
    })
  );

  router.get(
    `/${spec.name}/:id`,
    asyncHandler(async (req, res) => {
      if (!requireRole(res, spec.readRoles)) {
        return;
      }
      const tenantId = getTenantId(res);
      if (!tenantId) {
        return;
      }

      const id = uuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const result = await withTenant(tenantId, (client) =>
        client.query<AnyRow>(`SELECT ${selectSql} FROM ${tableSql} WHERE id = $1`, [id.data])
      );

      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json({ data: row });
    })
  );
}

function registerResource(router: Router, spec: ResourceSpec) {
  registerReadOnlyResource(router, spec);
  const selectSql = spec.select.map(quoteIdent).join(", ");
  const tableSql = quoteIdent(spec.table);

  router.post(
    `/${spec.name}`,
    asyncHandler(async (req, res) => {
      if (!requireRole(res, spec.writeRoles ?? spec.readRoles)) {
        return;
      }
      const tenantId = getTenantId(res);
      if (!tenantId) {
        return;
      }

      const payload = parseBody(res, spec.createSchema, req.body) as
        | Record<string, unknown>
        | null;
      if (!payload) {
        return;
      }

      const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
      if (entries.length === 0) {
        res.status(400).json({ error: "empty_body" });
        return;
      }

      const columns = ["tenant_id", ...entries.map(([key]) => key)];
      const values = [tenantId, ...entries.map(([, value]) => value)];
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      const columnsSql = columns.map(quoteIdent).join(", ");

      const result = await withTenant(tenantId, (client) =>
        client.query<AnyRow>(
          `INSERT INTO ${tableSql} (${columnsSql}) VALUES (${placeholders}) RETURNING ${selectSql}`,
          values
        )
      );

      res.status(201).json({ data: result.rows[0] });
    })
  );
}

const resources: ResourceSpec[] = [
  {
    name: "plans",
    table: "plans",
    orderBy: "created_at",
    select: [
      "id",
      "tenant_id",
      "name",
      "price_paise",
      "billing_interval",
      "gst_rate",
      "status",
      "created_at"
    ],
    createSchema: z
      .object({
        name: z.string().min(1),
        price_paise: z.number().int().positive(),
        billing_interval: z.enum(["monthly", "quarterly", "semiannual", "annual", "custom"]),
        gst_rate: z.coerce.number().default(18)
      })
      .strict(),
    readRoles: STAFF_ACCESS,
    writeRoles: OWNER_ONLY
  },
  {
    name: "invoice-items",
    table: "invoice_items",
    orderBy: "id",
    select: [
      "id",
      "tenant_id",
      "invoice_id",
      "description",
      "quantity",
      "unit_price_paise",
      "total_paise",
      "tax_rate"
    ],
    createSchema: z
      .object({
        invoice_id: uuid,
        description: z.string().min(1),
        quantity: z.number().positive().optional(),
        unit_price_paise: z.number().int().nonnegative(),
        total_paise: z.number().int().nonnegative(),
        tax_rate: z.number().nonnegative().optional()
      })
      .strict(),
    readRoles: STAFF_ACCESS,
    writeRoles: STAFF_ACCESS
  },
  {
    name: "devices",
    table: "devices",
    orderBy: "created_at",
    select: [
      "id",
      "tenant_id",
      "name",
      "device_type",
      "serial_number",
      "status",
      "last_seen_at",
      "created_at"
    ],
    createSchema: z
      .object({
        name: z.string().min(1),
        device_type: z.string().min(1),
        serial_number: z.string().optional(),
        vendor: z.string().optional()
      })
      .strict(),
    readRoles: STAFF_ACCESS,
    writeRoles: STAFF_ACCESS
  },
  {
    name: "attendance-events",
    table: "attendance_events",
    orderBy: "event_time",
    select: [
      "id",
      "tenant_id",
      "device_id",
      "member_id",
      "event_time",
      "source",
      "raw_payload",
      "created_at"
    ],
    createSchema: z
      .object({
        device_id: uuid.optional(),
        member_id: uuid.optional(),
        event_time: timestampString,
        source: z.string().min(1),
        raw_payload: jsonRecord.optional()
      })
      .strict(),
    readRoles: TRAINER_READ,
    writeRoles: STAFF_ACCESS
  },
  {
    name: "usage-ledger",
    table: "usage_ledger",
    orderBy: "occurred_at",
    select: [
      "id",
      "tenant_id",
      "event_type",
      "quantity",
      "unit",
      "amount_paise",
      "currency",
      "source",
      "metadata",
      "occurred_at"
    ],
    createSchema: z
      .object({
        event_type: z.string().min(1),
        quantity: z.number().positive().optional(),
        unit: z.string().min(1),
        amount_paise: z.number().int().nonnegative().optional(),
        currency: z.string().length(3).optional(),
        source: z.string().min(1),
        metadata: jsonRecord.optional(),
        occurred_at: timestampString.optional()
      })
      .strict(),
    readRoles: OWNER_ONLY,
    writeRoles: OWNER_ONLY
  },
  {
    name: "outbox-events",
    table: "outbox_events",
    orderBy: "created_at",
    select: [
      "id",
      "tenant_id",
      "event_type",
      "aggregate_type",
      "aggregate_id",
      "payload",
      "status",
      "attempt_count",
      "last_attempted_at",
      "error_message",
      "created_at",
      "processed_at"
    ],
    createSchema: z
      .object({
        event_type: z.string().min(1),
        aggregate_type: z.string().min(1).optional(),
        aggregate_id: uuid.optional(),
        payload: jsonRecord
      })
      .strict(),
    readRoles: STAFF_ACCESS,
    writeRoles: OWNER_ONLY
  },
  {
    name: "leads",
    table: "leads",
    orderBy: "created_at",
    select: leadsSelect,
    createSchema: leadCreateSchema,
    readRoles: STAFF_ACCESS,
    writeRoles: STAFF_ACCESS
  },
  {
    name: "inventory-items",
    table: "inventory_items",
    orderBy: "created_at",
    select: inventoryItemsSelect,
    createSchema: inventoryItemCreateSchema,
    readRoles: STAFF_ACCESS,
    writeRoles: STAFF_ACCESS
  },
  {
    name: "audit-log",
    table: "audit_log",
    orderBy: "created_at",
    select: [
      "id",
      "tenant_id",
      "actor_user_id",
      "action",
      "entity_type",
      "entity_id",
      "metadata",
      "created_at"
    ],
    createSchema: z
      .object({
        actor_user_id: uuid.optional(),
        action: z.string().min(1),
        entity_type: z.string().min(1),
        entity_id: uuid.optional(),
        metadata: jsonRecord.optional()
      })
      .strict(),
    readRoles: OWNER_ONLY,
    writeRoles: OWNER_ONLY
  },
  {
    name: "data-provenance",
    table: "data_provenance",
    orderBy: "imported_at",
    select: [
      "id",
      "tenant_id",
      "entity_type",
      "entity_id",
      "source_system",
      "imported_at",
      "confidence_level"
    ],
    createSchema: z
      .object({
        entity_type: z.string().min(1),
        entity_id: uuid,
        source_system: z.string().min(1),
        confidence_level: z.string().min(1).optional()
      })
      .strict(),
    readRoles: OWNER_ONLY,
    writeRoles: OWNER_ONLY
  }
];

const devOutboxEventTypes = [
  "whatsapp.message.send",
  "whatsapp.renewal_nudge.send",
  "whatsapp.payment_receipt.send",
  "payment.webhook.received",
  "payment.reconciliation.run",
  "biometric.member.sync",
  "biometric.member.revoke",
  "usage.ledger.aggregate"
] as const;

const devOutboxEventSchema = z
  .object({
    event_type: z.enum(devOutboxEventTypes),
    aggregate_type: z.string().min(1).optional(),
    aggregate_id: uuid.optional(),
    payload: jsonRecord
  })
  .strict();
export const v1Router = Router();
// Mutation endpoints (pilot-critical)
v1Router.post(
  "/members",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, memberCreateSchema, req.body) as {
      first_name: string;
      last_name?: string;
      phone: string;
      email?: string;
      status?: string;
      joined_at?: string;
      lead_source?: string;
      lead_staff_id?: string;
      lead_notes?: string;
    } | null;
    if (!payload) {
      return;
    }

    const memberRow = await withTenant(tenantId, async (client) => {
      const memberEntries: [string, unknown][] = [
        ["first_name", payload.first_name],
        ["phone", payload.phone]
      ];

      if (payload.last_name !== undefined) {
        memberEntries.push(["last_name", payload.last_name]);
      }
      if (payload.email !== undefined) {
        memberEntries.push(["email", payload.email]);
      }
      if (payload.status !== undefined) {
        memberEntries.push(["status", payload.status]);
      }
      if (payload.joined_at !== undefined) {
        memberEntries.push(["joined_at", payload.joined_at]);
      }

      const memberColumns = ["tenant_id", ...memberEntries.map(([key]) => key)];
      const memberValues = [tenantId, ...memberEntries.map(([, value]) => value)];
      const memberPlaceholders = memberValues.map((_, index) => `$${index + 1}`).join(", ");
      const memberColumnsSql = memberColumns.map(quoteIdent).join(", ");

      const memberResult = await client.query<AnyRow>(
        `INSERT INTO members (${memberColumnsSql})
         VALUES (${memberPlaceholders})
         RETURNING ${membersSelectSql}`,
        memberValues
      );

      const member = memberResult.rows[0];

      if (payload.lead_source && payload.lead_staff_id) {
        const now = new Date().toISOString();
        const leadSearch = await client.query<{ id: string; attended_at: string | null }>(
          `SELECT id, attended_at
           FROM leads
           WHERE tenant_id = $1 AND phone = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [tenantId, payload.phone]
        );

        let leadId: string;
        if (leadSearch.rowCount && leadSearch.rows[0]) {
          leadId = leadSearch.rows[0].id;
          await client.query(
            `UPDATE leads
             SET status = 'converted',
                 source = $1,
                 assigned_staff_id = $2,
                 member_id = $3,
                 attended_at = COALESCE(attended_at, $4),
                 converted_at = $4,
                 notes = COALESCE(notes, $5)
             WHERE id = $6 AND tenant_id = $7`,
            [
              payload.lead_source,
              payload.lead_staff_id,
              member.id,
              now,
              payload.lead_notes ?? null,
              leadId,
              tenantId
            ]
          );
        } else {
          const leadInsert = await client.query<{ id: string }>(
            `INSERT INTO leads
              (tenant_id, first_name, last_name, phone, email, source, assigned_staff_id, status, attended_at, converted_at, member_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'converted', $8, $8, $9, $10)
             RETURNING id`,
            [
              tenantId,
              payload.first_name,
              payload.last_name ?? null,
              payload.phone,
              payload.email ?? null,
              payload.lead_source,
              payload.lead_staff_id,
              now,
              member.id,
              payload.lead_notes ?? null
            ]
          );
          leadId = leadInsert.rows[0].id;
        }

        await client.query(
          `INSERT INTO lead_events
            (tenant_id, lead_id, staff_id, event_type, outcome, occurred_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            leadId,
            payload.lead_staff_id,
            "conversion",
            "converted",
            now,
            payload.lead_notes ?? null
          ]
        );
      }

      return member;
    });

    res.status(201).json({ data: memberRow });
  })
);

v1Router.patch(
  "/members/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, memberUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), id.data, tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE members SET ${setSql}
         WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2}
         RETURNING ${membersSelectSql}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.patch(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, leadUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), id.data, tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE leads SET ${setSql}
         WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2}
         RETURNING ${leadsSelectSql}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.post(
  "/lead-events",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, leadEventCreateSchema, req.body) as {
      lead_id: string;
      staff_id?: string;
      event_type: "call" | "follow_up" | "visit" | "conversion" | "note";
      outcome?: string;
      duration_seconds?: number;
      notes?: string;
      metadata?: Record<string, unknown>;
      occurred_at?: string;
    } | null;
    if (!payload) {
      return;
    }

    const actorId = uuid.safeParse(res.locals.userId).success ? res.locals.userId : null;
    const staffId = payload.staff_id ?? actorId;
    const occurredAt = payload.occurred_at ?? new Date().toISOString();

    const result = await withTenant(tenantId, async (client) => {
      const leadResult = await client.query<{
        id: string;
        status: string;
        attended_at: string | null;
        converted_at: string | null;
        assigned_staff_id: string | null;
      }>(
        `SELECT id, status, attended_at, converted_at, assigned_staff_id
         FROM leads
         WHERE id = $1 AND tenant_id = $2`,
        [payload.lead_id, tenantId]
      );

      if (leadResult.rowCount === 0) {
        return { outcome: "lead_not_found" as const };
      }

      const lead = leadResult.rows[0];

      const eventResult = await client.query<AnyRow>(
        `INSERT INTO lead_events
          (tenant_id, lead_id, staff_id, event_type, outcome, duration_seconds, notes, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${leadEventsSelectSql}`,
        [
          tenantId,
          payload.lead_id,
          staffId ?? null,
          payload.event_type,
          payload.outcome ?? null,
          payload.duration_seconds ?? null,
          payload.notes ?? null,
          payload.metadata ?? {},
          occurredAt
        ]
      );

      const updates: [string, unknown][] = [];

      if (staffId && !lead.assigned_staff_id) {
        updates.push(["assigned_staff_id", staffId]);
      }

      if (payload.event_type === "visit") {
        if (!lead.attended_at) {
          updates.push(["attended_at", occurredAt]);
        }
        if (lead.status !== "converted") {
          updates.push(["status", "attended"]);
        }
      }

      if (payload.event_type === "conversion") {
        if (!lead.attended_at) {
          updates.push(["attended_at", occurredAt]);
        }
        if (!lead.converted_at) {
          updates.push(["converted_at", occurredAt]);
        }
        updates.push(["status", "converted"]);
      }

      if (payload.event_type === "call" && payload.outcome === "connected" && lead.status === "new") {
        updates.push(["status", "contacted"]);
      }

      if (payload.event_type === "follow_up" && lead.status === "new") {
        updates.push(["status", "contacted"]);
      }

      if (updates.length > 0) {
        const setSql = updates
          .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
          .join(", ");
        const values = [...updates.map(([, value]) => value), payload.lead_id, tenantId];

        await client.query(
          `UPDATE leads SET ${setSql}
           WHERE id = $${updates.length + 1} AND tenant_id = $${updates.length + 2}`,
          values
        );
      }

      return { outcome: "ok" as const, event: eventResult.rows[0] };
    });

    if (result.outcome === "lead_not_found") {
      res.status(404).json({ error: "lead_not_found" });
      return;
    }

    res.status(201).json({ data: result.event });
  })
);

v1Router.get(
  "/leads/export",
  asyncHandler(async (_req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const rows = await fetchLeadExportRows(tenantId);
    const header = [
      "Lead Name",
      "Phone",
      "Email",
      "Source",
      "Status",
      "Owner",
      "Attended At",
      "Converted At",
      "Created At"
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ") || "Lead";
      const line = [
        name,
        row.phone ?? "",
        row.email ?? "",
        row.source ?? "",
        row.status ?? "",
        row.staff_email ?? "",
        toDateString(row.attended_at) ?? "",
        toDateString(row.converted_at) ?? "",
        toDateString(row.created_at) ?? ""
      ].map((value) => escapeCsv(String(value)));
      lines.push(line.join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="leads-export.csv"');
    res.send(lines.join("\n"));
  })
);

v1Router.get(
  "/leads/export/pdf",
  asyncHandler(async (_req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const rows = await fetchLeadExportRows(tenantId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="leads-report.pdf"');

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    doc.fontSize(18).text("Leads Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown();

    const maxRows = Math.min(rows.length, 60);
    for (let i = 0; i < maxRows; i += 1) {
      const row = rows[i];
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ") || "Lead";
      const summary = `${name} | ${row.phone ?? "-"} | ${row.source ?? "-"} | ${
        row.status ?? "-"
      } | ${row.staff_email ?? "-"}`;
      doc.text(summary);
    }

    if (rows.length > maxRows) {
      doc.moveDown();
      doc.text(`+${rows.length - maxRows} more leads not shown.`);
    }

    doc.end();
  })
);

v1Router.patch(
  "/inventory-items/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, inventoryItemUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), id.data, tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE inventory_items SET ${setSql}
         WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2}
         RETURNING ${inventoryItemsSelectSql}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.post(
  "/inventory-items/:id/movements",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, inventoryMovementSchema, req.body) as {
      movement_type: "in" | "out";
      quantity: number;
      unit_price_paise?: number;
      member_id?: string;
      reason?: string;
      notes?: string;
      occurred_at?: string;
    } | null;
    if (!payload) {
      return;
    }

    if (payload.member_id && payload.movement_type !== "out") {
      res.status(400).json({ error: "member_only_for_sales" });
      return;
    }

    if (payload.member_id && payload.unit_price_paise === undefined) {
      res.status(400).json({ error: "unit_price_required" });
      return;
    }

    const actorId = uuid.safeParse(res.locals.userId).success ? res.locals.userId : null;
    const occurredAt = payload.occurred_at ?? new Date().toISOString();

    const result = await withTenant(tenantId, async (client) => {
      const itemResult = await client.query<{ current_stock: number | string; name: string; category: string }>(
        `SELECT current_stock, name, category
         FROM inventory_items
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [id.data, tenantId]
      );

      if (itemResult.rowCount === 0) {
        return { outcome: "not_found" as const };
      }

      const currentStock = toNumber(itemResult.rows[0].current_stock);
      const delta = payload.movement_type === "in" ? payload.quantity : -payload.quantity;
      const nextStock = currentStock + delta;

      if (nextStock < 0) {
        return { outcome: "insufficient_stock" as const };
      }

      await client.query(
        `UPDATE inventory_items
         SET current_stock = $1
         WHERE id = $2 AND tenant_id = $3`,
        [nextStock, id.data, tenantId]
      );

      const totalPaise =
        payload.unit_price_paise !== undefined
          ? Math.round(payload.unit_price_paise * payload.quantity)
          : null;

      let invoiceId: string | null = null;
      if (payload.member_id) {
        const gstRate = 18;
        const isIntraState = true;
        const subtotalPaise = totalPaise ?? 0;
        const gst = calculateGst(subtotalPaise, gstRate, isIntraState);
        const gstPaise = gst.cgst_paise + gst.sgst_paise + gst.igst_paise;
        const invoiceNumber = await getNextInvoiceNumber(client, tenantId);

        const invoiceResult = await client.query<{ id: string }>(
          `INSERT INTO invoices
            (tenant_id, member_id, status, subtotal_paise, gst_paise, cgst_paise, sgst_paise, igst_paise, total_paise, issued_at, due_at, invoice_number)
           VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            tenantId,
            payload.member_id,
            gst.subtotal_paise,
            gstPaise,
            gst.cgst_paise,
            gst.sgst_paise,
            gst.igst_paise,
            gst.total_paise,
            occurredAt,
            null,
            invoiceNumber
          ]
        );

        invoiceId = invoiceResult.rows[0].id;
        const description = itemResult.rows[0]
          ? `${itemResult.rows[0].name} (${itemResult.rows[0].category})`
          : "Inventory Sale";

        await client.query(
          `INSERT INTO invoice_items
            (tenant_id, invoice_id, description, quantity, unit_price_paise, total_paise, tax_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            invoiceId,
            description,
            payload.quantity,
            payload.unit_price_paise ?? 0,
            totalPaise ?? 0,
            gstRate
          ]
        );
      }

      const movementResult = await client.query<AnyRow>(
        `INSERT INTO inventory_movements
          (tenant_id, item_id, movement_type, quantity, unit_price_paise, total_paise, reason, actor_user_id, member_id, invoice_id, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING ${inventoryMovementsSelectSql}`,
        [
          tenantId,
          id.data,
          payload.movement_type,
          payload.quantity,
          payload.unit_price_paise ?? null,
          totalPaise,
          payload.reason ?? null,
          actorId,
          payload.member_id ?? null,
          invoiceId,
          payload.notes ?? null,
          occurredAt
        ]
      );

      return { outcome: "ok" as const, movement: movementResult.rows[0] };
    });

    if (result.outcome === "not_found") {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (result.outcome === "insufficient_stock") {
      res.status(400).json({ error: "insufficient_stock" });
      return;
    }

    res.status(201).json({ data: result.movement });
  })
);

v1Router.post(
  "/users",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, userCreateSchema, req.body) as
      | { email: string; password: string; role?: string; is_active?: boolean }
      | null;
    if (!payload) {
      return;
    }

    const { password, ...rest } = payload;
    const passwordHash = await hashPassword(password);

    const entries: [string, unknown][] = [
      ["email", rest.email],
      ["password_hash", passwordHash]
    ];

    if (rest.role !== undefined) {
      entries.push(["role", rest.role]);
    }

    if (rest.is_active !== undefined) {
      entries.push(["is_active", rest.is_active]);
    }

    const columns = ["tenant_id", ...entries.map(([key]) => key)];
    const values = [tenantId, ...entries.map(([, value]) => value)];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const columnsSql = columns.map(quoteIdent).join(", ");

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `INSERT INTO users (${columnsSql}) VALUES (${placeholders}) RETURNING ${usersSelectSql}`,
        values
      )
    );

    res.status(201).json({ data: result.rows[0] });
  })
);

v1Router.post(
  "/memberships",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, membershipCreateSchema, req.body) as
      | Record<string, unknown>
      | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const columns = ["tenant_id", ...entries.map(([key]) => key)];
    const values = [tenantId, ...entries.map(([, value]) => value)];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const columnsSql = columns.map(quoteIdent).join(", ");

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `INSERT INTO memberships (${columnsSql}) VALUES (${placeholders})
         RETURNING ${membershipsSelectSql}`,
        values
      )
    );

    res.status(201).json({ data: result.rows[0] });
  })
);

v1Router.patch(
  "/memberships/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, membershipUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), id.data, tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE memberships SET ${setSql}
         WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2}
         RETURNING ${membershipsSelectSql}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.post(
  "/invoices",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, invoiceCreateSchema, req.body) as {
      member_id: string;
      subtotal_paise: number;
      issued_at?: string;
      due_at?: string;
      status?: string;
      hsn_code?: string;
    } | null;
    if (!payload) {
      return;
    }

    const gstRate = 18;
    const isIntraState = true;
    const gst = calculateGst(payload.subtotal_paise, gstRate, isIntraState);
    const issuedAt = payload.issued_at ?? new Date().toISOString();
    const dueAt = payload.due_at ?? null;
    const status = payload.status ?? "pending";
    const hsnCode = payload.hsn_code ?? "999311";

    const invoiceRow = await withTenant(tenantId, async (client) => {
      const invoiceNumber = await getNextInvoiceNumber(client, tenantId);
      const gstPaise = gst.cgst_paise + gst.sgst_paise + gst.igst_paise;

      const result = await client.query<AnyRow>(
        `INSERT INTO invoices
          (tenant_id, member_id, status, subtotal_paise, gst_paise, cgst_paise, sgst_paise, igst_paise, total_paise, issued_at, due_at, invoice_number, hsn_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING ${invoicesSelectSql}`,
        [
          tenantId,
          payload.member_id,
          status,
          gst.subtotal_paise,
          gstPaise,
          gst.cgst_paise,
          gst.sgst_paise,
          gst.igst_paise,
          gst.total_paise,
          issuedAt,
          dueAt,
          invoiceNumber,
          hsnCode
        ]
      );

      return result.rows[0];
    });

    res.status(201).json({ data: invoiceRow });
  })
);

v1Router.patch(
  "/invoices/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, invoiceStatusUpdateSchema, req.body) as { status: string } | null;
    if (!payload) {
      return;
    }

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE invoices SET status = $1
         WHERE id = $2 AND tenant_id = $3
         RETURNING ${invoicesSelectSql}`,
        [payload.status, id.data, tenantId]
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.get(
  "/invoices/export",
  asyncHandler(async (_req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const rows = await fetchInvoiceExportRows(tenantId);

    const header = [
      "Invoice No",
      "Issued At",
      "Due At",
      "Member Name",
      "Member Phone",
      "Subtotal",
      "CGST",
      "SGST",
      "IGST",
      "Total",
      "GSTIN",
      "State Code",
      "HSN Code"
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
      const exportData = buildInvoiceExport(row);
      const invoiceNo = exportData.invoice_number ?? row.id;
      const buyerName = exportData.buyer.name ?? "Member";
      const issuedAt = exportData.issued_at ?? "-";
      const dueAt = exportData.due_at ?? "-";
      const line = [
        invoiceNo,
        issuedAt,
        dueAt,
        buyerName,
        exportData.buyer.phone ?? "",
        formatRupees(exportData.subtotal_paise),
        formatRupees(exportData.cgst_paise),
        formatRupees(exportData.sgst_paise),
        formatRupees(exportData.igst_paise),
        formatRupees(exportData.total_paise),
        exportData.seller.gstin ?? "",
        exportData.seller.state_code ?? "",
        exportData.line_items[0]?.hsn_code ?? ""
      ].map((value) => escapeCsv(String(value)));

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="tally-export.csv"');
    res.send(csv);
  })
);

v1Router.get(
  "/invoices/:id/export",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const row = await fetchInvoiceExportRow(tenantId, id.data);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const exportData = buildInvoiceExport(row);
    res.json(exportData);
  })
);

v1Router.get(
  "/invoices/:id/pdf",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const row = await fetchInvoiceExportRow(tenantId, id.data);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const exportData = buildInvoiceExport(row);
    const invoiceNumber = exportData.invoice_number ?? row.id;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoiceNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    doc.fontSize(18).text("Tax Invoice", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice No: ${invoiceNumber}`);
    doc.text(`Issued At: ${exportData.issued_at ?? "-"}`);
    doc.text(`Due At: ${exportData.due_at ?? "-"}`);
    doc.moveDown();

    doc.fontSize(12).text("Seller", { underline: true });
    doc.text(exportData.seller.legal_name ?? "-");
    doc.text(`GSTIN: ${exportData.seller.gstin ?? "-"}`);
    doc.text(`Address: ${exportData.seller.address ?? "-"}`);
    doc.text(`State Code: ${exportData.seller.state_code ?? "-"}`);
    doc.moveDown();

    doc.text("Buyer", { underline: true });
    doc.text(exportData.buyer.name ?? "-");
    doc.text(`Phone: ${exportData.buyer.phone ?? "-"}`);
    doc.moveDown();

    doc.text("Line Items", { underline: true });
    exportData.line_items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.description}`);
      doc.text(`HSN: ${item.hsn_code}`);
      doc.text(
        `Qty: ${item.quantity}  Unit: INR ${formatRupees(item.unit_price_paise)}  GST: ${item.gst_rate}%`
      );
      doc.text(
        `CGST: INR ${formatRupees(item.cgst_paise)}  SGST: INR ${formatRupees(
          item.sgst_paise
        )}  IGST: INR ${formatRupees(item.igst_paise)}`
      );
      doc.text(`Line Total: INR ${formatRupees(item.total_paise)}`);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.text(`Subtotal: INR ${formatRupees(exportData.subtotal_paise)}`);
    doc.text(`CGST: INR ${formatRupees(exportData.cgst_paise)}`);
    doc.text(`SGST: INR ${formatRupees(exportData.sgst_paise)}`);
    doc.text(`IGST: INR ${formatRupees(exportData.igst_paise)}`);
    doc.fontSize(14).text(`Total: INR ${formatRupees(exportData.total_paise)}`);

    doc.end();
  })
);

v1Router.post(
  "/payments",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

      const payload = parseBody(res, paymentCreateSchema, req.body) as {
        invoice_id?: string;
        amount_paise: number;
        provider: "manual" | "razorpay";
        provider_reference?: string;
      } | null;
      if (!payload) {
        return;
      }

      const paidAt = new Date().toISOString();
      const currency = "INR";
      const invoiceId = payload.invoice_id;
      const provider = payload.provider;

    const result = await withTenant(tenantId, async (client) => {
      let memberInfo: {
        member_id: string;
        invoice_number: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
      } | null = null;

      if (invoiceId) {
        const invoiceResult = await client.query<{
          member_id: string;
          invoice_number: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
        }>(
          `UPDATE invoices
           SET status = 'paid'
           FROM members
           WHERE invoices.id = $1
             AND invoices.tenant_id = $2
             AND members.id = invoices.member_id
           RETURNING invoices.member_id,
                     invoices.invoice_number,
                     members.first_name,
                     members.last_name,
                     members.phone`,
          [invoiceId, tenantId]
        );

        if (invoiceResult.rowCount === 0) {
          return { outcome: "invoice_not_found" as const };
        }

        memberInfo = invoiceResult.rows[0];
      }

      const paymentResult = await client.query<AnyRow>(
        `INSERT INTO payments
          (tenant_id, invoice_id, provider, provider_reference, amount_paise, currency, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${paymentsSelectSql}`,
        [
          tenantId,
          invoiceId ?? null,
          provider,
          payload.provider_reference ?? null,
          payload.amount_paise,
          currency,
          "paid",
          paidAt
        ]
      );

      const payment = paymentResult.rows[0];

      if (invoiceId && memberInfo) {
        const memberName =
          [memberInfo.first_name, memberInfo.last_name].filter(Boolean).join(" ") || "Member";

        await client.query(
          `INSERT INTO outbox_events (tenant_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            tenantId,
            "whatsapp.payment_receipt.send",
            JSON.stringify({
              to: memberInfo.phone ?? "",
              template: "payment_receipt",
              member_name: memberName,
              amount_paise: payment.amount_paise,
              invoice_number: memberInfo.invoice_number ?? ""
            })
          ]
        );
      }

      return { outcome: "ok" as const, payment };
    });

    if (result.outcome !== "ok") {
      res.status(404).json({ error: "invoice_not_found" });
      return;
    }

    res.status(201).json({ data: result.payment });
  })
);

v1Router.patch(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const payload = parseBody(res, planUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), id.data, tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE plans SET ${setSql}
         WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2}
         RETURNING ${plansSelectSql}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.get(
  "/tenants/me",
  asyncHandler(async (_req, res) => {
    if (!requireRole(res, STAFF_ACCESS)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

      const result = await withTenant(tenantId, (client) =>
        client.query<AnyRow>(
          `SELECT ${[
            "id",
            "name",
            "gstin",
            "legal_name",
            "address",
            "state_code",
            "status",
            "created_at"
          ]
            .map(quoteIdent)
            .join(", ")} FROM ${quoteIdent("tenants")} WHERE id = $1`,
          [tenantId]
        )
      );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: row });
  })
);

v1Router.patch(
  "/tenants/me",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, tenantUpdateSchema, req.body) as Record<string, unknown> | null;
    if (!payload) {
      return;
    }

    const entries = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (typeof value === "string") {
          const trimmed = value.trim();
          return [key, trimmed.length === 0 ? null : trimmed] as const;
        }
        return [key, value] as const;
      });

    if (entries.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    const setSql = entries
      .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
      .join(", ");
    const values = [...entries.map(([, value]) => value), tenantId];

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE tenants SET ${setSql}
         WHERE id = $${entries.length + 1}
         RETURNING ${[
           "id",
           "name",
           "gstin",
           "legal_name",
           "address",
           "state_code",
           "status",
           "created_at"
         ]
           .map(quoteIdent)
           .join(", ")}`,
        values
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

v1Router.post(
  "/outbox-events/emit",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, OWNER_ONLY)) {
      return;
    }
    if (config.env !== "development" && config.env !== "test") {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const body = parseBody(res, devOutboxEventSchema, req.body);
    if (!body) {
      return;
    }

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `INSERT INTO outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempt_count, last_attempted_at, error_message, created_at, processed_at`,
        [
          tenantId,
          body.event_type,
          body.aggregate_type ?? null,
          body.aggregate_id ?? null,
          body.payload
        ]
      )
    );

    res.status(201).json({ data: result.rows[0] });
  })
);

registerReadOnlyResource(v1Router, {
  name: "members",
  table: "members",
  orderBy: "created_at",
  select: [
    "id",
    "tenant_id",
    "first_name",
    "last_name",
    "phone",
    "email",
    "status",
    "joined_at",
    "created_at"
  ],
  readRoles: TRAINER_READ
});

registerReadOnlyResource(v1Router, {
  name: "lead-events",
  table: "lead_events",
  orderBy: "occurred_at",
  select: leadEventsSelect,
  readRoles: STAFF_ACCESS
});

registerReadOnlyResource(v1Router, {
  name: "inventory-movements",
  table: "inventory_movements",
  orderBy: "created_at",
  select: inventoryMovementsSelect,
  readRoles: STAFF_ACCESS
});

registerReadOnlyResource(v1Router, {
  name: "users",
  table: "users",
  orderBy: "created_at",
  select: usersSelect,
  readRoles: STAFF_ACCESS
});

registerReadOnlyResource(v1Router, {
  name: "memberships",
  table: "memberships",
  orderBy: "created_at",
  select: membershipsSelect,
  readRoles: TRAINER_READ
});

registerReadOnlyResource(v1Router, {
  name: "payments",
  table: "payments",
  orderBy: "created_at",
  select: paymentsSelect,
  readRoles: STAFF_ACCESS
});

registerReadOnlyResource(v1Router, {
  name: "invoices",
  table: "invoices",
  orderBy: "issued_at",
  select: invoicesSelect,
  readRoles: STAFF_ACCESS
});

v1Router.get(
  "/attendance-events",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, TRAINER_READ)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const limit = parseLimit(req.query.limit);
    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `SELECT id,
                tenant_id,
                member_id,
                device_id,
                source AS event_type,
                event_time AS occurred_at,
                created_at
         FROM attendance_events
         ORDER BY event_time DESC
         LIMIT $1`,
        [limit]
      )
    );

    res.json({ data: result.rows });
  })
);

v1Router.get(
  "/attendance-events/:id",
  asyncHandler(async (req, res) => {
    if (!requireRole(res, TRAINER_READ)) {
      return;
    }
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `SELECT id,
                tenant_id,
                member_id,
                device_id,
                source AS event_type,
                event_time AS occurred_at,
                created_at
         FROM attendance_events
         WHERE id = $1
         LIMIT 1`,
        [id.data]
      )
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: row });
  })
);

v1Router.post(
  "/devices/:id/sync",
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const result = await withTenant(tenantId, (client) =>
      client.query<AnyRow>(
        `UPDATE devices
         SET last_seen_at = now(),
             status = 'online'
         WHERE id = $1 AND tenant_id = $2
         RETURNING ${devicesSelectSql}`,
        [id.data, tenantId]
      )
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

for (const resource of resources) {
  registerResource(v1Router, resource);
}







