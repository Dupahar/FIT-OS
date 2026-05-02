import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { CreditCard, MessageCircle, Brain, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { AuthTokens } from '@/types'

const schema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

const features = [
  { icon: CreditCard, title: 'UPI Payments + GST Invoicing', desc: 'Razorpay UPI, auto-GST, Tally export' },
  { icon: MessageCircle, title: 'WhatsApp Automation', desc: 'Renewal nudges, receipts, re-engagement' },
  { icon: Brain, title: 'Predictive Retention', desc: 'AI-powered churn risk & member analytics' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenant_id: '11111111-1111-1111-1111-111111111111',
    },
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    setIsLoading(true)
    try {
      const res = await api.post('/v1/auth/login', data)
      const tokens: AuthTokens = res.data.data || res.data
      setTokens(tokens, data.tenant_id)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Brand Panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: '#0D1117' }}
      >
        <div>
          <h1 className="font-syne font-extrabold text-5xl text-white tracking-tight">FIT</h1>
          <p className="text-lg mt-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
            The gym OS built for India
          </p>
        </div>

        <div className="space-y-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(0,184,148,0.15)' }}>
                <f.icon size={20} style={{ color: '#00B894' }} />
              </div>
              <div>
                <h3 className="font-syne font-semibold text-white text-sm">{f.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2026 FIT · Made for Indian fitness businesses
        </p>
      </motion.div>

      {/* Right Form Panel */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex items-center justify-center p-8 bg-white"
      >
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-syne font-bold text-2xl text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-400 mt-1">Sign in to your gym dashboard</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant ID</label>
              <input
                {...register('tenant_id')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="11111111-1111-1111-1111-111111111111"
              />
              <p className="text-xs text-gray-400 mt-1">Your gym's unique identifier</p>
              {errors.tenant_id && <p className="text-xs text-red-500 mt-1">{errors.tenant_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="owner@demo.local"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                {...register('password')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#00B894] hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
