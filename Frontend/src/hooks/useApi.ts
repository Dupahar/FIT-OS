import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Member, CreateMemberRequest, UpdateMemberRequest,
  User,
  Plan, CreatePlanRequest, UpdatePlanRequest,
  Membership, CreateMembershipRequest, UpdateMembershipRequest,
  Invoice, CreateInvoiceRequest, UpdateInvoiceRequest,
  Payment, CreatePaymentRequest,
  Device, CreateDeviceRequest, UpdateDeviceRequest,
  Lead, CreateLeadRequest, UpdateLeadRequest,
  LeadEvent, CreateLeadEventRequest,
  InventoryItem, CreateInventoryItemRequest, UpdateInventoryItemRequest,
  InventoryMovement, CreateInventoryMovementRequest,
  AttendanceEvent, OutboxEvent, UsageLedgerEntry, AuditEntry,
  Tenant, UpdateTenantRequest, RazorpayOrderRequest, RazorpayOrderResponse,
  ApiResponse,
} from '@/types'

// ─── Helper ───────────────────────────────────────────────

function extractData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data
}

// ─── Tenant ───────────────────────────────────────────────

export function useTenantProfile() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<ApiResponse<Tenant>>('/v1/tenants/me').then(extractData),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateTenantRequest) =>
      api.patch<ApiResponse<Tenant>>('/v1/tenants/me', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] })
    },
  })
}

// Users

export function useUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<ApiResponse<User[]>>('/v1/users').then(extractData),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// ─── Members ──────────────────────────────────────────────

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<ApiResponse<Member[]>>('/v1/members').then(extractData),
  })
}

export function useMember(id: string) {
  const { data: members, ...rest } = useMembers()
  const member = members?.find((m) => m.id === id)
  return { data: member, ...rest }
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMemberRequest) =>
      api.post<ApiResponse<Member>>('/v1/members', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMemberRequest & { id: string }) =>
      api.patch<ApiResponse<Member>>(`/v1/members/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

// Leads

export function useLeads(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get<ApiResponse<Lead[]>>('/v1/leads').then(extractData),
    enabled: options?.enabled ?? true,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeadRequest) =>
      api.post<ApiResponse<Lead>>('/v1/leads', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateLeadRequest & { id: string }) =>
      api.patch<ApiResponse<Lead>>(`/v1/leads/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useLeadEvents() {
  return useQuery({
    queryKey: ['lead-events'],
    queryFn: () => api.get<ApiResponse<LeadEvent[]>>('/v1/lead-events').then(extractData),
  })
}

export function useCreateLeadEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeadEventRequest) =>
      api.post<ApiResponse<LeadEvent>>('/v1/lead-events', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-events'] })
    },
  })
}

// ─── Plans ────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<ApiResponse<Plan[]>>('/v1/plans').then(extractData),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePlanRequest) =>
      api.post<ApiResponse<Plan>>('/v1/plans', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePlanRequest & { id: string }) =>
      api.patch<ApiResponse<Plan>>(`/v1/plans/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

// ─── Memberships ──────────────────────────────────────────

export function useMemberships() {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.get<ApiResponse<Membership[]>>('/v1/memberships').then(extractData),
  })
}

export function useCreateMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMembershipRequest) =>
      api.post<ApiResponse<Membership>>('/v1/memberships', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
    },
  })
}

export function useUpdateMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMembershipRequest & { id: string }) =>
      api.patch<ApiResponse<Membership>>(`/v1/memberships/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
    },
  })
}

// ─── Invoices ─────────────────────────────────────────────

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<ApiResponse<Invoice[]>>('/v1/invoices').then(extractData),
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) =>
      api.post<ApiResponse<Invoice>>('/v1/invoices', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateInvoiceRequest & { id: string }) =>
      api.patch<ApiResponse<Invoice>>(`/v1/invoices/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await api.get(`/v1/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${invoiceId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}

export function useDownloadTallyExport() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.get('/v1/invoices/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      link.href = url
      link.setAttribute('download', `tally-export-${stamp}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}

// ─── Payments ─────────────────────────────────────────────

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get<ApiResponse<Payment[]>>('/v1/payments').then(extractData),
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePaymentRequest) =>
      api.post<ApiResponse<Payment>>('/v1/payments', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: (data: RazorpayOrderRequest) =>
      api.post<ApiResponse<RazorpayOrderResponse>>('/v1/payments/orders', data).then(extractData),
  })
}

// Inventory

export function useInventoryItems() {
  return useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<ApiResponse<InventoryItem[]>>('/v1/inventory-items').then(extractData),
  })
}

export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateInventoryItemRequest) =>
      api.post<ApiResponse<InventoryItem>>('/v1/inventory-items', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
  })
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateInventoryItemRequest & { id: string }) =>
      api.patch<ApiResponse<InventoryItem>>(`/v1/inventory-items/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
    },
  })
}

export function useInventoryMovements() {
  return useQuery({
    queryKey: ['inventory-movements'],
    queryFn: () => api.get<ApiResponse<InventoryMovement[]>>('/v1/inventory-movements').then(extractData),
  })
}

export function useCreateInventoryMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ item_id, ...data }: CreateInventoryMovementRequest & { item_id: string }) =>
      api.post<ApiResponse<InventoryMovement>>(`/v1/inventory-items/${item_id}/movements`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
    },
  })
}

// ─── Devices ──────────────────────────────────────────────

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<ApiResponse<Device[]>>('/v1/devices').then(extractData),
  })
}

export function useCreateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDeviceRequest) =>
      api.post<ApiResponse<Device>>('/v1/devices', data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export function useUpdateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateDeviceRequest & { id: string }) =>
      api.patch<ApiResponse<Device>>(`/v1/devices/${id}`, data).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export function useSyncDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<Device>>(`/v1/devices/${id}/sync`).then(extractData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

// ─── Attendance ───────────────────────────────────────────

export function useAttendance() {
  return useQuery({
    queryKey: ['attendance'],
    queryFn: () => api.get<ApiResponse<AttendanceEvent[]>>('/v1/attendance-events').then(extractData),
  })
}

// ─── Outbox Events ────────────────────────────────────────

export function useOutboxEvents() {
  return useQuery({
    queryKey: ['outbox-events'],
    queryFn: () => api.get<ApiResponse<OutboxEvent[]>>('/v1/outbox-events').then(extractData),
  })
}

// ─── Usage Ledger ─────────────────────────────────────────

export function useUsageLedger() {
  return useQuery({
    queryKey: ['usage-ledger'],
    queryFn: () => api.get<ApiResponse<UsageLedgerEntry[]>>('/v1/usage-ledger').then(extractData),
  })
}

// ─── Audit Log ────────────────────────────────────────────

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.get<ApiResponse<AuditEntry[]>>('/v1/audit-log').then(extractData),
  })
}
