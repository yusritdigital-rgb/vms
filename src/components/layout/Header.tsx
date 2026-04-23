'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import {
  Moon, Sun, LogOut, User, Building2, ChevronDown, Shield,
  Settings, ArrowRightLeft, LayoutDashboard,
} from 'lucide-react'
import NotificationBell from '@/components/layout/NotificationBell'

interface UserInfo {
  email: string
  fullName: string | null
  role: string | null
  companyName: string | null
  companyId: string | null
}

// Role labels come from the shared registry so every page uses the
// same three labels: "مدير النظام" / "مشرف" / "موظف".
import { getRoleInfo } from '@/lib/roles'

export default function Header() {
  const router = useRouter()
  const { language, theme, setLanguage, toggleTheme } = usePreferencesStore()
  const { t } = useTranslation()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUserInfo()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadUserInfo = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('full_name, role, company_id, company:companies(name_ar, name_en)')
      .eq('user_id', user.id)
      .single()

    const company = prefs?.company as any
    setUserInfo({
      email: user.email || '',
      fullName: prefs?.full_name || null,
      role: prefs?.role || 'company_technician',
      companyName: company ? (language === 'ar' ? company.name_ar : company.name_en) : null,
      companyId: prefs?.company_id || null,
    })
  }

  const handleLogout = async () => {
    setMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/home')
    router.refresh()
  }

  const handleSwitchCompany = async () => {
    setMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleInfo = getRoleInfo(userInfo?.role)
  const displayName = userInfo?.fullName || userInfo?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 h-16 flex items-center">
      <div className="flex items-center justify-between w-full">
        <div className="flex-1" />

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <NotificationBell />

          {/* User Account Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-start">
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{displayName}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                  {language === 'ar' ? roleInfo.ar : roleInfo.en}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute end-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
                {/* User Info Header */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userInfo?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                          <Shield className="w-3 h-3" />
                          {language === 'ar' ? roleInfo.ar : roleInfo.en}
                        </span>
                      </div>
                    </div>
                  </div>
                  {userInfo?.companyName && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="truncate">{userInfo.companyName}</span>
                    </div>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => { setMenuOpen(false); router.push('/settings') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-start"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    {language === 'ar' ? 'الإعدادات' : 'Settings'}
                  </button>

                  {userInfo?.role === 'system_admin' && (
                    <button
                      onClick={() => { setMenuOpen(false); router.push('/admin-dashboard') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-start"
                    >
                      <LayoutDashboard className="w-4 h-4 text-gray-400" />
                      {language === 'ar' ? 'لوحة تحكم المدير' : 'Admin Dashboard'}
                    </button>
                  )}

                  <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

                  <button
                    onClick={handleSwitchCompany}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-start"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                    {language === 'ar' ? 'تغيير الشركة / الحساب' : 'Switch Company / Account'}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-start"
                  >
                    <LogOut className="w-4 h-4" />
                    {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
