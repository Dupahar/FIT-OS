import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, FileText } from 'lucide-react'
import { useCreateInvoice, useMembers, useMemberships, usePlans } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatPaise } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const schema = z.object({
  member_id: z.string().min(1, 'Select a member'),
  subtotal_inr: z.number().finite().min(1, 'Subtotal must be at least ₹1'),
  due_date: z.string().optional().or(z.literal('')),
  hsn_code: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
}

export function CreateInvoiceModal({ open, onClose }: CreateInvoiceModalProps) {
  const { toast } = useToast()
  const createInvoice = useCreateInvoice()
  const { data: members } = useMembers()
  const { data: memberships } = useMemberships()
  const { data: plans } = usePlans()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      subtotal_inr: 0,
    },
  })

  const selectedMemberId = watch('member_id')
  const subtotalInr = watch('subtotal_inr') || 0
  const subtotalPaise = Math.round(subtotalInr * 100)
  const cgstPaise = Math.round(subtotalPaise * 0.09)
  const sgstPaise = Math.round(subtotalPaise * 0.09)
  const totalPaise = subtotalPaise + cgstPaise + sgstPaise

  const sortedMembers = useMemo(() => {
    if (!members) return []
    return [...members].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.trim().toLowerCase()
      const nameB = `${b.first_name} ${b.last_name}`.trim().toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [members])

  useEffect(() => {
    if (!selectedMemberId) return
    const membership = memberships?.find(
      (m) => m.member_id === selectedMemberId && m.status === 'active',
    )
    const plan = membership ? plans?.find((p) => p.id === membership.plan_id) : null
    if (plan) {
      setValue('subtotal_inr', Number(plan.price_paise) / 100)
    }
  }, [selectedMemberId, memberships, plans, setValue])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const dueAt = data.due_date
        ? new Date(`${data.due_date}T00:00:00`).toISOString()
        : undefined

      await createInvoice.mutateAsync({
        member_id: data.member_id,
        subtotal_paise: Math.round(data.subtotal_inr * 100),
        due_at: dueAt,
        hsn_code: data.hsn_code || undefined,
      })
      toast('success', 'Invoice created successfully')
      reset()
      onClose()
    } catch {
      toast('error', 'Failed to create invoice')
    } finally {
      setIsSubmitting(false)
    }
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
                  <FileText size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-syne font-semibold text-lg">Create Invoice</h3>
                  <p className="text-xs text-gray-400">GST computed automatically (18%)</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
                <select
                  {...register('member_id')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                >
                  <option value="">Select a member</option>
                  {sortedMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} · {member.phone}
                    </option>
                  ))}
                </select>
                {errors.member_id && <p className="text-xs text-red-500 mt-1">{errors.member_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('subtotal_inr', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="2500"
                />
                {errors.subtotal_inr && <p className="text-xs text-red-500 mt-1">{errors.subtotal_inr.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                  <input
                    type="date"
                    {...register('due_date')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code (optional)</label>
                  <input
                    {...register('hsn_code')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="999311"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">CGST (9%)</span>
                  <span className="font-medium">{formatPaise(cgstPaise)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">SGST (9%)</span>
                  <span className="font-medium">{formatPaise(sgstPaise)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-700 font-semibold">Total</span>
                  <span className="font-syne font-bold">{formatPaise(totalPaise)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || sortedMembers.length === 0}
                className="w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : <FileText size={16} />}
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
              </button>
              {sortedMembers.length === 0 && (
                <p className="text-xs text-gray-400 text-center">Add a member first to create an invoice.</p>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
