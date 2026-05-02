import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, TrendingUp, Users, MessageCircle, AlertTriangle, PhoneCall } from 'lucide-react'
import {
  useInvoices,
  useMembers,
  useMemberships,
  usePlans,
  useAttendance,
  useOutboxEvents,
  useLeads,
  useLeadEvents,
  useUsers,
} from '@/hooks/useApi'
import { formatPaise } from '@/lib/utils'
import { FrontdeskLogModal } from '@/components/modals/FrontdeskLogModal'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabels = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6
  return hour <= 12 ? `${hour}am` : `${hour - 12}pm`
})

const intervalLabels: Record<string, string> = {
  monthly: '1 month',
  quarterly: '3 months',
  semiannual: '6 months',
  annual: '12 months',
  custom: 'custom',
}

const leadSourceLabels: Record<string, string> = {
  call: 'Call',
  frontdesk: 'Frontdesk',
  walk_in: 'Walk-in',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  other: 'Other',
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export default function AnalyticsPage() {
  const { data: invoices } = useInvoices()
  const { data: members } = useMembers()
  const { data: memberships } = useMemberships()
  const { data: plans } = usePlans()
  const { data: attendance } = useAttendance()
  const { data: outboxEvents } = useOutboxEvents()
  const { data: leads } = useLeads()
  const { data: leadEvents } = useLeadEvents()
  const { data: users } = useUsers()
  const [showFrontdeskLog, setShowFrontdeskLog] = useState(false)

  const invoiceList = invoices ?? []
  const memberList = members ?? []
  const membershipList = memberships ?? []
  const planList = plans ?? []
  const attendanceList = attendance ?? []
  const outboxList = outboxEvents ?? []
  const leadList = leads ?? []
  const leadEventList = leadEvents ?? []
  const userList = users ?? []

  const userById = useMemo(() => {
    const map = new Map<string, typeof userList[number]>()
    for (const user of userList) {
      map.set(user.id, user)
    }
    return map
  }, [userList])

  const leadById = useMemo(() => {
    const map = new Map<string, typeof leadList[number]>()
    for (const lead of leadList) {
      map.set(lead.id, lead)
    }
    return map
  }, [leadList])

  const planById = useMemo(() => {
    const map = new Map<string, typeof planList[number]>()
    for (const plan of planList) {
      map.set(plan.id, plan)
    }
    return map
  }, [planList])

  const membershipsByMember = useMemo(() => {
    const map = new Map<string, typeof membershipList>()
    for (const membership of membershipList) {
      const list = map.get(membership.member_id) ?? []
      list.push(membership)
      map.set(membership.member_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aStart = parseDate(a.start_date)?.getTime() ?? 0
        const bStart = parseDate(b.start_date)?.getTime() ?? 0
        return bStart - aStart
      })
    }
    return map
  }, [membershipList])

  const recentWindowStart = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const recentInvoices = useMemo(() => {
    return invoiceList.filter((invoice) => {
      const issuedAt = parseDate(invoice.issued_at)
      return issuedAt ? issuedAt >= recentWindowStart : false
    })
  }, [invoiceList, recentWindowStart])

  const activeMemberships = useMemo(
    () => membershipList.filter((membership) => membership.status === 'active'),
    [membershipList],
  )

  const projectedMRR = useMemo(() => {
    return activeMemberships.reduce((sum, membership) => {
      const plan = planById.get(membership.plan_id)
      if (!plan) return sum
      const price = Number(plan.price_paise) || 0
      switch (plan.billing_interval) {
        case 'quarterly':
          return sum + price / 3
        case 'semiannual':
          return sum + price / 6
        case 'annual':
          return sum + price / 12
        default:
          return sum + price
      }
    }, 0)
  }, [activeMemberships, planById])

  const attendanceLast30 = useMemo(() => {
    return attendanceList.filter((event) => {
      const occurredAt = parseDate(event.occurred_at)
      return occurredAt ? occurredAt >= recentWindowStart : false
    })
  }, [attendanceList, recentWindowStart])

  const avgVisitsPerWeek = useMemo(() => {
    const totalVisits = attendanceLast30.filter((event) => event.event_type === 'check_in').length
    if (!activeMemberships.length) return 0
    return Number((totalVisits / activeMemberships.length / 4).toFixed(1))
  }, [attendanceLast30, activeMemberships])

  const revenueSummary = useMemo(() => {
    const invoiced = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.total_paise || 0), 0)
    const collected = recentInvoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.total_paise || 0), 0)
    const collectionRate = invoiced ? Math.round((collected / invoiced) * 100) : 0
    return { invoiced, collected, collectionRate }
  }, [recentInvoices])

  const monthlyRevenue = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return date
    })

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthInvoices = invoiceList.filter((invoice) => {
        const issuedAt = parseDate(invoice.issued_at)
        return issuedAt ? issuedAt >= monthStart && issuedAt <= monthEnd : false
      })
      const invoiced = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total_paise || 0), 0)
      const collected = monthInvoices
        .filter((invoice) => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + Number(invoice.total_paise || 0), 0)
      const rate = invoiced ? Math.round((collected / invoiced) * 100) : 0
      return { label: monthLabel(monthStart), invoiced, collected, rate }
    })
  }, [invoiceList])

  const planMix = useMemo(() => {
    const buckets = {
      monthly: { revenue: 0, active: 0 },
      quarterly: { revenue: 0, active: 0 },
      semiannual: { revenue: 0, active: 0 },
      annual: { revenue: 0, active: 0 },
      custom: { revenue: 0, active: 0 },
    }

    for (const membership of activeMemberships) {
      const plan = planById.get(membership.plan_id)
      if (!plan) continue
      if (buckets[plan.billing_interval]) {
        buckets[plan.billing_interval].active += 1
      }
    }

    for (const invoice of recentInvoices) {
      const list = membershipsByMember.get(invoice.member_id) ?? []
      const issuedAt = parseDate(invoice.issued_at)
      if (!issuedAt || !list.length) continue
      const membership = list.find((entry) => {
        const start = parseDate(entry.start_date)
        const end = parseDate(entry.end_date)
        if (!start || !end) return false
        return issuedAt >= start && issuedAt <= end
      }) ?? list[0]
      const plan = planById.get(membership.plan_id)
      if (!plan) continue
      if (buckets[plan.billing_interval]) {
        buckets[plan.billing_interval].revenue += Number(invoice.total_paise || 0)
      }
    }

    return Object.entries(buckets).map(([interval, stats]) => ({
      interval,
      label: intervalLabels[interval] ?? interval,
      revenue: stats.revenue,
      active: stats.active,
    }))
  }, [activeMemberships, planById, recentInvoices, membershipsByMember])

  const memberGrowth = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      return new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    })

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const newEnrollments = memberList.filter((member) => {
        const createdAt = parseDate(member.created_at)
        return createdAt ? createdAt >= monthStart && createdAt <= monthEnd : false
      }).length
      const churned = membershipList.filter((membership) => {
        if (membership.status !== 'cancelled') return false
        const endedAt = parseDate(membership.end_date)
        return endedAt ? endedAt >= monthStart && endedAt <= monthEnd : false
      }).length
      const active = membershipList.filter((membership) => {
        if (membership.status === 'cancelled') return false
        const start = parseDate(membership.start_date)
        const end = parseDate(membership.end_date)
        if (!start || !end) return false
        return start <= monthEnd && end >= monthStart
      }).length
      return {
        label: monthLabel(monthStart),
        newEnrollments,
        churned,
        netChange: newEnrollments - churned,
        active,
      }
    })
  }, [memberList, membershipList])

  const churnRisk = useMemo(() => {
    const lastSeenMap = new Map<string, Date>()
    for (const event of attendanceList) {
      const occurredAt = parseDate(event.occurred_at)
      if (!occurredAt) continue
      const existing = lastSeenMap.get(event.member_id)
      if (!existing || occurredAt > existing) {
        lastSeenMap.set(event.member_id, occurredAt)
      }
    }

    const counts = { high: 0, medium: 0, low: 0 }
    const today = new Date()
    for (const member of memberList) {
      const lastSeen = lastSeenMap.get(member.id)
      const daysAbsent = lastSeen
        ? Math.floor((today.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
        : 999
      let tier = 'low'
      if (daysAbsent > 14) tier = 'high'
      else if (daysAbsent > 7) tier = 'medium'

      if (tier === 'low') counts.low += 1
      if (tier === 'medium') counts.medium += 1
      if (tier === 'high') counts.high += 1
    }

    return counts
  }, [attendanceList, memberList])

  const heatmap = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 16 }, () => 0))
    for (const event of attendanceList) {
      const occurredAt = parseDate(event.occurred_at)
      if (!occurredAt) continue
      const hour = occurredAt.getHours()
      if (hour < 6 || hour > 21) continue
      const dayIndex = (occurredAt.getDay() + 6) % 7
      grid[dayIndex][hour - 6] += 1
    }
    const max = Math.max(1, ...grid.flat())
    return grid.map((row) => row.map((value) => Math.round((value / max) * 100)))
  }, [attendanceList])

  const whatsappStats = useMemo(() => {
    const whatsappEvents = outboxList.filter((event) => event.event_type.startsWith('whatsapp.'))
    const now = new Date()
    const months = Array.from({ length: 4 }, (_, index) => {
      return new Date(now.getFullYear(), now.getMonth() - (3 - index), 1)
    })

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthEvents = whatsappEvents.filter((event) => {
        const createdAt = parseDate(event.created_at)
        return createdAt ? createdAt >= monthStart && createdAt <= monthEnd : false
      })
      const sent = monthEvents.length
      const delivered = monthEvents.filter((event) => event.status === 'delivered').length
      const failed = monthEvents.filter((event) => event.status === 'failed' || event.status === 'dead_letter').length
      const rate = sent ? Math.round((delivered / sent) * 100) : 0
      return { label: monthLabel(monthStart), sent, delivered, failed, rate }
    })
  }, [outboxList])

  const gstSummary = useMemo(() => {
    const taxable = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal_paise || 0), 0)
    const cgst = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.cgst_paise || 0), 0)
    const sgst = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.sgst_paise || 0), 0)
    const igst = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.igst_paise || 0), 0)
    return { taxable, cgst, sgst, igst, total: cgst + sgst + igst }
  }, [recentInvoices])

  const leadEventsLast30 = useMemo(() => {
    return leadEventList.filter((event) => {
      const occurredAt = parseDate(event.occurred_at)
      return occurredAt ? occurredAt >= recentWindowStart : false
    })
  }, [leadEventList, recentWindowStart])

  const leadFunnel = useMemo(() => {
    const created = leadList.filter((lead) => {
      const createdAt = parseDate(lead.created_at)
      return createdAt ? createdAt >= recentWindowStart : false
    })
    const attended = leadList.filter((lead) => {
      const attendedAt = parseDate(lead.attended_at)
      return attendedAt ? attendedAt >= recentWindowStart : false
    })
    const converted = leadList.filter((lead) => {
      const convertedAt = parseDate(lead.converted_at)
      return convertedAt ? convertedAt >= recentWindowStart : false
    })
    const leadToVisitRate = created.length ? Math.round((attended.length / created.length) * 100) : 0
    const visitToConversionRate = attended.length ? Math.round((converted.length / attended.length) * 100) : 0
    return {
      created: created.length,
      attended: attended.length,
      converted: converted.length,
      leadToVisitRate,
      visitToConversionRate,
    }
  }, [leadList, recentWindowStart])

  const followUpSla = useMemo(() => {
    const followUps = new Map<string, Date[]>()
    const calls: { lead_id: string; time: Date }[] = []

    for (const event of leadEventsLast30) {
      const occurredAt = parseDate(event.occurred_at)
      if (!occurredAt) continue
      if (event.event_type === 'follow_up') {
        const list = followUps.get(event.lead_id) ?? []
        list.push(occurredAt)
        followUps.set(event.lead_id, list)
      }
      if (event.event_type === 'call' && event.outcome === 'connected') {
        calls.push({ lead_id: event.lead_id, time: occurredAt })
      }
    }

    let onTime = 0
    let responded = 0
    let totalHours = 0

    for (const { lead_id, time } of calls) {
      const followUpTimes = (followUps.get(lead_id) ?? []).sort((a, b) => a.getTime() - b.getTime())
      const nextFollowUp = followUpTimes.find((entry) => entry > time)
      if (!nextFollowUp) continue
      responded += 1
      const diffHours = (nextFollowUp.getTime() - time.getTime()) / (1000 * 60 * 60)
      totalHours += diffHours
      if (diffHours <= 24) {
        onTime += 1
      }
    }

    const onTimeRate = calls.length ? Math.round((onTime / calls.length) * 100) : 0
    const avgHours = responded ? Number((totalHours / responded).toFixed(1)) : 0
    return { calls: calls.length, onTime, onTimeRate, avgHours }
  }, [leadEventsLast30])

  const attendedLeads = useMemo(() => {
    return leadList
      .filter((lead) => {
        const attendedAt = parseDate(lead.attended_at)
        return attendedAt ? attendedAt >= recentWindowStart : false
      })
      .sort((a, b) => {
        const aTime = parseDate(a.attended_at)?.getTime() ?? 0
        const bTime = parseDate(b.attended_at)?.getTime() ?? 0
        return bTime - aTime
      })
  }, [leadList, recentWindowStart])

  const convertedLeads = useMemo(() => {
    return leadList
      .filter((lead) => {
        const convertedAt = parseDate(lead.converted_at)
        return convertedAt ? convertedAt >= recentWindowStart : false
      })
      .sort((a, b) => {
        const aTime = parseDate(a.converted_at)?.getTime() ?? 0
        const bTime = parseDate(b.converted_at)?.getTime() ?? 0
        return bTime - aTime
      })
  }, [leadList, recentWindowStart])

  const revenueByMember = useMemo(() => {
    const map = new Map<string, number>()
    for (const invoice of recentInvoices) {
      if (invoice.status !== 'paid') continue
      const current = map.get(invoice.member_id) ?? 0
      map.set(invoice.member_id, current + Number(invoice.total_paise || 0))
    }
    return map
  }, [recentInvoices])

  const staffStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        id: string
        name: string
        role: string
        calls: number
        connected: number
        followUps: number
        attended: number
        conversions: number
        revenuePaise: number
      }
    >()

    const ensure = (id: string | null, fallbackName: string, fallbackRole = 'staff') => {
      const key = id ?? 'unassigned'
      if (!stats.has(key)) {
        const user = id ? userById.get(id) : undefined
        stats.set(key, {
          id: key,
          name: user?.email ?? fallbackName,
          role: user?.role ?? fallbackRole,
          calls: 0,
          connected: 0,
          followUps: 0,
          attended: 0,
          conversions: 0,
          revenuePaise: 0,
        })
      }
      return stats.get(key)!
    }

    for (const user of userList) {
      ensure(user.id, user.email, user.role)
    }

    for (const event of leadEventsLast30) {
      const lead = leadById.get(event.lead_id)
      const staffId = event.staff_id ?? lead?.assigned_staff_id ?? null
      const staff = ensure(staffId, lead?.first_name || 'Unassigned')

      if (event.event_type === 'call') {
        staff.calls += 1
        if (event.outcome === 'connected') {
          staff.connected += 1
        }
      }
      if (event.event_type === 'follow_up') {
        staff.followUps += 1
      }
      if (event.event_type === 'visit') {
        staff.attended += 1
      }
    }

    for (const lead of convertedLeads) {
      const staff = ensure(lead.assigned_staff_id, lead.first_name || 'Unassigned')
      staff.conversions += 1
      if (lead.attended_at) staff.attended += 1
      if (lead.member_id) {
        staff.revenuePaise += revenueByMember.get(lead.member_id) ?? 0
      }
    }

    return Array.from(stats.values()).filter((row) =>
      row.calls || row.followUps || row.attended || row.conversions || row.revenuePaise,
    )
  }, [userList, userById, leadEventsLast30, leadById, convertedLeads, revenueByMember])

  const frontdeskSummary = useMemo(() => {
    const calls = staffStats.reduce((sum, row) => sum + row.calls, 0)
    const connected = staffStats.reduce((sum, row) => sum + row.connected, 0)
    const followUps = staffStats.reduce((sum, row) => sum + row.followUps, 0)
    const attended = staffStats.reduce((sum, row) => sum + row.attended, 0)
    const conversions = staffStats.reduce((sum, row) => sum + row.conversions, 0)
    const revenuePaise = staffStats.reduce((sum, row) => sum + row.revenuePaise, 0)
    const connectRate = calls ? Math.round((connected / calls) * 100) : 0
    const conversionRate = connected ? Math.round((conversions / connected) * 100) : 0
    return { calls, connected, followUps, attended, conversions, revenuePaise, connectRate, conversionRate }
  }, [staffStats])

  const topCloserId = useMemo(() => {
    if (!staffStats.length) return ''
    return staffStats.reduce((best, row) => {
      const bestRate = best.connected ? best.conversions / best.connected : 0
      const rowRate = row.connected ? row.conversions / row.connected : 0
      return rowRate > bestRate ? row : best
    }).id
  }, [staffStats])

  const kpis = [
    {
      label: 'Invoiced (30d)',
      value: formatPaise(revenueSummary.invoiced),
      sub: `${recentInvoices.length} invoices`,
      icon: TrendingUp,
      color: '#0984E3',
    },
    {
      label: 'Collected (30d)',
      value: formatPaise(revenueSummary.collected),
      sub: `${revenueSummary.collectionRate}% collection rate`,
      icon: Activity,
      color: '#00B894',
    },
    {
      label: 'Active Members',
      value: `${activeMemberships.length}`,
      sub: `${avgVisitsPerWeek} visits per week`,
      icon: Users,
      color: '#6C5CE7',
    },
    {
      label: 'Projected MRR',
      value: formatPaise(projectedMRR),
      sub: 'Based on active plans',
      icon: TrendingUp,
      color: '#F39C12',
    },
  ]

  const frontdeskCards = [
    {
      label: 'Calls Logged (30d)',
      value: frontdeskSummary.calls.toLocaleString('en-IN'),
      sub: `${frontdeskSummary.connected} connected`,
      icon: PhoneCall,
      color: '#0984E3',
    },
    {
      label: 'Follow-ups',
      value: `${frontdeskSummary.followUps}`,
      sub: `${frontdeskSummary.attended} attended visits`,
      icon: Users,
      color: '#6C5CE7',
    },
    {
      label: 'Conversion Rate',
      value: `${frontdeskSummary.conversionRate}%`,
      sub: `${frontdeskSummary.conversions} conversions`,
      icon: TrendingUp,
      color: '#00B894',
    },
    {
      label: 'Revenue Influenced',
      value: formatPaise(frontdeskSummary.revenuePaise),
      sub: `${frontdeskSummary.conversions} converted leads`,
      icon: Activity,
      color: '#F39C12',
    },
  ]

  const hasInvoices = invoiceList.length > 0
  const hasAttendance = attendanceList.length > 0
  const hasOutbox = outboxList.some((event) => event.event_type.startsWith('whatsapp.'))

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-syne font-bold text-2xl text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Live operational metrics from your data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="border rounded-xl p-5 relative overflow-hidden"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{kpi.label}</p>
              <kpi.icon size={18} className="text-gray-400" />
            </div>
            <p className="font-syne font-bold text-2xl text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: kpi.color }} />
          </motion.div>
        ))}
      </div>

      <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-5">
          <div>
            <p className="font-semibold text-gray-900">Frontdesk Calling Analytics</p>
            <p className="text-xs text-gray-400">Conversion performance across renewals, trials, and walk-ins</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFrontdeskLog(true)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Log Activity
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <PhoneCall size={14} className="text-emerald-500" />
              Last 30 days
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {frontdeskCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="border rounded-xl p-4 relative overflow-hidden"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
                <card.icon size={16} className="text-gray-400" />
              </div>
              <p className="font-syne font-bold text-xl text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: card.color }} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Lead to Visit',
              value: `${leadFunnel.leadToVisitRate}%`,
              sub: `${leadFunnel.attended} of ${leadFunnel.created} leads`,
              color: '#0984E3',
            },
            {
              label: 'Visit to Conversion',
              value: `${leadFunnel.visitToConversionRate}%`,
              sub: `${leadFunnel.converted} conversions`,
              color: '#00B894',
            },
            {
              label: 'Follow-up SLA (24h)',
              value: `${followUpSla.onTimeRate}%`,
              sub: `${followUpSla.onTime} of ${followUpSla.calls} calls`,
              color: '#F39C12',
            },
            {
              label: 'Avg Follow-up',
              value: `${followUpSla.avgHours} hrs`,
              sub: 'After connected calls',
              color: '#6C5CE7',
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border rounded-xl p-4 relative overflow-hidden"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
              <p className="font-syne font-bold text-xl text-gray-900 mt-1">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: card.color }} />
            </motion.div>
          ))}
        </div>

        {staffStats.length === 0 ? (
          <p className="text-sm text-gray-400">No frontdesk activity yet. Log calls and visits to see staff performance.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Connected</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                {staffStats.map((staff) => {
                  const connectRate = staff.calls ? Math.round((staff.connected / staff.calls) * 100) : 0
                  const conversionRate = staff.connected ? Math.round((staff.conversions / staff.connected) * 100) : 0
                  return (
                    <tr key={staff.id}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{staff.name}</p>
                            <p className="text-xs text-gray-400">
                              {staff.role} - {staff.attended} attended visits
                            </p>
                          </div>
                          {staff.id === topCloserId && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Top closer
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{staff.calls}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {staff.connected}
                        <div className="text-[10px] text-gray-400">{connectRate}% connect</div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{staff.followUps}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{staff.conversions}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">{conversionRate}%</div>
                          <div className="h-1.5 w-28 rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${conversionRate}%`,
                                backgroundColor: conversionRate >= 25 ? '#00B894' : '#F39C12',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">
                        {formatPaise(staff.revenuePaise)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400">
          Data note: conversions are attributed to the staff assigned on each lead.
        </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold text-gray-900">Attended Leads (30d)</p>
              <p className="text-xs text-gray-400">Walk-ins and visits logged by frontdesk</p>
            </div>
            {attendedLeads.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6">No attended leads logged yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Attended</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  {attendedLeads.slice(0, 6).map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{lead.phone}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{leadSourceLabels[lead.source] ?? lead.source}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {lead.assigned_staff_id ? userById.get(lead.assigned_staff_id)?.email ?? 'Staff' : 'Unassigned'}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-500">
                        {lead.attended_at ? new Date(lead.attended_at).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold text-gray-900">Converted Leads (30d)</p>
              <p className="text-xs text-gray-400">Converted to members with phone numbers</p>
            </div>
            {convertedLeads.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6">No converted leads yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  {convertedLeads.slice(0, 6).map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{lead.phone}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{leadSourceLabels[lead.source] ?? lead.source}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {lead.assigned_staff_id ? userById.get(lead.assigned_staff_id)?.email ?? 'Staff' : 'Unassigned'}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-500">
                        {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <FrontdeskLogModal
        open={showFrontdeskLog}
        onClose={() => setShowFrontdeskLog(false)}
        leads={leadList}
        users={userList}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">Revenue and Collections</p>
              <p className="text-xs text-gray-400">Last 6 months</p>
            </div>
          </div>
          {!hasInvoices ? (
            <p className="text-sm text-gray-400">No invoices yet. Create invoices to see revenue trends.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                {monthlyRevenue.map((item) => {
                  const max = Math.max(...monthlyRevenue.map((m) => m.invoiced), 1)
                  const height = Math.round((item.invoiced / max) * 120)
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2">
                      <div
                        className="w-8 rounded-md bg-emerald-200"
                        style={{ height: `${height}px` }}
                        title={`${item.label} - ${formatPaise(item.invoiced)}`}
                      />
                      <span className="text-[11px] text-gray-500">{item.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/60">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoiced</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                    {monthlyRevenue.map((item) => (
                      <tr key={item.label}>
                        <td className="px-3 py-2 text-gray-600">{item.label}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatPaise(item.invoiced)}</td>
                        <td className="px-3 py-2 text-right">{formatPaise(item.collected)}</td>
                        <td className="px-3 py-2 text-right">{item.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">Plan Mix</p>
              <p className="text-xs text-gray-400">Revenue in last 30 days</p>
            </div>
          </div>
          <div className="space-y-3">
            {planMix.map((item) => (
              <div key={item.interval} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.active} active members</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatPaise(item.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <p className="font-semibold text-gray-900 mb-4">Member Growth</p>
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">New</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Churned</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                {memberGrowth.map((item) => (
                  <tr key={item.label}>
                    <td className="px-3 py-2 text-gray-600">{item.label}</td>
                    <td className="px-3 py-2 text-right">{item.newEnrollments}</td>
                    <td className="px-3 py-2 text-right">{item.churned}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.netChange}</td>
                    <td className="px-3 py-2 text-right">{item.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-900">Churn Risk</p>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Low Risk</span>
              <span className="text-sm font-semibold text-emerald-600">{churnRisk.low}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Medium Risk</span>
              <span className="text-sm font-semibold text-amber-500">{churnRisk.medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">High Risk</span>
              <span className="text-sm font-semibold text-red-500">{churnRisk.high}</span>
            </div>
            <div className="pt-3 text-xs text-gray-400">
              Based on last attendance in the past 7 to 14 days.
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-gray-900">Attendance Heatmap</p>
            <p className="text-xs text-gray-400">Peak hours across the week</p>
          </div>
        </div>
        {!hasAttendance ? (
          <p className="text-sm text-gray-400">No attendance events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[80px_repeat(16,minmax(24px,1fr))] gap-2">
                <div />
                {hourLabels.map((label) => (
                  <div key={label} className="text-[10px] text-gray-400 text-center">{label}</div>
                ))}
                {heatmap.map((row, rowIndex) => (
                  <div key={dayLabels[rowIndex]} className="contents">
                    <div className="text-xs text-gray-500 flex items-center">
                      {dayLabels[rowIndex]}
                    </div>
                    {row.map((value, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className="h-6 rounded-md"
                        style={{ backgroundColor: `rgba(0, 184, 148, ${value / 100})` }}
                        title={`${value}% intensity`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">WhatsApp Delivery</p>
              <p className="text-xs text-gray-400">Outbox events by month</p>
            </div>
            <MessageCircle size={18} className="text-emerald-500" />
          </div>
          {!hasOutbox ? (
            <p className="text-sm text-gray-400">No WhatsApp events yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  {whatsappStats.map((item) => (
                    <tr key={item.label}>
                      <td className="px-3 py-2 text-gray-600">{item.label}</td>
                      <td className="px-3 py-2 text-right">{item.sent}</td>
                      <td className="px-3 py-2 text-right">{item.delivered}</td>
                      <td className="px-3 py-2 text-right">{item.failed}</td>
                      <td className="px-3 py-2 text-right">{item.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-900">GST Summary (30d)</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Taxable Supply</span>
              <span className="text-sm font-semibold text-gray-900">{formatPaise(gstSummary.taxable)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">CGST</span>
              <span className="text-sm font-semibold text-gray-900">{formatPaise(gstSummary.cgst)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">SGST</span>
              <span className="text-sm font-semibold text-gray-900">{formatPaise(gstSummary.sgst)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">IGST</span>
              <span className="text-sm font-semibold text-gray-900">{formatPaise(gstSummary.igst)}</span>
            </div>
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total GST</span>
                <span className="text-sm font-semibold text-gray-900">{formatPaise(gstSummary.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
