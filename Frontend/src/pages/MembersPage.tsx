import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, UserPlus, Users, PhoneCall } from 'lucide-react'
import { useMembers, useMemberships, useInvoices, useAttendance, usePlans, useLeads, useUsers } from '@/hooks/useApi'
import { MemberAvatar } from '@/components/shared/MemberAvatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AddMemberModal } from '@/components/modals/AddMemberModal'
import { FrontdeskLogModal } from '@/components/modals/FrontdeskLogModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatPaise, formatDate, relativeTime, isWithinDays, daysUntil } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

type FilterTab = 'all' | 'active' | 'expiring' | 'frozen' | 'cancelled'

export default function MembersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: members, isLoading } = useMembers()
  const { data: memberships } = useMemberships()
  const { data: invoices } = useInvoices()
  const { data: attendance } = useAttendance()
  const { data: plans } = usePlans()
  const role = useAuthStore((s) => s.user_role)
  const canLogFrontdesk = role === 'owner' || role === 'staff'
  const { data: leads } = useLeads({ enabled: canLogFrontdesk })
  const { data: users } = useUsers({ enabled: canLogFrontdesk })
  const [search, setSearch] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showFrontdeskLog, setShowFrontdeskLog] = useState(false)
  const initialFilter = (searchParams.get('filter') as FilterTab) || 'all'
  const [activeTab, setActiveTab] = useState<FilterTab>(initialFilter)

  // Compute member data with status enrichment
  const enrichedMembers = useMemo(() => {
    if (!members) return []
    return members.map((m) => {
      const membership = memberships?.find((ms) => ms.member_id === m.id)
      const plan = membership ? plans?.find((p) => p.id === membership.plan_id) : null
      const memberInvoices = invoices?.filter((i) => i.member_id === m.id) || []
      const outstanding = memberInvoices
        .filter((i) => i.status === 'pending')
        .reduce((sum, i) => sum + Number(i.total_paise), 0)
      const lastVisit = attendance
        ?.filter((a) => a.member_id === m.id && a.event_type === 'check_in')
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0]
      
      let effectiveStatus: string = membership?.status || m.status
      if (membership?.status === 'active' && membership.end_date && isWithinDays(membership.end_date, 7)) {
        effectiveStatus = 'expiring'
      }

      return {
        ...m,
        membership,
        plan,
        outstanding,
        lastVisit,
        effectiveStatus,
        endDate: membership?.end_date,
        daysLeft: membership?.end_date ? daysUntil(membership.end_date) : null,
      }
    })
  }, [members, memberships, invoices, attendance, plans])

  // Filter counts
  const counts = useMemo(() => ({
    all: enrichedMembers.length,
    active: enrichedMembers.filter((m) => m.effectiveStatus === 'active').length,
    expiring: enrichedMembers.filter((m) => m.effectiveStatus === 'expiring').length,
    frozen: enrichedMembers.filter((m) => m.effectiveStatus === 'frozen').length,
    cancelled: enrichedMembers.filter((m) => m.effectiveStatus === 'cancelled').length,
  }), [enrichedMembers])

  // Apply filters
  const filtered = useMemo(() => {
    let result = enrichedMembers
    if (activeTab !== 'all') {
      result = result.filter((m) => m.effectiveStatus === activeTab)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          (m.first_name?.toLowerCase() || '').includes(q) ||
          (m.last_name?.toLowerCase() || '').includes(q) ||
          m.phone.includes(q),
      )
    }
    return result
  }, [enrichedMembers, activeTab, search])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'expiring', label: 'Expiring' },
    { key: 'frozen', label: 'Frozen' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="p-8">
      {/* Topbar */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Members</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {counts.active} active · {counts.expiring} expiring · {counts.frozen} frozen
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
          >
            <UserPlus size={16} />
            Add Member
          </button>
          {canLogFrontdesk && (
            <button
              onClick={() => setShowFrontdeskLog(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <PhoneCall size={16} />
              Log Call/Visit
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100 mt-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              activeTab === tab.key
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[tab.key]}
            </span>
            {activeTab === tab.key && (
              <motion.div
                layoutId="memberTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="No members match your current filters. Try adjusting your search or add your first member."
          action={
            <button
              onClick={() => setShowAddMember(true)}
              className="px-4 py-2 bg-[#00B894] text-white text-sm rounded-lg font-medium"
            >
              Add Member
            </button>
          }
        />
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ends</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Visit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {filtered.map((m, i) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/members/${m.id}`)}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <MemberAvatar firstName={m.first_name} lastName={m.last_name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-400">{m.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.effectiveStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.plan?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${m.daysLeft !== null && m.daysLeft <= 7 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {m.endDate ? formatDate(m.endDate) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-syne font-bold ${m.outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {m.outstanding > 0 ? formatPaise(m.outstanding) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {m.lastVisit ? relativeTime(m.lastVisit.occurred_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs font-medium text-[#0984E3] hover:underline">
                      View
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} />
      {canLogFrontdesk && (
        <FrontdeskLogModal
          open={showFrontdeskLog}
          onClose={() => setShowFrontdeskLog(false)}
          leads={leads ?? []}
          users={users ?? []}
        />
      )}
    </div>
  )
}
