import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Tag } from 'lucide-react'
import { usePlans, useMemberships, useUpdatePlan } from '@/hooks/useApi'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CreatePlanModal } from '@/components/modals/CreatePlanModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'
import { formatPaise, intervalLabel } from '@/lib/utils'

type PlanFilter = 'all' | 'active' | 'inactive'

export default function PlansPage() {
  const { data: plans, isLoading } = usePlans()
  const { data: memberships } = useMemberships()
  const updatePlan = useUpdatePlan()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<PlanFilter>('all')
  const [search, setSearch] = useState('')
  const allowedIntervals = useMemo(
    () => new Set(['monthly', 'quarterly', 'semiannual', 'annual', 'custom']),
    [],
  )

  const planCards = useMemo(() => {
    return (plans || [])
      .filter((p) => allowedIntervals.has(p.billing_interval))
      .map((p) => {
      const memberCount =
        memberships?.filter((m) => m.plan_id === p.id && m.status !== 'cancelled').length || 0
      const pricePaise = Number(p.price_paise) || 0
      const gstRate = Number(p.gst_rate ?? 18) || 0
      const totalWithGst = pricePaise + Math.round((pricePaise * gstRate) / 100)
      return { ...p, memberCount, totalWithGst }
    })
  }, [plans, memberships, allowedIntervals])

  const counts = useMemo(() => ({
    all: planCards.length,
    active: planCards.filter((p) => p.status === 'active').length,
    inactive: planCards.filter((p) => p.status === 'inactive').length,
  }), [planCards])

  const filteredPlans = useMemo(() => {
    let list = planCards
    if (filter !== 'all') {
      list = list.filter((p) => p.status === filter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => (p.name || '').toLowerCase().includes(q))
    }
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return Number(b.price_paise) - Number(a.price_paise)
    })
  }, [planCards, filter, search])

  const toggleStatus = async (planId: string, currentStatus: string) => {
    try {
      await updatePlan.mutateAsync({
        id: planId,
        status: currentStatus === 'active' ? 'inactive' : 'active',
      })
      toast('success', `Plan ${currentStatus === 'active' ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to update plan')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Plans</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your membership plans</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans..."
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
          >
            <Plus size={16} />
            Create Plan
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100">
        {([
          { key: 'all' as const, label: 'All' },
          { key: 'active' as const, label: 'Active' },
          { key: 'inactive' as const, label: 'Inactive' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              filter === tab.key ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === tab.key ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[tab.key]}
            </span>
            {filter === tab.key && (
              <motion.div layoutId="planTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No plans yet"
          description="Create your first membership plan to start enrolling members."
          action={
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#00B894] text-white text-sm rounded-lg font-medium">
              Create Plan
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPlans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="border rounded-xl p-6 hover:shadow-md transition-all"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-syne font-bold text-xl text-gray-900">{plan.name}</h3>
                <StatusBadge status={plan.status} />
              </div>

              <div className="mb-4">
                <span className="font-syne font-bold text-3xl">{formatPaise(plan.price_paise)}</span>
                <span className="text-gray-400 text-sm ml-1">/ {intervalLabel(plan.billing_interval)}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">GST Rate</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                    {Number(plan.gst_rate ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total with GST</span>
                  <span className="font-syne font-bold text-gray-600">{formatPaise(plan.totalWithGst)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Active members</span>
                  <span className="font-syne font-bold text-gray-600">{plan.memberCount}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <button
                  onClick={() => toggleStatus(plan.id, plan.status)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    plan.status === 'active'
                      ? 'border border-red-100 text-red-600 hover:bg-red-50'
                      : 'border border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CreatePlanModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
