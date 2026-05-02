import { useState } from 'react'
import { X, Snowflake } from 'lucide-react'
import { useUpdateMembership } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { motion, AnimatePresence } from 'framer-motion'

interface FreezeMembershipModalProps {
  open: boolean
  onClose: () => void
  membershipId: string
}

export function FreezeMembershipModal({ open, onClose, membershipId }: FreezeMembershipModalProps) {
  const { toast } = useToast()
  const updateMembership = useUpdateMembership()
  const [days, setDays] = useState(7)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFreeze = async () => {
    setIsSubmitting(true)
    const freezeUntil = new Date()
    freezeUntil.setDate(freezeUntil.getDate() + days)

    try {
      await updateMembership.mutateAsync({
        id: membershipId,
        status: 'frozen',
        freeze_until: freezeUntil.toISOString(),
      })
      toast('success', `Membership frozen for ${days} days`)
      onClose()
    } catch {
      toast('error', 'Failed to freeze membership')
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
            className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Snowflake size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-syne font-semibold text-lg">Freeze Membership</h3>
                  <p className="text-xs text-gray-400">Temporarily pause billing</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Freeze Duration (days)</label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  min={1}
                  max={90}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Will unfreeze on {new Date(Date.now() + days * 86400000).toLocaleDateString('en-IN')}
                </p>
              </div>

              <button
                onClick={handleFreeze}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#185FA5] hover:bg-blue-700 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : <Snowflake size={16} />}
                {isSubmitting ? 'Freezing...' : 'Freeze Membership'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
