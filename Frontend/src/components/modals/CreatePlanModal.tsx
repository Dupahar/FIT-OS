import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Tag } from 'lucide-react'
import { useCreatePlan } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { motion, AnimatePresence } from 'framer-motion'

const schema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  price_inr: z.number().finite().min(1, 'Price must be at least ₹1'),
  billing_interval: z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom']),
  gst_rate: z.number().finite().min(0).max(100),
})

type FormData = z.infer<typeof schema>

interface CreatePlanModalProps {
  open: boolean
  onClose: () => void
}

export function CreatePlanModal({ open, onClose }: CreatePlanModalProps) {
  const { toast } = useToast()
  const createPlan = useCreatePlan()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      billing_interval: 'monthly',
      gst_rate: 18,
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await createPlan.mutateAsync({
        name: data.name,
        price_paise: Math.round(data.price_inr * 100),
        billing_interval: data.billing_interval,
        gst_rate: data.gst_rate,
      })
      toast('success', 'Plan created successfully')
      reset()
      onClose()
    } catch {
      toast('error', 'Failed to create plan')
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
                  <Tag size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-syne font-semibold text-lg">Create Plan</h3>
                  <p className="text-xs text-gray-400">Define a new membership plan</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Monthly Pro"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  {...register('price_inr', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="2500"
                />
                {errors.price_inr && <p className="text-xs text-red-500 mt-1">{errors.price_inr.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Duration</label>
                <select
                  {...register('billing_interval')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                >
                  <option value="monthly">1 month</option>
                  <option value="quarterly">3 months</option>
                  <option value="semiannual">6 months</option>
                  <option value="annual">12 months</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('gst_rate', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="18"
                />
                {errors.gst_rate && <p className="text-xs text-red-500 mt-1">{errors.gst_rate.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : <Tag size={16} />}
                {isSubmitting ? 'Creating...' : 'Create Plan'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
