'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore'
import { useRole } from '@/hooks/useRole'
import {
  LayoutDashboard,
  Wrench,
  Users,
  Car,
  ClipboardList,
  LogOut,
  Loader2,
  Home,
  Download,
  Settings,
  Upload,
} from 'lucide-react'
import { AdminContext } from './AdminContext'
import { createClient } from '@/lib/supabase/client'
import IdleTimeoutWarning from '@/components/IdleTimeoutWarning'
import { ToastProvider } from '@/components/ui/Toast'

// Flat admin nav — the system is no longer multi-company.
const navItems = [
  { key: 'overview',   href: '/admin-dashboard',             label: 'نظرة عامة',         labelEn: 'Overview',            icon: LayoutDashboard },
  { key: 'workshops',  href: '/admin-dashboard/workshops',   label: 'إدارة الورش',       labelEn: 'Workshop Management', icon: Wrench },
  { key: 'users',      href: '/admin-dashboard/users',       label: 'إدارة المستخدمين',  labelEn: 'User Management',     icon: Users },
  { key: 'vehicles',   href: '/admin-dashboard/vehicles',    label: 'المركبات',          labelEn: 'Vehicles',            icon: Car },
  { key: 'upload',     href: '/admin-dashboard/upload',      label: 'رفع المركبات',      labelEn: 'Import Vehicles',     icon: Upload },
  { key: 'job-cards',  href: '/admin-dashboard/job-cards',   label: 'الحالات',           labelEn: 'Cases',               icon: ClipboardList },
  { key: 'data-export',href: '/admin-dashboard/data-export', label: 'تحميل البيانات',    labelEn: 'Data Export',         icon: Download },
  { key: 'settings',   href: '/admin-dashboard/settings',    label: 'إعدادات النظام',    labelEn: 'System Settings',     icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { theme, language } = usePreferencesStore()
  const { role, loading } = useRole()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('lang', language)
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr')
  }, [theme, language])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/home')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  if (role !== 'system_admin') {
    router.push('/dashboard')
    return null
  }

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = pathname === item.href || (item.href !== '/admin-dashboard' && pathname.startsWith(item.href))
    return (
      <Link
        key={item.key}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-red-600 text-white'
            : 'text-gray-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {sidebarOpen && <span>{language === 'ar' ? item.label : item.labelEn}</span>}
      </Link>
    )
  }

  return (
    <ToastProvider>
    <AdminContext.Provider value={{ selectedCompanyId: null, selectedCompanyName: '', setSelectedCompanyId: () => {} }}>
      <IdleTimeoutWarning />
      <div className="h-screen overflow-hidden flex" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-[72px]'} bg-slate-900 border-e border-slate-700 flex flex-col transition-all duration-300 flex-shrink-0`}>
          {/* Logo */}
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <Image src="/images/logo.png" alt="VMS" width={40} height={40} className="flex-shrink-0 rounded-lg" />
            {sidebarOpen && (
              <div>
                <p className="text-white font-bold text-sm">VMS</p>
                <p className="text-red-400 text-xs">{language === 'ar' ? 'لوحة التحكم' : 'Admin Panel'}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-3">
            <div className="space-y-1">
              {navItems.map(renderNavItem)}
            </div>
          </nav>

          {/* Bottom Actions */}
          <div className="p-3 border-t border-slate-700 space-y-1">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{language === 'ar' ? 'الذهاب للنظام' : 'Go to System'}</span>}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition-all"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <LayoutDashboard className="w-4 h-4" />
              <span>{language === 'ar' ? 'لوحة تحكم مدير النظام' : 'System Admin Dashboard'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full font-medium">
                {language === 'ar' ? 'مدير النظام' : 'System Admin'}
              </span>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 p-6">
            {children}
          </main>

          {/* Copyright Footer */}
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
    </AdminContext.Provider>
    </ToastProvider>
  )
}
