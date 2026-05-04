'use client'

// =====================================================
// Admin — Workshop Management (إدارة الورش)
// -----------------------------------------------------
// Replaces the old company-management page in the admin UI.
// The DB "companies" table is untouched for back-compat.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Wrench, Plus, Loader2, X, Edit2, Trash2, Search,
  MapPin, Globe, BadgeCheck, ToggleLeft, ToggleRight,
  Upload, CheckCircle2,
} from 'lucide-react'
import {
  COVERAGE_LABEL_AR, COVERAGE_LABEL_EN, SAUDI_CITY_COORDS, WORKSHOP_SEED,
  type CoverageType,
} from '@/lib/workshops/seed'
import { toast } from '@/components/ui/Toast'

interface Workshop {
  id: string
  workshop_name_ar: string
  workshop_name_en: string | null
  slug: string | null
  city_ar: string | null
  city_en: string | null
  coverage_type: CoverageType
  is_agency: boolean
  latitude: number | null
  longitude: number | null
  active_status: boolean
  notes: string | null
}

interface CaseCount {
  workshop_id: string
  total_cases: number
  open_cases: number
  closed_cases: number
}

const EMPTY_FORM = {
  workshop_name_ar: '',
  workshop_name_en: '',
  slug: '',
  city_ar: '',
  coverage_type: 'city' as CoverageType,
  is_agency: false,
  latitude: '' as number | '',
  longitude: '' as number | '',
  active_status: true,
  notes: '',
}

