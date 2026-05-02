import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, CreditCard, XCircle, QrCode } from 'lucide-react'
import { useInvoices, useMembers, usePayments, useTenantProfile, useDownloadInvoicePdf, useCreateRazorpayOrder, useUpdateInvoice } from '@/hooks/useApi'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/shared/Toast'
import { formatPaise, formatDate } from '@/lib/utils'
import { useState } from 'react'
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import type { RazorpayOrderResponse } from '@/types'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: invoices } = useInvoices()
  const { data: members } = useMembers()
  const { data: payments } = usePayments()
  const { data: tenant } = useTenantProfile()
  const downloadPdf = useDownloadInvoicePdf()
  const createRzpOrder = useCreateRazorpayOrder()
  const updateInvoice = useUpdateInvoice()

  const [showPayment, setShowPayment] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [rzpOrder, setRzpOrder] = useState<RazorpayOrderResponse | null>(null)

  const invoice = invoices?.find((i) => i.id === id)
  const member = invoice ? members?.find((m) => m.id === invoice.member_id) : null
  const payment = invoice ? payments?.find((p) => p.invoice_id === invoice.id && p.status === 'paid') : null

  if (!invoice) {
    return (
      <div className="p-8">
        <div className="skeleton h-8 w-48 mb-6 rounded" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    )
  }

  const handleVoid = async () => {
    try {
      await updateInvoice.mutateAsync({ id: id!, status: 'void' })
      toast('success', 'Invoice voided')
      setShowVoid(false)
    } catch {
      toast('error', 'Failed to void invoice')
    }
  }

  const handleRazorpay = async () => {
    try {
      const res = await createRzpOrder.mutateAsync({ invoice_id: invoice.id })
      setRzpOrder(res)
      toast('success', 'Razorpay order created')
    } catch {
      toast('error', 'Failed to create Razorpay order')
    }
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/billing')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Billing
      </button>

      <div className="grid grid-cols-3 gap-8">
        {/* Invoice Preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2 bg-white border rounded-xl p-8 shadow-sm"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div>
              <h1 className="font-syne font-extrabold text-3xl text-gray-900">FIT</h1>
              <p className="text-sm text-gray-400 mt-0.5">Tax Invoice</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold" style={{ color: '#0984E3' }}>{invoice.invoice_number}</p>
              <StatusBadge status={invoice.status} className="mt-1" />
            </div>
          </div>

          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">From</p>
              <p className="font-semibold text-gray-900">{tenant?.legal_name || tenant?.name || 'FIT Gym'}</p>
              <p className="text-sm text-gray-500 mt-0.5">GSTIN: {tenant?.gstin || '—'}</p>
              <p className="text-sm text-gray-500">{tenant?.address || '—'}</p>
              <p className="text-sm text-gray-500">State Code: {tenant?.state_code || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">To</p>
              <p className="font-semibold text-gray-900">{member ? `${member.first_name} ${member.last_name}` : '—'}</p>
              <p className="text-sm text-gray-500 mt-0.5">{member?.phone}</p>
              {member?.email && <p className="text-sm text-gray-500">{member.email}</p>}
            </div>
          </div>

          {/* Line Items */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                <th className="text-left py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="text-left py-3 text-xs font-medium text-gray-500 uppercase">HSN</th>
                <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                <td className="py-3 text-sm text-gray-700">Gym Membership</td>
                <td className="py-3 text-sm font-mono text-gray-500">{invoice.hsn_code || '998311'}</td>
                <td className="py-3 text-sm text-right font-syne font-bold">{formatPaise(invoice.subtotal_paise)}</td>
              </tr>
            </tbody>
          </table>

          {/* Summary */}
          <div className="space-y-2 ml-auto w-64">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{formatPaise(invoice.subtotal_paise)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">CGST</span>
              <span className="text-gray-700">{formatPaise(invoice.cgst_paise)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">SGST</span>
              <span className="text-gray-700">{formatPaise(invoice.sgst_paise)}</span>
            </div>
            {invoice.igst_paise > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IGST</span>
                <span className="text-gray-700">{formatPaise(invoice.igst_paise)}</span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t font-bold" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <span className="text-gray-900">TOTAL</span>
              <span className="font-syne text-xl">{formatPaise(invoice.total_paise)}</span>
            </div>
          </div>

          <div className="mt-10 pt-4 border-t text-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-xs text-gray-300">Generated by FIT · Powered by Anthropic</p>
          </div>
        </motion.div>

        {/* Right Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <h3 className="font-syne font-semibold text-sm text-gray-500 uppercase mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <StatusBadge status={invoice.status} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Issued</p>
                <p className="text-sm text-gray-700">{formatDate(invoice.issued_at)}</p>
              </div>
              {invoice.due_at && (
                <div>
                  <p className="text-xs text-gray-400">Due</p>
                  <p className="text-sm text-gray-700">{formatDate(invoice.due_at)}</p>
                </div>
              )}
              {payment && (
                <>
                  <div>
                    <p className="text-xs text-gray-400">Payment Method</p>
                    <p className="text-sm text-gray-700 capitalize">{payment.provider}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Paid At</p>
                    <p className="text-sm text-gray-700">{formatDate(payment.paid_at)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => downloadPdf.mutate(invoice.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download size={16} /> Download PDF
            </button>

            {invoice.status === 'pending' && (
              <>
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00B894] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  <CreditCard size={16} /> Mark as Paid
                </button>
                <button
                  onClick={() => setShowVoid(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-100 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle size={16} /> Void Invoice
                </button>
                <button
                  onClick={handleRazorpay}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-100 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <QrCode size={16} /> Create Razorpay Order
                </button>
              </>
            )}
          </div>

          {rzpOrder && (
            <div className="border rounded-xl p-4" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Razorpay Payment Link</p>
              <a href={rzpOrder.payment_link} target="_blank" rel="noreferrer"
                className="text-sm text-blue-600 hover:underline break-all">
                {rzpOrder.payment_link}
              </a>
            </div>
          )}
        </motion.div>
      </div>

      <RecordPaymentModal open={showPayment} onClose={() => setShowPayment(false)} preselectedInvoiceId={id} />
      <ConfirmDialog
        open={showVoid}
        onClose={() => setShowVoid(false)}
        onConfirm={handleVoid}
        title="Void Invoice"
        description="This will permanently void the invoice. This action cannot be undone."
        confirmLabel="Void Invoice"
        destructive
      />
    </div>
  )
}
