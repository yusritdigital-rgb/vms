'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Plus, Loader2, X, Edit2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

interface Company {
  id: string
  name_ar: string
  name_en: string
  description_ar: string | null
  description_en: string | null
  is_active: boolean
  max_vehicles: number
  created_at: string
}

export default function AdminCompaniesPage() {
  const { language } = useTranslation()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', description_ar: '', description_en: '', max_vehicles: 0 })

  useEffect(() => { loadCompanies() }, [])

  const loadCompanies = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    if (data) setCompanies(data)
    setLoading(false)
  }

  const openAdd = () => {
    setEditingCompany(null)
    setForm({ name_ar: '', name_en: '', description_ar: '', description_en: '', max_vehicles: 0 })
    setShowModal(true)
  }

  const openEdit = (c: Company) => {
    setEditingCompany(c)
    setForm({ name_ar: c.name_ar, name_en: c.name_en, description_ar: c.description_ar || '', description_en: c.description_en || '', max_vehicles: c.max_vehicles || 0 })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name_ar || !form.name_en) return
    setSaving(true)
    const supabase = createClient()

    if (editingCompany) {
      await supabase.from('companies').update({
        name_ar: form.name_ar,
        name_en: form.name_en,
        description_ar: form.description_ar || null,
        description_en: form.description_en || null,
        max_vehicles: form.max_vehicles || 0,
      }).eq('id', editingCompany.id)
    } else {
      await supabase.from('companies').insert({
        name_ar: form.name_ar,
        name_en: form.name_en,
        description_ar: form.description_ar || null,
        description_en: form.description_en || null,
        max_vehicles: form.max_vehicles || 0,
      })
    }

    setSaving(false)
    setShowModal(false)
    loadCompanies()
  }

  const toggleActive = async (c: Company) => {
    const supabase = createClient()
    await supabase.from('companies').update({ is_active: !c.is_active }).eq('id', c.id)
    loadCompanies()
  }

  const deleteCompany = async (c: Company) => {
    const confirmed = window.confirm(language === 'ar' ? `هل تريد حذف شركة "${c.name_ar}"؟ سيتم حذف جميع بياناتها.` : `Delete "${c.name_en}"? All its data will be removed.`)
    if (!confirmed) return
    const supabase = createClient()
    await supabase.from('companies').delete().eq('id', c.id)
    loadCompanies()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'إدارة الشركات' : 'Companies Management'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? `${companies.length} شركة` : `${companies.length} companies`}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm">
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة شركة' : 'Add Company'}
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'لا توجد شركات بعد' : 'No companies yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <div key={c.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{c.name_ar}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.name_en}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {c.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')}
                </span>
              </div>
              {c.description_ar && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{language === 'ar' ? c.description_ar : c.description_en}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>{language === 'ar' ? 'عدد المركبات:' : 'Max Vehicles:'} <strong className="text-gray-900 dark:text-white">{c.max_vehicles || 0}</strong></span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button onClick={() => openEdit(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'تعديل' : 'Edit'}
                </button>
                <button onClick={() => toggleActive(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  {c.is_active ? <ToggleRight className="w-3.5 h-3.5 text-red-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-500" />}
                  {c.is_active ? (language === 'ar' ? 'تعطيل' : 'Deactivate') : (language === 'ar' ? 'تفعيل' : 'Activate')}
                </button>
                <button onClick={() => deleteCompany(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingCompany ? (language === 'ar' ? 'تعديل الشركة' : 'Edit Company') : (language === 'ar' ? 'إضافة شركة' : 'Add Company')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'} *</label>
                  <input type="text" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'} *</label>
                  <input type="text" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'عدد المركبات' : 'Max Vehicles'}</label>
                <input type="number" min="0" value={form.max_vehicles} onChange={(e) => setForm({ ...form, max_vehicles: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الوصف بالعربي' : 'Arabic Description'}</label>
                <textarea value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الوصف بالإنجليزي' : 'English Description'}</label>
                <textarea value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleSave} disabled={saving || !form.name_ar || !form.name_en} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