export default function AdminWorkshopsPage() {
  const { language } = useTranslation()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [counts, setCounts] = useState<Map<string, CaseCount>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [coverageFilter, setCoverageFilter] = useState<'all' | CoverageType>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Workshop | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: ws, error: e1 }, { data: cc }] = await Promise.all([
      supabase.from('workshops').select('*').order('coverage_type').order('workshop_name_ar'),
      // view may not exist yet if migration hasn't run — ignore errors
      supabase.from('v_workshop_case_counts').select('workshop_id, total_cases, open_cases, closed_cases'),
    ])
    if (e1) console.error('workshops load:', e1)
    setWorkshops((ws as Workshop[]) ?? [])
    const m = new Map<string, CaseCount>()
    for (const r of (cc as CaseCount[] | null) ?? []) m.set(r.workshop_id, r)
    setCounts(m)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ─── Seeding (one-click populate of the master list) ───
  const handleSeed = async () => {
    setSeeding(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('workshops')
      .insert(
        WORKSHOP_SEED.map(w => ({
          workshop_name_ar: w.workshop_name_ar,
          city_ar: w.city_ar,
          coverage_type: w.coverage_type,
          is_agency: w.is_agency,
          latitude: w.latitude,
          longitude: w.longitude,
        }))
      )
    setSeeding(false)
    if (error) {
      // Duplicates are OK - means workshops already exist
      if (error.message.includes('duplicate') || error.code === '23505') {
        toast.success('تم تحديث قائمة الورش (الورش الموجودة تم تجاهلها)')
        load()
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success('تم تحميل قائمة الورش الأساسية')
      load()
    }
  }

  // ─── Modal ───
  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }
  const openEdit = (w: Workshop) => {
    setEditing(w)
    setForm({
      workshop_name_ar: w.workshop_name_ar,
      workshop_name_en: w.workshop_name_en ?? '',
      slug: w.slug ?? '',
      city_ar: w.city_ar ?? '',
      coverage_type: w.coverage_type,
      is_agency: w.is_agency,
      latitude: w.latitude ?? '',
      longitude: w.longitude ?? '',
      active_status: w.active_status,
      notes: w.notes ?? '',
    })
    setModalOpen(true)
  }

  // Auto-fill coords when a known city is picked and coords are blank
  const onCityChange = (cityAr: string) => {
    const c = SAUDI_CITY_COORDS[cityAr]
    setForm(f => ({
      ...f,
      city_ar: cityAr,
      latitude:  f.latitude  === '' && c ? c.lat : f.latitude,
      longitude: f.longitude === '' && c ? c.lng : f.longitude,
    }))
  }

  // Coverage change tweaks related defaults
  const onCoverageChange = (c: CoverageType) => {
    setForm(f => ({
      ...f,
      coverage_type: c,
      is_agency: c === 'nationwide' ? true : c === 'nationwide_non_agency' ? false : f.is_agency,
      city_ar: c === 'city' ? f.city_ar : '',
      latitude:  c === 'city' ? f.latitude  : '',
      longitude: c === 'city' ? f.longitude : '',
    }))
  }

  const handleSave = async () => {
    if (!form.workshop_name_ar.trim()) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      workshop_name_ar: form.workshop_name_ar.trim(),
      workshop_name_en: form.workshop_name_en.trim() || null,
      slug: form.slug.trim() || null,
      city_ar: form.coverage_type === 'city' ? (form.city_ar.trim() || null) : null,
      coverage_type: form.coverage_type,
      is_agency: form.is_agency,
      latitude:  form.latitude  === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      active_status: form.active_status,
      notes: form.notes.trim() || null,
    }

    const { error } = editing
      ? await supabase.from('workshops').update(payload).eq('id', editing.id)
      : await supabase.from('workshops').insert(payload)

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'تم تحديث الورشة ✓' : 'تمت إضافة الورشة ✓')
    setModalOpen(false)
    load()
  }

  const toggleActive = async (w: Workshop) => {
    const supabase = createClient()
    const { error } = await supabase.from('workshops')
      .update({ active_status: !w.active_status }).eq('id', w.id)
    if (error) toast.error(error.message)
    else load()
  }

  const handleDelete = async (w: Workshop) => {
    if (!confirm(`حذف الورشة "${w.workshop_name_ar}"؟`)) return
    const supabase = createClient()
    const { error } = await supabase.from('workshops').delete().eq('id', w.id)
    if (error) toast.error(error.message)
    else { toast.success('تم الحذف'); load() }
  }

  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase()
    return workshops.filter(w => {
      if (coverageFilter !== 'all' && w.coverage_type !== coverageFilter) return false
      if (!n) return true
      return [w.workshop_name_ar, w.workshop_name_en, w.city_ar]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(n))
    })
  }, [workshops, search, coverageFilter])

  const stats = useMemo(() => ({
    total:    workshops.length,
    city:     workshops.filter(w => w.coverage_type === 'city').length,
    agencies: workshops.filter(w => w.is_agency).length,
    active:   workshops.filter(w => w.active_status).length,
  }), [workshops])

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-red-600" />
            {language === 'ar' ? 'إدارة الورش' : 'Workshop Management'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar'
              ? 'قاعدة بيانات الورش المعتمدة — تُستخدم لاحقاً في خريطة لوحة التحكم'
              : 'Approved workshops database — powers the upcoming dashboard map'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {workshops.length === 0 ? 'تحميل القائمة الأساسية' : 'إعادة تحميل القائمة'}
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {language === 'ar' ? 'إضافة ورشة' : 'Add Workshop'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={language === 'ar' ? 'إجمالي الورش' : 'Total'}      value={stats.total}    Icon={Wrench}     tone="red" />
        <StatCard label={language === 'ar' ? 'ورش المدن' : 'City-based'}    value={stats.city}     Icon={MapPin}     tone="blue" />
        <StatCard label={language === 'ar' ? 'وكلاء' : 'Agencies'}          value={stats.agencies} Icon={BadgeCheck} tone="amber" />
        <StatCard label={language === 'ar' ? 'نشطة' : 'Active'}             value={stats.active}   Icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو المدينة..."
            className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs">
          {(['all', 'city', 'nationwide', 'nationwide_non_agency'] as const).map(k => (
            <button
              key={k}
              onClick={() => setCoverageFilter(k)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                coverageFilter === k
                  ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {k === 'all' ? 'الكل' : (language === 'ar' ? COVERAGE_LABEL_AR[k] : COVERAGE_LABEL_EN[k])}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
      ) : workshops.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <Wrench className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {language === 'ar' ? 'لا توجد ورش بعد' : 'No workshops yet'}
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 inline-flex items-center gap-2"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            تحميل قائمة الورش الأساسية ({WORKSHOP_SEED.length})
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((w) => {
            const cc = counts.get(w.id)
            const Icon = w.coverage_type === 'city' ? MapPin : Globe
            const tone = w.is_agency
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
              : w.coverage_type === 'city'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
            return (
              <div key={w.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${tone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{w.workshop_name_ar}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {w.city_ar || COVERAGE_LABEL_AR[w.coverage_type]}
                        {w.is_agency && <span className="ms-1 text-amber-600">· وكالة</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                    w.active_status
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'
                  }`}>
                    {w.active_status ? 'نشط' : 'معطل'}
                  </span>
                </div>

                {/* Case counts from v_workshop_case_counts */}
                <div className="grid grid-cols-3 gap-2 mt-1 mb-3">
                  <MiniStat label="الحالات" value={cc?.total_cases ?? 0} />
                  <MiniStat label="مفتوحة" value={cc?.open_cases ?? 0} tone="amber" />
                  <MiniStat label="مغلقة"  value={cc?.closed_cases ?? 0} tone="emerald" />
                </div>

                {w.latitude !== null && w.longitude !== null && (
                  <p className="text-[11px] text-gray-400 font-mono mb-3">
                    {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                  </p>
                )}

                <div className="flex items-center gap-1 pt-3 mt-auto border-t border-gray-100 dark:border-slate-800">
                  <button onClick={() => openEdit(w)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                    <Edit2 className="w-3.5 h-3.5" /> تعديل
                  </button>
                  <button onClick={() => toggleActive(w)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                    {w.active_status ? <ToggleRight className="w-3.5 h-3.5 text-red-500" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {w.active_status ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button onClick={() => handleDelete(w)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl my-4" dir="rtl">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">
                {editing ? 'تعديل الورشة' : 'إضافة ورشة جديدة'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="اسم الورشة (عربي) *">
                <input
                  value={form.workshop_name_ar}
                  onChange={(e) => setForm(f => ({ ...f, workshop_name_ar: e.target.value }))}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم الورشة (إنجليزي)">
                  <input dir="ltr"
                    value={form.workshop_name_en}
                    onChange={(e) => setForm(f => ({ ...f, workshop_name_en: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="المعرّف المختصر (اختياري)">
                  <input dir="ltr"
                    value={form.slug}
                    onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="awael-jed"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="نوع التغطية">
                <div className="grid grid-cols-3 gap-2">
                  {(['city', 'nationwide', 'nationwide_non_agency'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onCoverageChange(c)}
                      className={`p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        form.coverage_type === c
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-red-300'
                      }`}
                    >
                      {COVERAGE_LABEL_AR[c]}
                    </button>
                  ))}
                </div>
              </Field>

              {form.coverage_type === 'city' && (
                <Field label="المدينة">
                  <select
                    value={form.city_ar}
                    onChange={(e) => onCityChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— اختر —</option>
                    {Object.keys(SAUDI_CITY_COORDS).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {form.city_ar && !SAUDI_CITY_COORDS[form.city_ar] && (
                      <option value={form.city_ar}>{form.city_ar}</option>
                    )}
                  </select>
                </Field>
              )}

              {form.coverage_type !== 'city' && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.is_agency}
                    onChange={(e) => setForm(f => ({ ...f, is_agency: e.target.checked }))}
                    className="accent-red-600"
                  />
                  وكالة (Agency)
                </label>
              )}

              {form.coverage_type === 'city' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="خط العرض (Latitude)">
                    <input type="number" step="0.000001" dir="ltr"
                      value={form.latitude}
                      onChange={(e) => setForm(f => ({ ...f, latitude: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="خط الطول (Longitude)">
                    <input type="number" step="0.000001" dir="ltr"
                      value={form.longitude}
                      onChange={(e) => setForm(f => ({ ...f, longitude: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              <Field label="ملاحظات (اختياري)">
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-y`}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.active_status}
                  onChange={(e) => setForm(f => ({ ...f, active_status: e.target.checked }))}
                  className="accent-red-600"
                />
                ورشة نشطة
              </label>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800">
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.workshop_name_ar.trim()}
                className="px-5 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small helpers kept local to reduce churn ───
const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function StatCard({ label, value, Icon, tone }: { label: string; value: number; Icon: any; tone: 'red'|'blue'|'amber'|'emerald' }) {
  const colour: Record<string, string> = {
    red:     'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',
    blue:    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    amber:   'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300',
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colour[tone]}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-bold text-gray-900 dark:text-white text-lg">{value}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate'|'amber'|'emerald' }) {
  const cls: Record<string, string> = {
    slate:   'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300',
    amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  }
  return (
    <div className={`rounded-lg p-2 text-center ${cls[tone]}`}>
      <p className="text-[10px] opacity-75">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  )
}
