import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Download, FileText, CreditCard } from 'lucide-react'
import { useInvoices, useMembers, useDownloadInvoicePdf, useCreatePayment, useUpdateInvoice, useDownloadTallyExport } from '@/hooks/useApi'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal'
import { CreateInvoiceModal } from '@/components/modals/CreateInvoiceModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/shared/Toast'
import { formatPaise, formatDate } from '@/lib/utils'

type FilterTab = 'all' | 'paid' | 'pending' | 'void'

export default function BillingPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: invoices, isLoading } = useInvoices()
  const { data: members } = useMembers()
  const downloadPdf = useDownloadInvoicePdf()
  const createPayment = useCreatePayment()
  const updateInvoice = useUpdateInvoice()
  const tallyExport = useDownloadTallyExport()

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [voidTarget, setVoidTarget] = useState<string | null>(null)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  // KPIs
  const kpis = useMemo(() => {
    const monthInvoices = invoices?.filter((i) => i.issued_at >= monthStart) || []
    const invoiced = monthInvoices.reduce((sum, i) => sum + Number(i.total_paise), 0)
    const collected = monthInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + Number(i.total_paise), 0)
    const outstanding = (invoices || []).filter((i) => i.status === 'pending').reduce((sum, i) => sum + Number(i.total_paise), 0)
    return { invoiced, collected, outstanding }
  }, [invoices, monthStart])

  const counts = useMemo(() => ({
    all: invoices?.length || 0,
    paid: invoices?.filter((i) => i.status === 'paid').length || 0,
    pending: invoices?.filter((i) => i.status === 'pending').length || 0,
    void: invoices?.filter((i) => i.status === 'void').length || 0,
  }), [invoices])

  const filtered = useMemo(() => {
    const list = invoices || []
    if (activeTab === 'all') return list
    return list.filter((i) => i.status === activeTab)
  }, [invoices, activeTab])

  const getMemberName = (memberId: string) => {
    const m = members?.find((m) => m.id === memberId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
  }

  const markPaid = async (invoiceId: string, totalPaise: number) => {
    try {
      await createPayment.mutateAsync({
        invoice_id: invoiceId,
        amount_paise: totalPaise,
        provider: 'manual',
      })
      toast('success', 'Payment recorded · Invoice marked as paid')
    } catch {
      toast('error', 'Failed to record payment')
    }
  }

  const handleVoid = async () => {
    if (!voidTarget) return
    try {
      await updateInvoice.mutateAsync({ id: voidTarget, status: 'void' })
      toast('success', 'Invoice voided')
      setVoidTarget(null)
    } catch {
      toast('error', 'Failed to void invoice')
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending', label: 'Pending' },
    { key: 'void', label: 'Void' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Billing</h1>
          <p className="text-sm text-gray-400 mt-0.5">GST-compliant invoicing · Tally ready</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => tallyExport.mutate()}
            disabled={tallyExport.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={16} /> Export to Tally
          </button>
          <button
            onClick={() => setShowRecordPayment(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <CreditCard size={16} /> Record Payment
          </button>
          <button
            onClick={() => setShowCreateInvoice(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
          >
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-5 mt-6 mb-6">
        {[
          { label: 'Invoiced This Month', value: kpis.invoiced, color: '#0984E3' },
          { label: 'Collected This Month', value: kpis.collected, color: '#00B894' },
          { label: 'Outstanding', value: kpis.outstanding, color: '#F39C12' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="border rounded-xl p-5 relative overflow-hidden"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{kpi.label}</p>
            <p className="font-syne font-bold text-2xl">{formatPaise(kpi.value)}</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: kpi.color }} />
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              activeTab === tab.key ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[tab.key]}
            </span>
            {activeTab === tab.key && (
              <motion.div layoutId="billingTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices"
          description="Create an invoice to start billing."
          action={
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="px-4 py-2 bg-[#00B894] text-white text-sm rounded-lg font-medium"
            >
              Create Invoice
            </button>
          }
        />
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {filtered.map((inv, i) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/billing/${inv.id}`)}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: '#0984E3' }}>{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{getMemberName(inv.member_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatPaise(inv.subtotal_paise)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatPaise(inv.cgst_paise)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatPaise(inv.sgst_paise)}</td>
                  <td className="px-4 py-3 text-sm font-syne font-bold">{formatPaise(inv.total_paise)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.issued_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => navigate(`/billing/${inv.id}`)} className="text-xs text-[#0984E3] hover:underline">View</button>
                      <button onClick={() => downloadPdf.mutate(inv.id)} className="text-xs text-gray-500 hover:underline">PDF</button>
                      {inv.status === 'pending' && (
                        <>
                          <button onClick={() => markPaid(inv.id, inv.total_paise)} className="text-xs text-emerald-600 hover:underline">Paid</button>
                          <button onClick={() => setVoidTarget(inv.id)} className="text-xs text-red-500 hover:underline">Void</button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateInvoiceModal open={showCreateInvoice} onClose={() => setShowCreateInvoice(false)} />
      <RecordPaymentModal open={showRecordPayment} onClose={() => setShowRecordPayment(false)} />
      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={handleVoid}
        title="Void Invoice"
        description="This will void the invoice. It cannot be undone."
        confirmLabel="Void Invoice"
        destructive
      />
    </div>
  )
}
