// ─── API Envelope ─────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  details?: unknown
}

// ─── Auth ─────────────────────────────────────────────────

export interface LoginRequest {
  tenant_id: string
  email: string
  password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: string
}

// ─── Tenant ───────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  gstin: string | null
  legal_name: string | null
  address: string | null
  state_code: string | null
  status?: string
  created_at?: string
}

export interface UpdateTenantRequest {
  name?: string
  gstin?: string
  legal_name?: string
  address?: string
  state_code?: string
}

// â”€â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface User {
  id: string
  tenant_id: string
  email: string
  role: 'owner' | 'staff' | 'trainer'
  is_active: boolean
  created_at: string
}

// ─── Member ───────────────────────────────────────────────

export interface Member {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  status: 'active' | 'inactive'
  joined_at: string
  created_at: string
}

export interface CreateMemberRequest {
  first_name: string
  last_name: string
  email?: string
  phone: string
  lead_source?: 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'
  lead_staff_id?: string
  lead_notes?: string
}

export interface UpdateMemberRequest {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  status?: 'active' | 'inactive'
}

// â”€â”€â”€ Leads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface Lead {
  id: string
  tenant_id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  source: 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'
  assigned_staff_id: string | null
  status: 'new' | 'contacted' | 'attended' | 'converted' | 'lost'
  attended_at: string | null
  converted_at: string | null
  member_id: string | null
  notes: string | null
  created_at: string
}

export interface CreateLeadRequest {
  first_name?: string
  last_name?: string
  phone: string
  email?: string
  source: 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'
  assigned_staff_id?: string
  status?: 'new' | 'contacted' | 'attended' | 'converted' | 'lost'
  attended_at?: string
  converted_at?: string
  member_id?: string
  notes?: string
}

export interface UpdateLeadRequest {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  source?: 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'
  assigned_staff_id?: string
  status?: 'new' | 'contacted' | 'attended' | 'converted' | 'lost'
  attended_at?: string
  converted_at?: string
  member_id?: string
  notes?: string
}

export interface LeadEvent {
  id: string
  tenant_id: string
  lead_id: string
  staff_id: string | null
  event_type: 'call' | 'follow_up' | 'visit' | 'conversion' | 'note'
  outcome: string | null
  duration_seconds: number | null
  notes: string | null
  metadata: Record<string, unknown>
  occurred_at: string
}

export interface CreateLeadEventRequest {
  lead_id: string
  staff_id?: string
  event_type: 'call' | 'follow_up' | 'visit' | 'conversion' | 'note'
  outcome?: string
  duration_seconds?: number
  notes?: string
  metadata?: Record<string, unknown>
  occurred_at?: string
}

// â”€â”€â”€ Inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface InventoryItem {
  id: string
  tenant_id: string
  name: string
  sku: string | null
  category: string
  brand: string | null
  unit_price_paise: number
  unit: string
  reorder_level: number
  current_stock: number
  supplier: string | null
  status: string
  created_at: string
}

export interface CreateInventoryItemRequest {
  name: string
  sku?: string
  category: string
  brand?: string
  unit_price_paise: number
  unit?: string
  reorder_level?: number
  current_stock?: number
  supplier?: string
  status?: string
}

export interface UpdateInventoryItemRequest {
  name?: string
  sku?: string
  category?: string
  brand?: string
  unit_price_paise?: number
  unit?: string
  reorder_level?: number
  supplier?: string
  status?: string
}

export interface InventoryMovement {
  id: string
  tenant_id: string
  item_id: string
  movement_type: 'in' | 'out'
  quantity: number
  unit_price_paise: number | null
  total_paise: number | null
  reason: string | null
  actor_user_id: string | null
  member_id: string | null
  invoice_id: string | null
  notes: string | null
  created_at: string
}

export interface CreateInventoryMovementRequest {
  movement_type: 'in' | 'out'
  quantity: number
  unit_price_paise?: number
  member_id?: string
  reason?: string
  notes?: string
  occurred_at?: string
}

