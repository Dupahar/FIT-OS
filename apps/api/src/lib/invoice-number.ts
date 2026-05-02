import type { PoolClient } from "pg";

export async function getNextInvoiceNumber(
  client: PoolClient,
  tenant_id: string
): Promise<string> {
  const result = await client.query(
    `INSERT INTO invoice_sequences (tenant_id, last_number, prefix)
     VALUES ($1, 1, 'INV')
     ON CONFLICT (tenant_id) DO UPDATE
       SET last_number = invoice_sequences.last_number + 1
     RETURNING last_number, prefix`,
    [tenant_id]
  );

  const { last_number, prefix } = result.rows[0] as {
    last_number: number;
    prefix: string;
  };

  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(last_number).padStart(4, "0")}`;
}
