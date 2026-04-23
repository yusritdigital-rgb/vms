'use client'

import { useState, useEffect } from 'react'
import { Settings, Shield, User, Lock, Save, Loader2, CheckCircle, AlertTriangle, Building2, Mail } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  email: string
  fullName: string | null
  role: string | null
  companyName: string | null
}

// Role labels come from the shared registry so this page stays in sync
// with the admin Users page and the header dropdown.
import { getRoleInfo } from '@/lib/roles'

export default function SettingsPage() {
  const { language } = useTranslation()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState('')

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('full_name, role, company:companies(name_ar, name_en)')
      .eq('user_id', user.id)
      .single()

    const company = prefs?.company as any
    setProfile({
      email: user.email || '',
      fullName: prefs?.full_name || null,
      role: prefs?.role || 'company_technician',
      companyName: company ? (language === 'ar' ? company.name_ar : company.name_en) : null,
    })
    setFullName(prefs?.full_name || '')
    setLoading(false)
  }

  const handleSaveName = async () => {
    setSavingName(true)
    setNameError('')
    setNameSuccess(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingName(false); return }

    const { error } = await supabase
      .from('user_preferences')
      .update({ full_name: fullName.trim() || null })
      .eq('user_id', user.id)

    setSavingName(false)
    if (error) {
      setNameError(error.message)
    } else {
      setNameSuccess(true)
      setProfile(prev => prev ? { ...prev, fullName: fullName.trim() || null } : prev)
      setTimeout(() => setNameSuccess(false), 3000)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)

    if (!newPassword || newPassword.length < 6) {
      setPasswordError(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }

    setSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setSavingPassword(false)
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  const roleInfo = getRoleInfo(profile?.role)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <Settings className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'الإعدادات' : 'Settings'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة حسابك وتغيير كلمة المرور' : 'Manage your account and change password'}
          </p>
        </div>
      </div>

      {/* Account Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-5">
          <User className="w-5 h-5 text-gray-400" />
          <h2 className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'معلومات الحساب' : 'Account Info'}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white" dir="ltr">{profile?.email}</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">{language === 'ar' ? 'الدور' : 'Role'}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{language === 'ar' ? roleInfo.ar : roleInfo.en}</p>
          </div>
          {profile?.companyName && (
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 sm:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">{language === 'ar' ? 'الشركة' : 'Company'}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.companyName}</p>
            </div>
          )}
        </div>

        {/* Edit Name */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل اسمك' : 'Enter your name'}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {language === 'ar' ? 'حفظ' : 'Save'}
            </button>
          </div>
          {nameSuccess && (
            <p className="flex items-center gap-1 text-xs text-red-600 mt-2">
              <CheckCircle className="w-3.5 h-3.5" />
              {language === 'ar' ? 'تم حفظ الاسم بنجاح' : 'Name saved successfully'}
            </p>
          )}
          {nameError && (
            <p className="flex items-center gap-1 text-xs text-red-600 mt-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {nameError}
            </p>
          )}
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Lock className="w-5 h-5 text-gray-400" />
          <h2 className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              dir="ltr"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
          </button>

          {passwordSuccess && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <CheckCircle className="w-3.5 h-3.5" />
              {language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'}
            </p>
          )}
          {passwordError && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {passwordError}
            </p>
          )}
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {language === 'ar'
            ? 'لتغيير الدور أو الشركة أو إدارة الصلاحيات، تواصل مع مدير النظام.'
            : 'To change your role, company, or manage permissions, contact the system admin.'}
        </p>
      </div>
    </div>
  )
}
