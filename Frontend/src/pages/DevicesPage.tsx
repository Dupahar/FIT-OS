import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Cpu, RefreshCw } from 'lucide-react'
import { useDevices, useCreateDevice, useSyncDevice } from '@/hooks/useApi'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'
import { relativeTime } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  device_type: z.string().min(1, 'Type required'),
  serial_number: z.string().optional(),
})

type DeviceFormData = z.infer<typeof schema>

export default function DevicesPage() {
  const { toast } = useToast()
  const { data: devices, isLoading } = useDevices()
  const createDevice = useCreateDevice()
  const syncDevice = useSyncDevice()
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DeviceFormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: DeviceFormData) => {
    try {
      await createDevice.mutateAsync({
        name: data.name,
        device_type: data.device_type,
        serial_number: data.serial_number || undefined,
      })
      toast('success', 'Device registered')
      reset()
      setShowAdd(false)
    } catch {
      toast('error', 'Failed to register device')
    }
  }

  const handleSync = async (deviceId: string) => {
    setSyncing(deviceId)
    try {
      await syncDevice.mutateAsync(deviceId)
      toast('success', 'Device synced successfully')
    } catch {
      toast('error', 'Failed to sync device')
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Devices</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage access control hardware</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
        >
          <Plus size={16} /> Register Device
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : !devices?.length ? (
        <EmptyState icon={Cpu} title="No devices" description="Register your first access control device." />
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Serial</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {devices.map((device, i) => (
                <motion.tr
                  key={device.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{device.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{device.device_type}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{device.serial_number || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={device.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {device.last_seen_at ? relativeTime(device.last_seen_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSync(device.id)}
                      disabled={syncing === device.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {syncing === device.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Sync
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Device Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-syne font-semibold text-lg">Register Device</h3>
                <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                  <input {...register('name')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Main Entry" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <input {...register('device_type')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="eSSL Biometric" />
                  {errors.device_type && <p className="text-xs text-red-500 mt-1">{errors.device_type.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number (optional)</label>
                  <input {...register('serial_number')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm">
                  Register Device
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
