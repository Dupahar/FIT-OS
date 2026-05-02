import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import { razorpay } from "../../lib/razorpay";
import { config } from "../../config";
import { withTenant } from "../../db";
import { authContext } from "../../middleware/auth";

const paymentsRouter = Router();
const uuid = z.string().uuid();

const orderCreateSchema = z
  .object({
    invoice_id: uuid
  })
  .strict();

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

function getTenantId(res: Response) {
  const parsed = uuid.safeParse(res.locals.tenantId);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_tenant_id" });
    return null;
  }
  return parsed.data;
}

paymentsRouter.post(
  "/orders",
  authContext,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(res);
    if (!tenantId) {
      return;
    }

    const payload = parseBody(res, orderCreateSchema, req.body);
    if (!payload) {
      return;
    }

    const invoiceResult = await withTenant(tenantId, (client) =>
      client.query<{
        id: string;
        member_id: string;
        total_paise: number;
        razorpay_order_id: string | null;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
      }>(
        `SELECT invoices.id,
                invoices.member_id,
                invoices.total_paise,
                invoices.razorpay_order_id,
                members.first_name,
                members.last_name,
                members.email,
                members.phone
         FROM invoices
         JOIN members ON members.id = invoices.member_id
         WHERE invoices.id = $1 AND invoices.tenant_id = $2
         LIMIT 1`,
        [payload.invoice_id, tenantId]
      )
    );

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const amountPaise = Number(invoice.total_paise);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }

    const memberName = [invoice.first_name, invoice.last_name].filter(Boolean).join(" ") || "Member";

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: invoice.id,
      notes: {
        tenant_id: tenantId,
        invoice_id: invoice.id,
        member_id: invoice.member_id
      }
    });

    await withTenant(tenantId, (client) =>
      client.query(
        `UPDATE invoices SET razorpay_order_id = $1 WHERE id = $2 AND tenant_id = $3`,
        [order.id, invoice.id, tenantId]
      )
    );

    let paymentLinkUrl: string | null = null;
    try {
      const paymentLink = await razorpay.paymentLink.create({
        upi_link: true,
        amount: amountPaise,
        currency: "INR",
        reference_id: invoice.id,
        description: `Invoice ${invoice.id}`,
        customer: {
          name: memberName,
          email: invoice.email ?? "no-reply@fit.local",
          contact: invoice.phone ?? ""
        },
        notes: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          member_id: invoice.member_id,
          razorpay_order_id: order.id
        }
      });
      paymentLinkUrl = paymentLink.short_url;
    } catch (err: any) {
      const description =
        err?.error?.description ?? err?.description ?? err?.message ?? "";
      const isUpiLinkTestMode =
        typeof description === "string" &&
        description.includes("UPI Payment Links is not supported in Test Mode");

      if (!isUpiLinkTestMode) {
        console.error(err);
      } else {
        try {
          const paymentLink = await razorpay.paymentLink.create({
            amount: amountPaise,
            currency: "INR",
            reference_id: invoice.id,
            description: `Invoice ${invoice.id}`,
            customer: {
              name: memberName,
              email: invoice.email ?? "no-reply@fit.local",
              contact: invoice.phone ?? ""
            },
            notes: {
              tenant_id: tenantId,
              invoice_id: invoice.id,
              member_id: invoice.member_id,
              razorpay_order_id: order.id
            }
          });
          paymentLinkUrl = paymentLink.short_url;
        } catch (fallbackErr) {
          console.error(fallbackErr);
        }
      }
    }

    let qrCodeUrl: string | null = null;
    try {
      const qrCode = await razorpay.qrCode.create({
        type: "upi_qr",
        name: `Invoice ${invoice.id}`,
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amountPaise,
        notes: {
          tenant_id: tenantId,
          invoice_id: invoice.id,
          member_id: invoice.member_id,
          razorpay_order_id: order.id
        }
      });
      qrCodeUrl = qrCode.image_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[razorpay] QR code unavailable in test mode:", message);
    }

    res.status(201).json({
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        qr_code_url: qrCodeUrl,
        payment_link: paymentLinkUrl
      }
    });
  })
);

