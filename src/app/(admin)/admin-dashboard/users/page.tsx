'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { Users, Loader2, X, Edit2, Plus, UserX, UserCheck, Trash2, Search, Mail, Wrench, Settings2 } from 'lucide-react'
import { ROLE_INFO, USER_ROLES, getRoleInfo, type UserRole } from '@/lib/roles'

// Track-based user model (replaces the old company-based model).
// `track` is one of: 'maintenance' | 'operations' | null (null = see everything).
interface UserRecord {
  id: string
  email: string
  full_name: string | null
  role: string
  track: 'maintenance' | 'operations' | null
  is_disabled: boolean
  created_at: string
  last_sign_in_at: string | null
  has_preferences: boolean
}

// Role labels/colors come from the shared registry so every page uses the
// same three labels: "مدير النظام" / "مشرف" / "موظف".

const trackLabels: Record<string, { ar: string; en: string; Icon: any; color: string }> = {
  maintenance: { ar: 'صيانة', en: 'Maintenance', Icon: Wrench,    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  operations:  { ar: 'تشغيل', en: 'Operations',  Icon: Settings2, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function AdminUsersPage() {
  const { language } = useTranslation()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('edit')
  const [saving, setSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  // `track: ''` means "no track" (= see everything).
  const [form, setForm] = useState<{ full_name: string; role: string; track: string; email: string; password: string }>({
    full_name: '', role: 'company_technician', track: '', email: '', password: '',
  })
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    if (json.users) setUsers(json.users)
    setLoading(false)
  }

  const openAdd = () => {
    setModalMode('add')
    setEditingUser(null)
    setForm({ full_name: '', role: 'company_technician', track: '', email: '', password: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (u: UserRecord) => {
    setModalMode('edit')
    setEditingUser(u)
    setForm({ full_name: u.full_name || '', role: u.role || 'company_technician', track: u.track || '', email: u.email, password: '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    // Track is optional: admins can leave it empty to grant full access.
    const trackValue = form.track || null

    if (modalMode === 'add') {
      if (!form.email || !form.password) {
        setError(language === 'ar' ? 'البريد وكلمة المرور مطلوبة' : 'Email and password required')
        setSaving(false)
        return
      }
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name || null,
          role: form.role,
          track: trackValue,
        }),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
    } else if (editingUser) {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editingUser.id,
          full_name: form.full_name || null,
          role: form.role,
          track: form.role === 'system_admin' ? null : trackValue,
        }),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setShowModal(false)
    loadData()
  }

  const toggleDisable = async (u: UserRecord) => {
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: u.id,
        full_name: u.full_name,
        role: u.role,
        track: u.track,
        is_disabled: !u.is_disabled,
      }),
    })
    loadData()
  }

  const deleteUser = async (u: UserRecord) => {
    const confirmed = window.confirm(language === 'ar' ? `حذف ${u.email}؟` : `Delete ${u.email}?`)
    if (!confirmed) return
    await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' })
    loadData()
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return u.email.toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s)
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'إدارة المستخدمين' : 'Users Management'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? `${users.length} مستخدم مسجل` : `${users.length} registered users`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ar' ? 'بحث بالإيميل أو الاسم...' : 'Search by email or name...'}
              className="ps-9 pe-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm w-64" />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                  <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الدور' : 'Role'}</th>
                  <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'القطاع' : 'Track'}</th>
                  <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filtered.map((u) => {
                  const roleInfo = getRoleInfo(u.role)
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${u.is_disabled ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{u.full_name || (language === 'ar' ? 'بدون اسم' : 'No name')}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.badgeColor}`}>
                          {language === 'ar' ? roleInfo.ar : roleInfo.en}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {u.track && trackLabels[u.track] ? (
                          (() => {
                            const t = trackLabels[u.track as string]
                            const Icon = t.Icon
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${t.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {language === 'ar' ? t.ar : t.en}
                              </span>
                            )
                          })()
                        ) : (
                          <span className="text-gray-400 text-xs">{language === 'ar' ? 'بلا تقييد (كل الأقسام)' : 'No track (see-all)'}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_disabled ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {u.is_disabled ? (language === 'ar' ? 'معطل' : 'Disabled') : (language === 'ar' ? 'نشط' : 'Active')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={language === 'ar' ? 'تعديل' : 'Edit'}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleDisable(u)} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title={u.is_disabled ? (language === 'ar' ? 'تفعيل' : 'Enable') : (language === 'ar' ? 'تعطيل' : 'Disable')}>
                            {u.is_disabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteUser(u)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={language === 'ar' ? 'حذف' : 'Delete'}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {modalMode === 'add' ? (language === 'ar' ? 'إضافة مستخدم' : 'Add User') : (language === 'ar' ? 'تعديل المستخدم' : 'Edit User')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
              )}
              {modalMode === 'add' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'كلمة المرور' : 'Password'} *</label>
                    <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="ltr" />
                  </div>
                </>
              )}
              {modalMode === 'edit' && editingUser && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span dir="ltr">{editingUser.email}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الدور' : 'Role'} *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm">
                  {USER_ROLES.map(r => (
                    <option key={r} value={r}>
                      {language === 'ar' ? ROLE_INFO[r].ar : ROLE_INFO[r].en}
                    </option>
                  ))}
                </select>
              </div>
              {form.role !== 'system_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'القطاع' : 'Track'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: '',            ar: 'بلا تقييد',  en: 'No track' },
                      { value: 'maintenance', ar: 'صيانة',     en: 'Maintenance' },
                      { value: 'operations',  ar: 'تشغيل',     en: 'Operations' },
                    ].map(opt => (
                      <button
                        key={opt.value || 'none'}
                        type="button"
                        onClick={() => setForm({ ...form, track: opt.value })}
                        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                          form.track === opt.value
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {language === 'ar' ? opt.ar : opt.en}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                    {language === 'ar'
                      ? '“بلا تقييد” = المستخدم يشوف كل الأقسام بدون تحديد.'
                      : '“No track” means the user can access every section.'}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
