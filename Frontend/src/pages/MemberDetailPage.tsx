import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Edit2, Snowflake, XCircle, CreditCard,
  CheckCircle, Clock, AlertTriangle, MessageCircle, Save,
} from 'lucide-react'
import { useMember, useMemberships, useInvoices, useAttendance, useOutboxEvents, usePlans, useUpdateMember, useUpdateMembership, useDownloadInvoicePdf, useCreatePayment } from '@/hooks/useApi'
import { MemberAvatar } from '@/components/shared/MemberAvatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal'
import { FreezeMembershipModal } from '@/components/modals/FreezeMembershipModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/shared/Toast'
import { formatPaise, formatDate, relativeTime, dateProgressPercent, daysUntil, intervalLabel } from '@/lib/utils'

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: member, isLoading } = useMember(id!)
  const { data: memberships } = useMemberships()
  const { data: invoices } = useInvoices()
  const { data: plans } = usePlans()
  const { data: attendance } = useAttendance()
  const { data: outboxEvents } = useOutboxEvents()
  const updateMember = useUpdateMember()
  const updateMembership = useUpdateMembership()
  const downloadPdf = useDownloadInvoicePdf()
  const createPayment = useCreatePayment()

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [showFreeze, setShowFreeze] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const membership = memberships?.find((m) => m.member_id === id)
  const plan = membership ? plans?.find((p) => p.id === membership.plan_id) : null
  const memberInvoices = invoices?.filter((i) => i.member_id === id) || []
  const memberAttendance = attendance
    ?.filter((a) => a.member_id === id)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 10) || []
  const memberOutbox = outboxEvents
    ?.filter((e) => {
      const payload = e.payload as Record<string, unknown>
      return payload?.member_id === id
    })
    .slice(0, 10) || []

  const startEdit = () => {
    if (member) {
      setEditData({
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
        email: member.email || '',
      })
      setEditing(true)
    }
  }

  const saveEdit = async () => {
    try {
      await updateMember.mutateAsync({ id: id!, ...editData })
      toast('success', 'Member updated')
      setEditing(false)
    } catch {
      toast('error', 'Failed to update member')
    }
  }

  const handleUnfreeze = async () => {
    if (!membership) return
    try {
      await updateMembership.mutateAsync({ id: membership.id, status: 'active' })
      toast('success', 'Membership activated')
    } catch {
      toast('error', 'Failed to unfreeze')
    }
  }

  const handleCancel = async () => {
    if (!membership) return
    try {
      await updateMembership.mutateAsync({ id: membership.id, status: 'cancelled' })
      toast('success', 'Membership cancelled')
      setShowCancel(false)
    } catch {
      toast('error', 'Failed to cancel membership')
    }
  }

  const markPaid = async (invoiceId: string, totalPaise: number) => {
    try {
      await createPayment.mutateAsync({
        invoice_id: invoiceId,
        amount_paise: totalPaise,
        provider: 'manual',
      })
      toast('success', 'Invoice marked as paid')
    } catch {
      toast('error', 'Failed to mark as paid')
    }
  }

  if (isLoading || !member) {
    return (
      <div className="p-8">
        <div className="skeleton h-8 w-48 mb-6 rounded" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  const progress = membership ? dateProgressPercent(membership.start_date, membership.end_date) : 0
  const remaining = membership ? daysUntil(membership.end_date) : null

  return (
    <div className="p-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/members')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Members
      </button>

      <div className="grid grid-cols-5 gap-8">
        {/* LEFT COLUMN (60%) */}
        <div className="col-span-3 space-y-6">
          {/* Member Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border rounded-xl p-6"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-start gap-4">
              <MemberAvatar firstName={member.first_name} lastName={member.last_name} size="lg" />
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                      <input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full" />
                    <input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full" placeholder="Email" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-[#00B894] text-white rounded-lg text-xs font-medium">
                        <Save size={14} /> Save
                      </button>
                      <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-500 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <h2 className="font-syne font-bold text-xl">{member.first_name} {member.last_name}</h2>
                      <StatusBadge status={membership?.status || member.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{member.phone} {member.email && `· ${member.email}`}</p>
                    <p className="text-xs text-gray-400 mt-1">Joined {formatDate(member.joined_at)}</p>
                  </>
                )}
              </div>
              {!editing && (
                <button onClick={startEdit} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          </motion.div>

          {/* Active Membership */}
          {membership && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border rounded-xl p-6"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <h3 className="font-syne font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">Active Membership</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-syne font-bold text-lg">{plan?.name || 'Unknown Plan'}</p>
                  <p className="text-xs text-gray-400">{plan ? intervalLabel(plan.billing_interval) : '-'}</p>
                </div>
                <StatusBadge status={membership.status} />
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{formatDate(membership.start_date)}</span>
                  <span>{formatDate(membership.end_date)}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: remaining !== null && remaining <= 7 ? '#E74C3C' : '#00B894' }} />
                </div>
              </div>
              <p className={`text-sm font-bold ${remaining !== null && remaining <= 7 ? 'text-red-600' : 'text-gray-700'}`}>
                {remaining !== null ? `${remaining} days remaining` : '—'}
              </p>

              <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                {membership.status === 'active' && (
                  <button onClick={() => setShowFreeze(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    <Snowflake size={14} /> Freeze
                  </button>
                )}
                {membership.status === 'frozen' && (
                  <button onClick={handleUnfreeze} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                    <Snowflake size={14} /> Unfreeze
                  </button>
                )}
                {membership.status !== 'cancelled' && (
                  <button onClick={() => setShowCancel(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                    <XCircle size={14} /> Cancel
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Invoice History */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border rounded-xl p-6"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-syne font-semibold text-sm text-gray-500 uppercase tracking-wider">Invoice History</h3>
              <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00B894] text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors">
                <CreditCard size={14} /> Add Payment
              </button>
            </div>
            {memberInvoices.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No invoices yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <th className="text-left py-2 text-xs font-medium text-gray-400">Invoice No</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-400">Date</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-400">Amount</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-400">Status</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  {memberInvoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 text-sm font-mono text-[#0984E3]">{inv.invoice_number}</td>
                      <td className="py-2.5 text-sm text-gray-500">{formatDate(inv.issued_at)}</td>
                      <td className="py-2.5 text-sm font-syne font-bold">{formatPaise(inv.total_paise)}</td>
                      <td className="py-2.5"><StatusBadge status={inv.status} /></td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => downloadPdf.mutate(inv.id)} className="text-xs text-[#0984E3] hover:underline">PDF</button>
                          {inv.status === 'pending' && (
                            <button onClick={() => markPaid(inv.id, inv.total_paise)} className="text-xs text-emerald-600 hover:underline">Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="col-span-2 space-y-6">
          {/* Attendance Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white border rounded-xl p-6"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <h3 className="font-syne font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">Attendance</h3>
            {memberAttendance.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No recent visits</p>
            ) : (
              <div className="space-y-2">
                {memberAttendance.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${a.event_type === 'check_in' ? 'bg-emerald-50' : a.event_type === 'denied' ? 'bg-red-50' : 'bg-gray-50'}`}>
                      {a.event_type === 'check_in' ? <CheckCircle size={14} className="text-emerald-500" /> :
                        a.event_type === 'denied' ? <AlertTriangle size={14} className="text-red-500" /> :
                        <Clock size={14} className="text-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 capitalize">{a.event_type.replace('_', ' ')}</p>
                    </div>
                    <span className="text-xs text-gray-400">{relativeTime(a.occurred_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* WhatsApp Activity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white border rounded-xl p-6"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <h3 className="font-syne font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">WhatsApp Activity</h3>
            {memberOutbox.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No messages sent</p>
            ) : (
              <div className="space-y-2">
                {memberOutbox.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <MessageCircle size={16} className={e.status === 'delivered' ? 'text-emerald-500' : 'text-amber-500'} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{e.event_type}</p>
                    </div>
                    <StatusBadge status={e.status} />
                    <span className="text-xs text-gray-400">{relativeTime(e.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      {membership && (
        <FreezeMembershipModal
          open={showFreeze}
          onClose={() => setShowFreeze(false)}
          membershipId={membership.id}
        />
      )}
      <RecordPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        preselectedMemberId={id}
      />
      <ConfirmDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        title="Cancel Membership"
        description="This will permanently cancel the membership. The member will lose access immediately. This action cannot be undone."
        confirmLabel="Cancel Membership"
        destructive
      />
    </div>
  )
}