paymentsRouter.post("/webhook", async (req: Request, res: Response) => {
  const signatureHeader = req.headers["x-razorpay-signature"];
  const signature = typeof signatureHeader === "string" ? signatureHeader : "";
  const rawBody = req.body;

  if (!signature || !Buffer.isBuffer(rawBody)) {
    res.status(400).json({ error: "invalid_signature" });
    return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", config.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    res.status(400).json({ error: "invalid_signature" });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(200).json({ status: "invalid_payload" });
    return;
  }

  if (payload?.event !== "payment.captured") {
    res.status(200).json({ status: "ignored" });
    return;
  }

  const paymentEntity = payload?.payload?.payment?.entity;
  const orderEntity = payload?.payload?.order?.entity;

  const orderId = paymentEntity?.order_id ?? orderEntity?.id ?? null;
  const paymentId = paymentEntity?.id ?? null;
  const amountPaise = paymentEntity?.amount ?? null;
  const currency = paymentEntity?.currency ?? "INR";

  const mergedNotes = {
    ...(orderEntity?.notes ?? {}),
    ...(paymentEntity?.notes ?? {})
  } as Record<string, string>;

  let tenantId = mergedNotes.tenant_id;
  let invoiceId = mergedNotes.invoice_id;

  if ((!tenantId || !invoiceId) && orderId) {
    try {
      const order = await razorpay.orders.fetch(orderId);
      const orderNotes = (order?.notes ?? {}) as Record<string, string>;
      tenantId = tenantId ?? orderNotes.tenant_id;
      invoiceId = invoiceId ?? orderNotes.invoice_id;
    } catch (err) {
      console.error(err);
    }
  }

  const parsedTenantId = uuid.safeParse(tenantId);
  if (!parsedTenantId.success) {
    res.status(200).json({ status: "missing_metadata" });
    return;
  }

  try {
    const result = await withTenant(parsedTenantId.data, async (client) => {
      let invoiceResult;
      if (invoiceId && uuid.safeParse(invoiceId).success) {
        invoiceResult = await client.query<{
          id: string;
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
           RETURNING invoices.id,
                     invoices.member_id,
                     invoices.invoice_number,
                     members.first_name,
                     members.last_name,
                     members.phone`,
          [invoiceId, parsedTenantId.data]
        );
      } else if (orderId) {
        invoiceResult = await client.query<{
          id: string;
          member_id: string;
          invoice_number: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
        }>(
          `UPDATE invoices
           SET status = 'paid'
           FROM members
           WHERE invoices.razorpay_order_id = $1
             AND invoices.tenant_id = $2
             AND members.id = invoices.member_id
           RETURNING invoices.id,
                     invoices.member_id,
                     invoices.invoice_number,
                     members.first_name,
                     members.last_name,
                     members.phone`,
          [orderId, parsedTenantId.data]
        );
      } else {
        return { outcome: "invoice_not_found" as const };
      }

      if (!invoiceResult || invoiceResult.rowCount === 0) {
        return { outcome: "invoice_not_found" as const };
      }

      const invoiceRow = invoiceResult.rows[0];

      if (paymentId) {
        const existingPayment = await client.query<{ id: string }>(
          `SELECT id FROM payments WHERE razorpay_payment_id = $1 LIMIT 1`,
          [paymentId]
        );

        if (existingPayment.rowCount === 0) {
          await client.query(
            `INSERT INTO payments
              (tenant_id, invoice_id, provider, provider_reference, razorpay_payment_id, amount_paise, currency, status, paid_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              parsedTenantId.data,
              invoiceRow.id,
              "razorpay",
              paymentId,
              paymentId,
              amountPaise ?? 0,
              currency,
              "paid"
            ]
          );
        }
      }

      const memberName =
        [invoiceRow.first_name, invoiceRow.last_name].filter(Boolean).join(" ") || "Member";

      await client.query(
        `INSERT INTO outbox_events (tenant_id, event_type, payload)
         VALUES ($1, $2, $3)`,
        [
          parsedTenantId.data,
          "whatsapp.payment_receipt.send",
          JSON.stringify({
            to: invoiceRow.phone ?? "",
            template: "payment_receipt",
            member_name: memberName,
            amount_paise: amountPaise ?? 0,
            invoice_number: invoiceRow.invoice_number ?? ""
          })
        ]
      );

      return { outcome: "ok" as const };
    });

    res.status(200).json({ status: result.outcome });
  } catch (err) {
    console.error(err);
    res.status(200).json({ status: "error" });
  }
});

export { paymentsRouter };
