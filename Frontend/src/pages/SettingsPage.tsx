import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Save, Check, AlertTriangle, Wifi } from 'lucide-react'
import { useTenantProfile, useUpdateTenant, useUsers } from '@/hooks/useApi'
import { useToast } from '@/components/shared/Toast'

type SettingsTab = 'profile' | 'notifications' | 'integrations' | 'access'

export default function SettingsPage() {
  const { toast } = useToast()
  const { data: tenant } = useTenantProfile()
  const updateTenant = useUpdateTenant()
  const { data: users } = useUsers()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const [form, setForm] = useState({
    name: tenant?.name || '',
    legal_name: tenant?.legal_name || '',
    gstin: tenant?.gstin || '',
    address: tenant?.address || '',
    state_code: tenant?.state_code || '',
  })

  const [notifications, setNotifications] = useState({
    renewal7: true,
    renewal3: true,
    receipt: true,
    frozen: true,
  })

  const userList = users ?? []
  const staffSummary = useMemo(() => {
    const active = userList.filter((user) => user.is_active).length
    const inactive = userList.length - active
    return { active, inactive }
  }, [userList])

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, staff: 0, trainer: 0 }
    for (const user of userList) {
      counts[user.role] = (counts[user.role] ?? 0) + 1
    }
    return counts
  }, [userList])

  useEffect(() => {
    if (!tenant) return
    setForm({
      name: tenant.name || '',
      legal_name: tenant.legal_name || '',
      gstin: tenant.gstin || '',
      address: tenant.address || '',
      state_code: tenant.state_code || '',
    })
  }, [tenant])

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateTenant.mutateAsync({
        name: form.name,
        legal_name: form.legal_name,
        gstin: form.gstin,
        address: form.address,
        state_code: form.state_code,
      })
      toast('success', 'Settings saved')
    } catch {
      toast('error', 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const tabs = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'notifications' as const, label: 'Notifications' },
    { key: 'integrations' as const, label: 'Integrations' },
    { key: 'access' as const, label: 'Access' },
  ]

  const accessLevels: Record<string, { label: string; classes: string }> = {
    full: { label: 'Full', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    edit: { label: 'Edit', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    view: { label: 'View', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    none: { label: 'None', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  }

  const accessMatrix = [
    {
      key: 'owner',
      role: 'Owner',
      description: 'Full control of the business',
      access: {
        members: 'full',
        billing: 'full',
        analytics: 'full',
        inventory: 'full',
        devices: 'full',
        settings: 'full',
      },
    },
    {
      key: 'staff',
      role: 'Staff',
      description: 'Frontdesk and daily operations',
      access: {
        members: 'edit',
        billing: 'view',
        analytics: 'view',
        inventory: 'edit',
        devices: 'view',
        settings: 'none',
      },
    },
    {
      key: 'trainer',
      role: 'Trainer',
      description: 'Training and attendance',
      access: {
        members: 'view',
        billing: 'none',
        analytics: 'view',
        inventory: 'none',
        devices: 'view',
        settings: 'none',
      },
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-syne font-bold text-2xl text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your gym configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              activeTab === tab.key ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div layoutId="settingsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]" />
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gym Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Legal Name</label>
            <input
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Company legal name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">GSTIN</label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">State Code</label>
            <input
              value={form.state_code}
              onChange={(e) => setForm({ ...form, state_code: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </motion.div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg space-y-4">
          {[
            { key: 'renewal7' as const, label: 'Renewal nudge (7 days before)', desc: 'Send WhatsApp reminder 7 days before membership expires' },
            { key: 'renewal3' as const, label: 'Renewal nudge (3 days before)', desc: 'Send WhatsApp reminder 3 days before membership expires' },
            { key: 'receipt' as const, label: 'Payment receipt', desc: 'Send WhatsApp receipt after payment is recorded' },
            { key: 'frozen' as const, label: 'Freeze confirmation', desc: 'Send WhatsApp confirmation when membership is frozen' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 border rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications[item.key] ? 'bg-[#00B894]' : 'bg-gray-200'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  notifications[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg space-y-4">
          {/* Razorpay */}
          <div className="p-5 border rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wifi size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Razorpay</p>
                  <p className="text-xs text-gray-400">UPI payments & online collection</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                <Check size={12} /> Connected
              </span>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="p-5 border rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">WhatsApp Business</p>
                  <p className="text-xs text-gray-400">Automated messaging & receipts</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                <AlertTriangle size={12} /> Pending Meta approval
              </span>
            </div>
          </div>

          {/* eSSL */}
          <div className="p-5 border rounded-xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">eSSL Biometric</p>
                  <p className="text-xs text-gray-400">Access control hardware</p>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Setup
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Access Tab */}
      {activeTab === 'access' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="border rounded-xl p-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-5">
              <div>
                <p className="font-semibold text-gray-900">Role Based Access</p>
                <p className="text-xs text-gray-400">Control what each staff role can view or edit.</p>
              </div>
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Invite Staff
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Roles Configured', value: accessMatrix.length },
                { label: 'Active Staff', value: staffSummary.active },
                { label: 'Inactive Staff', value: staffSummary.inactive },
              ].map((item) => (
                <div key={item.label} className="border rounded-lg p-4" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-syne font-bold text-gray-900 mt-1">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Billing</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Analytics</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Inventory</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Devices</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  {accessMatrix.map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-800">{row.role}</p>
                        <p className="text-xs text-gray-400">
                          {row.description} - {roleCounts[row.key] ?? 0} staff
                        </p>
                      </td>
                      {(['members', 'billing', 'analytics', 'inventory', 'devices', 'settings'] as const).map((key) => {
                        const level = row.access[key]
                        const badge = accessLevels[level]
                        return (
                          <td key={key} className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.classes}`}>
                              {badge.label}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <p className="font-semibold text-gray-900 mb-2">Access Policies</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Owner role requires two-factor authentication.</li>
                <li>Billing changes are logged in the audit trail for 12 months.</li>
                <li>Inventory edits trigger low-stock notifications.</li>
              </ul>
            </div>
            <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <p className="font-semibold text-gray-900 mb-2">Access Reviews</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Weekly review of staff access changes.</li>
                <li>Auto-expire access for inactive staff after 30 days.</li>
                <li>Approve new roles before sharing analytics exports.</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
