'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Loader2, Building2, Save, X, Clock, Car } from 'lucide-react'

interface Company {
  id: string
  name_ar: string
  name_en: string
  description_ar: string | null
  description_en: string | null
  is_active: boolean
  created_at: string
  sla_settings?: any
}

export default function CompaniesManagement() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [vehicleCounts, setVehicleCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [slaCompany, setSlaCompany] = useState<Company | null>(null)
  const [slaForm, setSlaForm] = useState<any>(null)
  const [savingSla, setSavingSla] = useState(false)
  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    description_ar: '',
    description_en: '',
    is_active: true,
  })

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    const supabase = createClient()

    const [{ data: companiesData }, { data: countsData }] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      // استخدام دالة RPC تتجاوز RLS لإرجاع العدد الحقيقي لكل شركة
      supabase.rpc('get_vehicle_counts_per_company'),
    ])

    if (companiesData) setCompanies(companiesData)

    // بناء خريطة الأعداد { company_id: count }
    if (countsData) {
      const countMap: Record<string, number> = {}
      for (const row of countsData) {
        if (row.company_id) {
          countMap[row.company_id] = Number(row.vehicle_count)
        }
      }
      setVehicleCounts(countMap)
    }

    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', description_ar: '', description_en: '', is_active: true })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (company: Company) => {
    setForm({
      name_ar: company.name_ar,
      name_en: company.name_en,
      description_ar: company.description_ar || '',
      description_en: company.description_en || '',
      is_active: company.is_active,
    })
    setEditingId(company.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name_ar || !form.name_en) return
    setSaving(true)

    const supabase = createClient()

    if (editingId) {
      await supabase
        .from('companies')
        .update({
          name_ar: form.name_ar,
          name_en: form.name_en,
          description_ar: form.description_ar || null,
          description_en: form.description_en || null,
          is_active: form.is_active,
        })
        .eq('id', editingId)
    } else {
      await supabase.from('companies').insert({
        name_ar: form.name_ar,
        name_en: form.name_en,
        description_ar: form.description_ar || null,
        description_en: form.description_en || null,
        is_active: form.is_active,
      })
    }

    setSaving(false)
    resetForm()
    loadCompanies()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشركة؟ / Are you sure you want to delete this company?')) return
    const supabase = createClient()
    await supabase.from('companies').delete().eq('id', id)
    loadCompanies()
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    const supabase = createClient()
    await supabase.from('companies').update({ is_active: !currentState }).eq('id', id)
    loadCompanies()
  }

  const openSlaModal = (company: Company) => {
    const defaultSLA = {
      mechanical: { normal: { days: 10, hours: 0 }, medium: { days: 10, hours: 0 }, high: { days: 10, hours: 0 } },
      accident: { normal: { days: 10, hours: 0 }, medium: { days: 10, hours: 0 }, high: { days: 10, hours: 0 } }
    }
    setSlaForm(company.sla_settings || defaultSLA)
    setSlaCompany(company)
  }

  const saveSlaSettings = async () => {
    if (!slaCompany || !slaForm) return
    setSavingSla(true)
    const supabase = createClient()
    await supabase.from('companies').update({ sla_settings: slaForm }).eq('id', slaCompany.id)
    setSavingSla(false)
    setSlaCompany(null)
    loadCompanies()
  }

  const handleSlaChange = (type: 'mechanical' | 'accident', severity: 'normal' | 'medium' | 'high', field: 'days' | 'hours', value: number) => {
    setSlaForm((prev: any) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [severity]: {
          ...prev[type]?.[severity],
          [field]: value
        }
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            إدارة الشركات / Companies Management
          </h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة شركة
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-5 border border-gray-200 dark:border-slate-700 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {editingId ? 'تعديل الشركة / Edit Company' : 'إضافة شركة جديدة / Add New Company'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الاسم بالعربي *
              </label>
              <input
                type="text"
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="اسم الشركة بالعربي"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name (English) *
              </label>
              <input
                type="text"
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Company name in English"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الوصف بالعربي
              </label>
              <input
                type="text"
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="وصف اختياري"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (English)
              </label>
              <input
                type="text"
                value={form.description_en}
                onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              نشطة / Active
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.name_ar || !form.name_en}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-sm"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">لا توجد شركات / No companies yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => {
            const vCount = vehicleCounts[company.id] ?? 0
            return (
              <div
                key={company.id}
                className="relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Status Bar */}
                <div className={`h-1.5 w-full ${company.is_active ? 'bg-red-500' : 'bg-gray-400'}`} />

                <div className="p-5">
                  {/* Company Name */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${company.is_active ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-slate-700'
                        }`}>
                        <Building2 className={`w-5 h-5 ${company.is_active ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{company.name_ar}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{company.name_en}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(company.id, company.is_active)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${company.is_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                    >
                      {company.is_active ? 'نشطة' : 'معطلة'}
                    </button>
                  </div>

                  {/* Vehicle Count — the main stat */}
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">
                        {vCount.toLocaleString('ar-EG')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">مركبة مسجلة</p>
                    </div>
                  </div>

                  {company.description_ar && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 line-clamp-1">{company.description_ar}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => openSlaModal(company)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" /> SLA
                    </button>
                    <button
                      onClick={() => handleEdit(company)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-700 dark:text-gray-300 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SLA Modal */}
      {slaCompany && slaForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-500" />
                توقيت الإنجاز (SLA) لشركة: {slaCompany.name_ar}
              </h3>
              <button onClick={() => setSlaCompany(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6 flex-1">
              {['mechanical', 'accident'].map((type) => (
                <div key={type} className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                  <h4 className="font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    {type === 'mechanical' ? '⚙️ قسم الميكانيكا' : '🔨 قسم الحوادث'}
                  </h4>
                  <div className="space-y-3">
                    {['normal', 'medium', 'high'].map(sev => {
                      const label = sev === 'normal' ? 'اعتيادي' : sev === 'medium' ? 'متوسط' : 'عالي';
                      const color = sev === 'normal' ? 'text-red-600' : sev === 'medium' ? 'text-yellow-600' : 'text-red-500';
                      return (
                        <div key={sev} className="grid grid-cols-12 gap-3 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                          <div className={`col-span-4 font-medium text-sm ${color}`}>الضرر: {label}</div>
                          <div className="col-span-4 flex items-center gap-2">
                            <input
                              type="number" min="0"
                              value={slaForm[type]?.[sev]?.days ?? 10}
                              onChange={(e) => handleSlaChange(type as any, sev as any, 'days', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span className="text-xs text-gray-500">أيام</span>
                          </div>
                          <div className="col-span-4 flex items-center gap-2">
                            <input
                              type="number" min="0" max="23"
                              value={slaForm[type]?.[sev]?.hours ?? 0}
                              onChange={(e) => handleSlaChange(type as any, sev as any, 'hours', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span className="text-xs text-gray-500">ساعات</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900">
              <button onClick={() => setSlaCompany(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors">إلغاء</button>
              <button
                onClick={saveSlaSettings}
                disabled={savingSla}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {savingSla ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التوقيت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