// ─── Plan ─────────────────────────────────────────────────

export interface Plan {
  id: string
  tenant_id: string
  name: string
  price_paise: number
  billing_interval: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  gst_rate: number
  status: 'active' | 'inactive'
  created_at: string
}

export interface CreatePlanRequest {
  name: string
  price_paise: number
  billing_interval: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  gst_rate?: number | string
}

export interface UpdatePlanRequest {
  name?: string
  price_paise?: number
  billing_interval?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  gst_rate?: number | string
  status?: 'active' | 'inactive'
}

// ─── Membership ───────────────────────────────────────────

export interface Membership {
  id: string
  tenant_id: string
  member_id: string
  plan_id: string
  start_date: string
  end_date: string
  status: 'active' | 'frozen' | 'cancelled'
  frozen_at?: string | null
  freeze_until: string | null
  created_at: string
}

export interface CreateMembershipRequest {
  member_id: string
  plan_id: string
  start_date: string
  end_date: string
}

export interface UpdateMembershipRequest {
  status?: 'active' | 'frozen' | 'cancelled'
  plan_id?: string
  freeze_until?: string
}

// ─── Invoice ──────────────────────────────────────────────

export interface Invoice {
  id: string
  tenant_id: string
  member_id: string
  status: 'pending' | 'paid' | 'void'
  subtotal_paise: number
  gst_paise: number
  cgst_paise: number
  sgst_paise: number
  igst_paise: number
  total_paise: number
  invoice_number: string
  hsn_code: string
  issued_at: string
  due_at: string | null
  razorpay_order_id: string | null
}

export interface CreateInvoiceRequest {
  member_id: string
  subtotal_paise: number
  issued_at?: string
  due_at?: string
  status?: 'pending' | 'paid' | 'void'
  hsn_code?: string
}

export interface UpdateInvoiceRequest {
  status?: 'pending' | 'paid' | 'void'
}

// ─── Payment ──────────────────────────────────────────────

export interface Payment {
  id: string
  tenant_id: string
  invoice_id: string | null
  provider: 'manual' | 'razorpay'
  provider_reference: string | null
  amount_paise: number
  currency: 'INR'
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  paid_at: string | null
  created_at: string
}

export interface CreatePaymentRequest {
  invoice_id?: string
  amount_paise: number
  provider: 'manual' | 'razorpay'
  provider_reference?: string
}

export interface RazorpayOrderRequest {
  invoice_id: string
}

export interface RazorpayOrderResponse {
  order_id: string
  amount: number
  currency: string
  qr_code_url: string
  payment_link: string
}

// ─── Device ───────────────────────────────────────────────

export interface Device {
  id: string
  tenant_id: string
  name: string
  device_type: string
  serial_number: string | null
  status: 'online' | 'offline' | 'error'
  last_seen_at: string | null
  created_at: string
}

export interface CreateDeviceRequest {
  name: string
  device_type: string
  serial_number?: string
}

export interface UpdateDeviceRequest {
  name?: string
  device_type?: string
  serial_number?: string
  status?: 'online' | 'offline' | 'error'
}

// ─── Attendance ───────────────────────────────────────────

export interface AttendanceEvent {
  id: string
  tenant_id: string
  member_id: string
  device_id: string | null
  event_type: 'check_in' | 'check_out' | 'denied'
  occurred_at: string
}

// ─── Usage Ledger ─────────────────────────────────────────

export interface UsageLedgerEntry {
  id: string
  tenant_id: string
  event_type: string
  quantity: string
  unit: string
  amount_paise: number
  source: string
  occurred_at: string
}

// ─── Outbox Events ────────────────────────────────────────

export interface OutboxEvent {
  id: string
  tenant_id: string
  event_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter'
  attempt_count: number
  created_at: string
}

// ─── Audit Log ────────────────────────────────────────────

export interface AuditEntry {
  id: string
  tenant_id: string
  action: string
  entity_type: string
  entity_id: string
  actor_id: string
  metadata: Record<string, unknown>
  created_at: string
}
