import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, CreditCard } from 'lucide-react'
import { useCreatePayment, useInvoices, useMembers } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatPaise } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const schema = z.object({
  invoice_id: z.string().min(1, 'Select an invoice'),
  amount_inr: z.number().finite().min(1, 'Amount must be at least ₹1'),
  provider_reference: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  preselectedInvoiceId?: string
  preselectedMemberId?: string
}

export function RecordPaymentModal({
  open,
  onClose,
  preselectedInvoiceId,
  preselectedMemberId,
}: RecordPaymentModalProps) {
  const { toast } = useToast()
  const createPayment = useCreatePayment()
  const { data: invoices } = useInvoices()
  const { data: members } = useMembers()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pendingInvoices = (invoices || []).filter(
    (i) => i.status === 'pending' && (!preselectedMemberId || i.member_id === preselectedMemberId),
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice_id: preselectedInvoiceId || '',
      amount_inr: 0,
    },
  })

  const selectedInvoiceId = watch('invoice_id')
  const selectedInvoice = invoices?.find((i) => i.id === selectedInvoiceId)

  useEffect(() => {
    if (!preselectedInvoiceId || !invoices?.length) return
    const inv = invoices.find((i) => i.id === preselectedInvoiceId)
    if (inv) {
      setValue('amount_inr', inv.total_paise / 100)
    }
  }, [preselectedInvoiceId, invoices, setValue])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await createPayment.mutateAsync({
        invoice_id: data.invoice_id,
        amount_paise: Math.round(data.amount_inr * 100),
        provider: 'manual',
        provider_reference: data.provider_reference || undefined,
      })
      toast('success', 'Payment recorded · Invoice marked as paid')
      reset()
      onClose()
    } catch {
      toast('error', 'Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getMemberName = (memberId: string) => {
    const m = members?.find((m) => m.id === memberId)
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown'
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CreditCard size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-syne font-semibold text-lg">Record Payment</h3>
                  <p className="text-xs text-gray-400">Manual payment entry</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
                <select
                  {...register('invoice_id', {
                    onChange: (e) => {
                      const inv = invoices?.find((i) => i.id === e.target.value)
                      if (inv) setValue('amount_inr', inv.total_paise / 100)
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                >
                  <option value="">Select a pending invoice</option>
                  {pendingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {getMemberName(inv.member_id)} — {formatPaise(inv.total_paise)}
                    </option>
                  ))}
                </select>
                {errors.invoice_id && <p className="text-xs text-red-500 mt-1">{errors.invoice_id.message}</p>}
              </div>

              {selectedInvoice && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice Total</span>
                    <span className="font-syne font-bold">{formatPaise(selectedInvoice.total_paise)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount_inr', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {errors.amount_inr && <p className="text-xs text-red-500 mt-1">{errors.amount_inr.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
                <input
                  {...register('provider_reference')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Receipt/UPI reference no."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : <CreditCard size={16} />}
                {isSubmitting ? 'Processing...' : 'Record Payment'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
