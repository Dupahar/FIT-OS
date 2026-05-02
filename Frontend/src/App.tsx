import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { useAuthStore } from '@/store/auth'
import { ToastProvider } from '@/components/shared/Toast'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MembersPage = lazy(() => import('@/pages/MembersPage'))
const MemberDetailPage = lazy(() => import('@/pages/MemberDetailPage'))
const PlansPage = lazy(() => import('@/pages/PlansPage'))
const BillingPage = lazy(() => import('@/pages/BillingPage'))
const InvoiceDetailPage = lazy(() => import('@/pages/InvoiceDetailPage'))
const DevicesPage = lazy(() => import('@/pages/DevicesPage'))
const InventoryPage = lazy(() => import('@/pages/InventoryPage'))
const LeadsPage = lazy(() => import('@/pages/LeadsPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s: { access_token: string | null }) => s.access_token)
  if (!accessToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const role = useAuthStore((s) => s.user_role)
  if (!role || !allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <LoadingSpinner size="lg" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="dashboard" element={<DashboardPage />} />
                            <Route
                              path="members"
                              element={
                                <RequireRole allowed={['owner', 'staff', 'trainer']}>
                                  <MembersPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="members/:id"
                              element={
                                <RequireRole allowed={['owner', 'staff', 'trainer']}>
                                  <MemberDetailPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="leads"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <LeadsPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="plans"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <PlansPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="billing"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <BillingPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="billing/:id"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <InvoiceDetailPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="devices"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <DevicesPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="inventory"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <InventoryPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="analytics"
                              element={
                                <RequireRole allowed={['owner', 'staff']}>
                                  <AnalyticsPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="settings"
                              element={
                                <RequireRole allowed={['owner']}>
                                  <SettingsPage />
                                </RequireRole>
                              }
                            />
                            <Route path="" element={<Navigate to="/dashboard" replace />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                        </Suspense>
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
