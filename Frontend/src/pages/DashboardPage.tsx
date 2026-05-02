import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserPlus, CreditCard, FileText, AlertTriangle,
  TrendingUp, Users, Clock, Percent, ArrowRight,
} from 'lucide-react'
import { useMembers, useMemberships, useInvoices, usePayments, useOutboxEvents, useTenantProfile, usePlans } from '@/hooks/useApi'
import { MemberAvatar } from '@/components/shared/MemberAvatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AddMemberModal } from '@/components/modals/AddMemberModal'
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal'
import { formatPaise, getGreeting, formatFullDate, relativeTime, isWithinDays } from '@/lib/utils'

function AnimatedCounter({ value, prefix = '', suffix = '', isCurrency = false }: { value: number; prefix?: string; suffix?: string; isCurrency?: boolean }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let cancelled = false
    const duration = 1200
    const startTime = performance.now()
    const animate = (now: number) => {
      if (cancelled) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(value * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
    return () => { cancelled = true }
  }, [value])

  return (
    <span className="font-syne font-bold text-2xl">
      {isCurrency ? formatPaise(display) : `${prefix}${Math.round(display).toLocaleString('en-IN')}${suffix}`}
    </span>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: tenant } = useTenantProfile()
  const { data: members } = useMembers()
  const { data: memberships } = useMemberships()
  const { data: invoices } = useInvoices()
  const { data: payments } = usePayments()
  const { data: outboxEvents } = useOutboxEvents()
  const { data: plans } = usePlans()
  const [showAddMember, setShowAddMember] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  // KPI computations
  const kpis = useMemo(() => {
    const monthInvoices = invoices?.filter((i) => i.issued_at >= monthStart) || []
    const paidInvoices = monthInvoices.filter((i) => i.status === 'paid')
    const monthRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total_paise), 0)
    const activeMembers = memberships?.filter((m) => m.status === 'active').length || 0
    const expiringThisWeek = memberships?.filter(
      (m) => m.status === 'active' && isWithinDays(m.end_date, 7),
    ).length || 0
    const collectionRate = monthInvoices.length > 0
      ? Math.round((paidInvoices.length / monthInvoices.length) * 100)
      : 0

    return { monthRevenue, activeMembers, expiringThisWeek, collectionRate }
  }, [invoices, memberships, monthStart])

  // Recent activity feed
  const activityFeed = useMemo(() => {
    const activities: Array<{
      id: string
      type: string
      memberName: string
      firstName: string
      lastName: string
      detail: string
      amount?: number
      time: string
    }> = []

    // Recent payments
    payments?.slice(0, 5).forEach((p) => {
      const inv = invoices?.find((i) => i.id === p.invoice_id)
      const member = inv ? members?.find((m) => m.id === inv.member_id) : null
      if (member) {
        activities.push({
          id: `p-${p.id}`,
          type: 'payment',
          memberName: `${member.first_name} ${member.last_name}`,
          firstName: member.first_name,
          lastName: member.last_name,
          detail: 'Payment received',
          amount: Number(p.amount_paise),
          time: p.paid_at || p.created_at,
        })
      }
    })

    // Recent memberships changes
    memberships?.filter((m) => m.status === 'frozen' || m.status === 'cancelled').slice(0, 3).forEach((m) => {
      const member = members?.find((mem) => mem.id === m.member_id)
      if (member) {
        activities.push({
          id: `m-${m.id}`,
          type: 'membership',
          memberName: `${member.first_name} ${member.last_name}`,
          firstName: member.first_name,
          lastName: member.last_name,
          detail: `Membership ${m.status}`,
          time: m.created_at,
        })
      }
    })

    // Delivered WhatsApp events
    outboxEvents?.filter((e) => e.status === 'delivered').slice(0, 3).forEach((e) => {
      activities.push({
        id: `o-${e.id}`,
        type: 'whatsapp',
        memberName: 'System',
        firstName: 'W',
        lastName: 'A',
        detail: 'WhatsApp sent',
        time: e.created_at,
      })
    })

    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8)
  }, [payments, memberships, outboxEvents, invoices, members])

  const expiringMemberships = memberships?.filter(
    (m) => m.status === 'active' && isWithinDays(m.end_date, 7),
  ) || []

  const kpiCards: Array<{
    label: string
    value: number
    prefix?: string
    suffix?: string
    isCurrency?: boolean
    icon: any
    color: string
  }> = [
    {
      label: 'Monthly Revenue',
      value: kpis.monthRevenue,
      isCurrency: true,
      icon: TrendingUp,
      color: '#00B894',
    },
    {
      label: 'Active Members',
      value: kpis.activeMembers,
      icon: Users,
      color: '#00B894',
    },
    {
      label: 'Expiring This Week',
      value: kpis.expiringThisWeek,
      icon: Clock,
      color: kpis.expiringThisWeek > 0 ? '#F39C12' : '#00B894',
    },
    {
      label: 'Collection Rate',
      value: kpis.collectionRate,
      suffix: '%',
      icon: Percent,
      color: kpis.collectionRate >= 80 ? '#00B894' : '#F39C12',
    },
  ]

  const typeBadges: Record<string, { label: string; color: string }> = {
    payment: { label: 'Payment', color: 'bg-emerald-50 text-emerald-700' },
    membership: { label: 'Status', color: 'bg-blue-50 text-blue-700' },
    whatsapp: { label: 'WhatsApp', color: 'bg-green-50 text-green-700' },
  }

  return (
    <div className="p-8">
      {/* Topbar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">
            {getGreeting()}, {tenant?.name || 'Gym'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatFullDate(today.toISOString())}
          </p>
        </div>
        <button
          onClick={() => setShowAddMember(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
        >
          <UserPlus size={16} />
          Add Member
        </button>
      </div>

      {/* Alert Banner */}
      {expiringMemberships.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-5 py-3.5 rounded-lg flex items-center gap-3"
          style={{ backgroundColor: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.2)' }}
        >
          <AlertTriangle size={18} style={{ color: '#F39C12' }} />
          <p className="text-sm text-gray-700 flex-1">
            <strong>{expiringMemberships.length} memberships</strong> expiring within 7 days — renewal nudges queued via WhatsApp
          </p>
          <button
            onClick={() => navigate('/members?filter=expiring')}
            className="text-sm font-medium flex items-center gap-1 transition-colors"
            style={{ color: '#F39C12' }}
          >
            View <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="bg-white border rounded-xl p-5 relative overflow-hidden"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <AnimatedCounter
              value={kpi.value}
              prefix={kpi.prefix}
              suffix={kpi.suffix}
              isCurrency={kpi.isCurrency}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: kpi.color }}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div>
          <h2 className="font-syne font-semibold text-lg mb-4">Recent Activity</h2>
          <div className="space-y-1">
            {activityFeed.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No recent activity</p>
            )}
            {activityFeed.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MemberAvatar firstName={item.firstName} lastName={item.lastName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.memberName}</p>
                  <p className="text-xs text-gray-400">{relativeTime(item.time)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadges[item.type]?.color || 'bg-gray-50 text-gray-600'}`}>
                  {typeBadges[item.type]?.label || item.type}
                </span>
                {item.amount && (
                  <span className="text-sm font-syne font-bold text-emerald-600">
                    {formatPaise(item.amount)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-syne font-semibold text-lg mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: UserPlus, label: 'Enroll New Member', desc: 'Add and assign a plan', onClick: () => setShowAddMember(true), color: '#00B894' },
              { icon: CreditCard, label: 'Record Payment', desc: 'Manual payment entry', onClick: () => setShowRecordPayment(true), color: '#0984E3' },
              { icon: FileText, label: 'Create Invoice', desc: 'Generate GST invoice', onClick: () => navigate('/billing'), color: '#6C5CE7' },
              { icon: Clock, label: 'View Expiring', desc: `${kpis.expiringThisWeek} expiring soon`, onClick: () => navigate('/members?filter=expiring'), color: '#F39C12' },
            ].map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                onClick={action.onClick}
                className="flex items-start gap-3 p-4 border rounded-xl text-left hover:shadow-sm transition-all active:scale-[0.98] group"
                style={{ borderColor: 'rgba(0,0,0,0.08)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${action.color}12` }}>
                  <action.icon size={18} style={{ color: action.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} />
      <RecordPaymentModal open={showRecordPayment} onClose={() => setShowRecordPayment(false)} />
    </div>
  )
}
