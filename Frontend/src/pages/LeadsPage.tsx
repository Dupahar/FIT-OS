import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, PhoneCall, UserPlus, FileDown, ClipboardCheck, X } from 'lucide-react'
import {
  useLeads,
  useLeadEvents,
  useUsers,
  useCreateLeadEvent,
} from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FrontdeskLogModal } from '@/components/modals/FrontdeskLogModal'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { Lead } from '@/types'

type LeadStatus = 'all' | 'new' | 'contacted' | 'attended' | 'converted' | 'lost'
type LeadSource = 'all' | 'call' | 'frontdesk' | 'walk_in' | 'whatsapp' | 'referral' | 'other'

const leadStatusLabels: Record<Exclude<LeadStatus, 'all'>, string> = {
  new: 'New',
  contacted: 'Contacted',
  attended: 'Attended',
  converted: 'Converted',
  lost: 'Lost',
}

const leadSourceLabels: Record<Exclude<LeadSource, 'all'>, string> = {
  call: 'Call',
  frontdesk: 'Frontdesk',
  walk_in: 'Walk-in',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  other: 'Other',
}

const callOutcomes = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'wrong_number', label: 'Wrong Number' },
]

export default function LeadsPage() {
  const { toast } = useToast()
  const { data: leads } = useLeads()
  const { data: leadEvents } = useLeadEvents()
  const { data: users } = useUsers()
  const createLeadEvent = useCreateLeadEvent()
  const role = useAuthStore((s) => s.user_role)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('all')
  const [sourceFilter, setSourceFilter] = useState<LeadSource>('all')
  const [showFrontdeskLog, setShowFrontdeskLog] = useState(false)
  const [eventModal, setEventModal] = useState<{
    open: boolean
    type?: 'call' | 'follow_up'
    lead?: Lead
  }>({ open: false })
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean
    type?: 'visit' | 'conversion'
    lead?: Lead
  }>({ open: false })

  const leadList = leads ?? []
  const leadEventList = leadEvents ?? []
  const userList = users ?? []

  const userById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of userList) {
      map.set(user.id, user.email)
    }
    return map
  }, [userList])

  const lastEventByLead = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of leadEventList) {
      const current = map.get(event.lead_id)
      if (!current || new Date(event.occurred_at) > new Date(current)) {
        map.set(event.lead_id, event.occurred_at)
      }
    }
    return map
  }, [leadEventList])

  const statusCounts = useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      all: leadList.length,
      new: 0,
      contacted: 0,
      attended: 0,
      converted: 0,
      lost: 0,
    }
    for (const lead of leadList) {
      counts[lead.status] += 1
    }
    return counts
  }, [leadList])

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()
    return leadList.filter((lead) => {
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter
      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').toLowerCase()
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        lead.phone.toLowerCase().includes(query) ||
        (lead.email || '').toLowerCase().includes(query)
      return matchesStatus && matchesSource && matchesSearch
    })
  }, [leadList, search, statusFilter, sourceFilter])

  const exportLeads = async (format: 'csv' | 'pdf') => {
    try {
      const url = format === 'csv' ? '/v1/leads/export' : '/v1/leads/export/pdf'
      const res = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([res.data])
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.setAttribute('download', format === 'csv' ? 'leads-export.csv' : 'leads-report.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(link.href)
    } catch {
      toast('error', 'Failed to export leads')
    }
  }

  const handleQuickEvent = async (lead: Lead, type: 'visit' | 'conversion') => {
    try {
      await createLeadEvent.mutateAsync({
        lead_id: lead.id,
        event_type: type === 'visit' ? 'visit' : 'conversion',
        occurred_at: new Date().toISOString(),
      })
      toast('success', type === 'visit' ? 'Lead marked attended' : 'Lead converted')
    } catch {
      toast('error', 'Failed to update lead')
    } finally {
      setConfirmAction({ open: false })
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track every call, visit, and conversion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role === 'owner' && (
            <>
              <button
                onClick={() => exportLeads('csv')}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FileDown size={14} /> Export CSV
              </button>
              <button
                onClick={() => exportLeads('pdf')}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ClipboardCheck size={14} /> Export PDF
              </button>
            </>
          )}
          <button
            onClick={() => setShowFrontdeskLog(true)}
            className="px-3 py-2 bg-[#00B894] hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-2"
          >
            <UserPlus size={14} /> Log Activity
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100">
        {(['all', 'new', 'contacted', 'attended', 'converted', 'lost'] as LeadStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              statusFilter === status ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {status === 'all' ? 'All' : leadStatusLabels[status]}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === status ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {statusCounts[status]}
            </span>
            {statusFilter === status && (
              <motion.div layoutId="leadTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All</option>
            {Object.entries(leadSourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        {filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No leads found for this filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {filteredLeads.map((lead, i) => {
                const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'
                const lastEvent = lastEventByLead.get(lead.id)
                return (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{name}</p>
                        <p className="text-xs text-gray-400">{lead.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {leadSourceLabels[lead.source] ?? lead.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {leadStatusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.assigned_staff_id ? userById.get(lead.assigned_staff_id) ?? 'Staff' : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {lastEvent ? new Date(lastEvent).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEventModal({ open: true, lead, type: 'call' })}
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => setEventModal({ open: true, lead, type: 'follow_up' })}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Follow-up
                        </button>
                        <button
                          onClick={() => setConfirmAction({ open: true, lead, type: 'visit' })}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          Attended
                        </button>
                        <button
                          onClick={() => setConfirmAction({ open: true, lead, type: 'conversion' })}
                          className="text-xs text-gray-900 hover:underline"
                        >
                          Convert
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <LeadEventModal
        open={eventModal.open}
        lead={eventModal.lead}
        type={eventModal.type}
        onClose={() => setEventModal({ open: false })}
        onSave={async (payload) => {
          try {
            await createLeadEvent.mutateAsync(payload)
            toast('success', 'Lead activity logged')
            setEventModal({ open: false })
          } catch {
            toast('error', 'Failed to log activity')
          }
        }}
        isSaving={createLeadEvent.isPending}
      />

      <ConfirmDialog
        open={confirmAction.open}
        onClose={() => setConfirmAction({ open: false })}
        onConfirm={() => {
          if (confirmAction.lead && confirmAction.type) {
            handleQuickEvent(confirmAction.lead, confirmAction.type)
          }
        }}
        title={confirmAction.type === 'conversion' ? 'Mark Lead as Converted' : 'Mark Lead as Attended'}
        description={
          confirmAction.type === 'conversion'
            ? 'This will log a conversion event and mark the lead as converted.'
            : 'This will log a visit event and mark the lead as attended.'
        }
        confirmLabel={confirmAction.type === 'conversion' ? 'Convert Lead' : 'Mark Attended'}
        destructive={confirmAction.type === 'conversion'}
        loading={createLeadEvent.isPending}
      />

      <FrontdeskLogModal
        open={showFrontdeskLog}
        onClose={() => setShowFrontdeskLog(false)}
        leads={leadList}
        users={userList}
      />
    </div>
  )
}

function LeadEventModal({
  open,
  lead,
  type,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean
  lead?: Lead
  type?: 'call' | 'follow_up'
  onClose: () => void
  onSave: (payload: {
    lead_id: string
    event_type: 'call' | 'follow_up'
    outcome?: string
    duration_seconds?: number
    notes?: string
    occurred_at?: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    outcome: 'connected',
    duration: '',
    notes: '',
  })

  useEffect(() => {
    if (!open) return
    setForm({
      outcome: 'connected',
      duration: '',
      notes: '',
    })
  }, [open, lead?.id, type])

  if (!open || !lead || !type) return null

  const handleSubmit = () => {
    onSave({
      lead_id: lead.id,
      event_type: type,
      outcome: type === 'call' ? form.outcome : undefined,
      duration_seconds: type === 'call' && form.duration ? Math.round(Number(form.duration)) : undefined,
      notes: form.notes.trim() || undefined,
      occurred_at: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-syne font-semibold text-lg">
              {type === 'call' ? 'Log Call' : 'Log Follow-up'}
            </h3>
            <p className="text-xs text-gray-400">
              {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'} - {lead.phone}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {type === 'call' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
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
          )}
          {type === 'call' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (sec)</label>
              <input
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
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
          disabled={isSaving}
          className="mt-5 w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : <PhoneCall size={16} />}
          {isSaving ? 'Saving...' : 'Save Activity'}
        </button>
      </div>
    </div>
  )
}
