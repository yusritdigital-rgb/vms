'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore'
import { useSidebarStore } from '@/lib/stores/useSidebarStore'
import { useTrack } from '@/hooks/useTrack'
import { pathToSection } from '@/lib/tracks/accessMatrix'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import IdleTimeoutWarning from '@/components/IdleTimeoutWarning'
import { ToastProvider } from '@/components/ui/Toast'
import { Loader2, ShieldX } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { theme, language } = usePreferencesStore()
  const { isOpen } = useSidebarStore()
  // Track-based access replaces the old company-based gating.
  const { track, loading: trackLoading, canView } = useTrack()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('lang', language)
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr')
  }, [theme, language])

  const isLoading = trackLoading

  // Route-level access check via the track matrix.
  const section = pathToSection(pathname || '')
  const isBlocked = !isLoading && section !== null && !canView(section)

  return (
    <ToastProvider>
      <div className="h-screen overflow-hidden">
        <IdleTimeoutWarning />
        <Sidebar />
        <div
          className="flex flex-col h-full transition-all duration-300 ease-in-out"
          style={{ [language === 'ar' ? 'marginRight' : 'marginLeft']: isOpen ? '16rem' : '72px' }}
        >
          <Header />
          <ErrorBoundary>
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : isBlocked ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <ShieldX className="w-16 h-16 text-red-300 dark:text-red-600 mb-4" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {language === 'ar' ? 'ليس لديك صلاحية' : 'Access Denied'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                    {language === 'ar'
                      ? 'ليس لديك الصلاحية للوصول إلى هذا القسم. تواصل مع مدير النظام لتفعيل الصلاحية.'
                      : 'You do not have permission to access this section. Contact the system admin to enable access.'}
                  </p>
                </div>
              ) : (
                children
              )}
            </main>
          </ErrorBoundary>
          <footer className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 py-2 px-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                VMS &mdash; {language === 'ar' ? 'نظام مراقبة المركبات' : 'Vehicle Monitoring System'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span style={{ fontSize: '11px' }}>©</span>
                <span>{new Date().getFullYear()}</span>
                <span className="mx-1">•</span>
                {language === 'ar' ? (
                  <span>تم تطوير النظام بواسطة <strong className="text-red-600 dark:text-red-400 font-semibold">يُسر</strong></span>
                ) : (
                  <span>Developed by <strong className="text-red-600 dark:text-red-400 font-semibold">Yusr</strong></span>
                )}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  )
}
