// These must match exactly what is registered with Meta
// In mock/dev mode, these are just for documentation

export const TEMPLATES = {
  PAYMENT_RECEIPT: {
    name: "payment_receipt",
    language: "en",
    // {{1}} = member name, {{2}} = amount, {{3}} = invoice number
  },
  RENEWAL_NUDGE: {
    name: "membership_renewal_reminder",
    language: "en",
    // {{1}} = member name, {{2}} = days until expiry, {{3}} = payment link
  },
  WELCOME: {
    name: "member_welcome",
    language: "en",
    // {{1}} = member name, {{2}} = gym name
  }
} as const;
