'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { LogIn, Eye, EyeOff, AlertCircle, Loader2, Home, LayoutDashboard } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminMode = searchParams.get('mode') === 'admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      // Step 1: Authenticate
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('خطأ في البريد الإلكتروني أو كلمة المرور')
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('حدث خطأ غير متوقع')
        setLoading(false)
        return
      }

      // Step 2: Fetch user role + disabled status directly from user_preferences.
      // Company-based selection removed — we now use the track model, and any
      // user without a track is treated as having access to everything.
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('role, is_disabled')
        .eq('user_id', authData.user.id)
        .single()

      if (prefs?.is_disabled) {
        setError('تم تعطيل حسابك. تواصل مع مدير النظام.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      const userRole = prefs?.role || 'company_technician'

      // Admin mode: verify system_admin role
      if (isAdminMode) {
        if (userRole !== 'system_admin') {
          setError('ليس لديك صلاحية الدخول إلى لوحة التحكم')
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
        router.push('/admin-dashboard')
        router.refresh()
        return
      }

      // All authenticated users go straight to the dashboard.
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('[Login Error]', err)
      setError(`حدث خطأ غير متوقع: ${err?.message || 'unknown'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="relative w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            VMS
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            نظام مراقبة المركبات
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className={`p-6 ${isAdminMode ? 'bg-gradient-to-r from-slate-700 to-slate-800' : 'bg-gradient-to-r from-red-600 to-red-700'}`}>
            <div className="flex items-center gap-3 text-white">
              {isAdminMode ? <LayoutDashboard className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
              <div>
                <h2 className="text-xl font-semibold">
                  {isAdminMode ? 'لوحة التحكم' : 'تسجيل الدخول'}
                </h2>
                <p className="text-white/70 text-sm mt-0.5">
                  {isAdminMode ? 'Admin Control Panel' : 'System Login'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full px-4 py-3 text-white rounded-lg font-medium focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${
                  isAdminMode
                    ? 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-500/50'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:ring-red-500/50'
                }`}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري التحقق...</>
                ) : (
                  <><LogIn className="w-5 h-5" /> تسجيل الدخول</>
                )}
              </button>
            </form>
          </div>

          <div className="bg-gray-50 dark:bg-slate-900 px-6 py-3 border-t border-gray-200 dark:border-slate-700">
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              VMS
            </p>
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <Link href="/home" className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            <Home className="w-4 h-4" />
            الرجوع إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  )
}
