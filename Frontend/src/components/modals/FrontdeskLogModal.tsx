import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PhoneCall, X } from 'lucide-react'
import { useCreateLead, useCreateLeadEvent, useUpdateLead } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { Lead, User } from '@/types'

type EventType = 'call' | 'follow_up' | 'visit' | 'note'
type LeadSource = 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'frontdesk', label: 'Frontdesk' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

const eventOptions: { value: EventType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'visit', label: 'Visit' },
  { value: 'note', label: 'Note' },
]

const callOutcomes = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'wrong_number', label: 'Wrong Number' },
]

const normalizePhone = (value: string) => value.replace(/\D/g, '')

interface FrontdeskLogModalProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
  users: User[]
}

export function FrontdeskLogModal({ open, onClose, leads, users }: FrontdeskLogModalProps) {
  const { toast } = useToast()
  const createLead = useCreateLead()
  const createLeadEvent = useCreateLeadEvent()
  const updateLead = useUpdateLead()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    phone: '',
    first_name: '',
    last_name: '',
    email: '',
    source: 'call' as LeadSource,
    staff_id: '',
    event_type: 'call' as EventType,
    outcome: 'connected',
    duration: '',
    notes: '',
  })

  useEffect(() => {
    if (!open) return
    setForm({
      phone: '',
      first_name: '',
      last_name: '',
      email: '',
      source: 'call',
      staff_id: '',
      event_type: 'call',
      outcome: 'connected',
      duration: '',
      notes: '',
    })
  }, [open])

  const matchedLead = useMemo(() => {
    const target = normalizePhone(form.phone)
    if (!target) return null
    return leads.find((lead) => normalizePhone(lead.phone) === target) ?? null
  }, [form.phone, leads])

  useEffect(() => {
    if (!matchedLead) return
    setForm((prev) => ({
      ...prev,
      source: matchedLead.source ?? prev.source,
      staff_id: prev.staff_id || matchedLead.assigned_staff_id || '',
    }))
  }, [matchedLead])

  const isSaving = isSubmitting || createLead.isPending || createLeadEvent.isPending || updateLead.isPending
  const canSubmit = form.phone.trim().length >= 6 && form.staff_id && form.source && form.event_type

  const deriveLeadStatus = () => {
    if (form.event_type === 'visit') return 'attended'
    if (form.event_type === 'call' && form.outcome === 'connected') return 'contacted'
    if (form.event_type === 'follow_up') return 'contacted'
    return 'new'
  }

  const handleSubmit = async () => {
    if (!canSubmit || isSaving) return
    setIsSubmitting(true)
    try {
      const now = new Date().toISOString()
      let leadId = matchedLead?.id

      if (!leadId) {
        const created = await createLead.mutateAsync({
          first_name: form.first_name.trim() || undefined,
          last_name: form.last_name.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          source: form.source,
          assigned_staff_id: form.staff_id,
          status: deriveLeadStatus(),
          attended_at: form.event_type === 'visit' ? now : undefined,
        })
        leadId = created.id
      } else if (form.staff_id && !matchedLead?.assigned_staff_id) {
        await updateLead.mutateAsync({ id: leadId, assigned_staff_id: form.staff_id })
      }

      await createLeadEvent.mutateAsync({
        lead_id: leadId,
        staff_id: form.staff_id,
        event_type: form.event_type,
        outcome: form.event_type === 'call' ? form.outcome : undefined,
        duration_seconds: form.event_type === 'call' && form.duration ? Math.round(Number(form.duration)) : undefined,
        notes: form.notes.trim() || undefined,
        occurred_at: now,
      })

      toast('success', 'Frontdesk activity logged')
      onClose()
    } catch {
      toast('error', 'Failed to log activity')
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
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl mx-4"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <PhoneCall size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-syne font-semibold text-lg">Log Frontdesk Activity</h3>
                  <p className="text-xs text-gray-400">Capture calls, follow-ups, and walk-ins</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="+91 98765 43210"
                  />
                  {matchedLead && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Using existing lead: {[matchedLead.first_name, matchedLead.last_name].filter(Boolean).join(' ') || 'Lead'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
                  {matchedLead ? (
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600">
                      {sourceOptions.find((option) => option.value === matchedLead.source)?.label ?? matchedLead.source}
                    </div>
                  ) : (
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {sourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {!matchedLead && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name (optional)</label>
                    <input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name (optional)</label>
                    <input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {!matchedLead && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Owner (Staff)</label>
                  <select
                    value={form.staff_id}
                    onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select staff</option>
                    {users.filter((u) => u.is_active).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email} - {user.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    {eventOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.event_type === 'call' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Call Outcome</label>
                    <select
                      value={form.outcome}
                      onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {callOutcomes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Call Duration (sec)</label>
                    <input
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      type="number"
                      min={0}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {form.event_type === 'visit' && (
                <p className="text-xs text-emerald-600">
                  This visit will mark the lead as attended in analytics.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSaving}
              className="mt-6 w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <LoadingSpinner size="sm" /> : <PhoneCall size={16} />}
              {isSaving ? 'Saving...' : 'Log Activity'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
