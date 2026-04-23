'use client'

// =====================================================
// Create Misuse Registration — /forms/misuse/new
// -----------------------------------------------------
// Plate-number is the single vehicle entry point: the user types
// a plate, picks one from the live DB suggestion list, and the
// rest of the vehicle fields auto-fill from `vehicles`.
// Supervisor-only: a client guard redirects normal users.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Loader2, Car, Wrench, Package, StickyNote,
  Shield, Search, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import { toast } from '@/components/ui/Toast'
import { generateMisusePDF } from '@/lib/pdf/misuse'
import { askPdfLanguage } from '@/lib/pdf/shared'
import {
  type MisuseLaborItem,
  type MisuseSparePartItem,
  type MisuseRegistrationWithItems,
  DEFAULT_VAT_PERCENTAGE,
  computeMisuseTotals,
  formatCurrency,
  formatMisuseNumber,
} from '@/lib/misuse/types'

interface VehicleHit {
  id: string
  plate_number: string | null
  plate_number_ar: string | null
  chassis_number: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  project_code: string | null
}

function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const newLabor = (row: number): MisuseLaborItem =>
  ({ row_number: row, description: '', cost: 0 })
const newPart = (row: number): MisuseSparePartItem =>
  ({ row_number: row, part_name: '', quantity: 1, unit_price: 0 })

export default function CreateMisusePage() {
  const router = useRouter()
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const { loading: roleLoading, isCompanyManager } = useRole()

  // ─── Supervisor-only route guard ───
  useEffect(() => {
    if (roleLoading) return
    if (!isCompanyManager) router.replace('/forms')
  }, [roleLoading, isCompanyManager, router])

  // ─── Form state ───
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [registrationDate, setRegistrationDate] = useState(todayStr())

  // Vehicle fields — plate search is the only entry point.
  const [plateQuery, setPlateQuery] = useState('')
  const [plateSuggestions, setPlateSuggestions] = useState<VehicleHit[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingPlates, setSearchingPlates] = useState(false)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [plateNumber, setPlateNumber] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [projectName, setProjectName] = useState('')

  const [labor, setLabor] = useState<MisuseLaborItem[]>([newLabor(1)])
  const [parts, setParts] = useState<MisuseSparePartItem[]>([newPart(1)])
  const [discountPct, setDiscountPct] = useState<number>(0)
  const [vatPct, setVatPct] = useState<number>(DEFAULT_VAT_PERCENTAGE)
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)

  // ─── Next registration number suggestion ───
  useEffect(() => { reserveNextNumber() }, [])

  const reserveNextNumber = async () => {
    const year = new Date().getFullYear()
    const supabase = createClient()
    const { data } = await supabase
      .from('misuse_registrations')
      .select('registration_number')
      .like('registration_number', `MU-${year}-%`)
      .order('registration_number', { ascending: false })
      .limit(1)
    const last = (data && data[0]?.registration_number) || ''
    const match = last.match(/MU-\d{4}-(\d+)/)
    const next = match ? Number(match[1]) + 1 : 1
    setRegistrationNumber(formatMisuseNumber(year, next))
  }

  // ─── Plate live search (debounced) ───
  useEffect(() => {
    if (!plateQuery || plateQuery.trim().length < 1) {
      setPlateSuggestions([])
      return
    }
    const handle = setTimeout(async () => {
      setSearchingPlates(true)
      const supabase = createClient()
      const needle = `%${plateQuery.trim()}%`
      const { data } = await supabase
        .from('vehicles')
        .select('id, plate_number, plate_number_ar, chassis_number, brand, manufacturer, model, project_code')
        .or(`plate_number.ilike.${needle},plate_number_ar.ilike.${needle}`)
        .limit(12)
      setPlateSuggestions((data as VehicleHit[]) ?? [])
      setSearchingPlates(false)
    }, 220)
    return () => clearTimeout(handle)
  }, [plateQuery])

  const pickVehicle = (v: VehicleHit) => {
    setVehicleId(v.id)
    setPlateNumber(v.plate_number || v.plate_number_ar || '')
    setPlateQuery(v.plate_number || v.plate_number_ar || '')
    // Auto-fill the rest from DB.
    const vehicleTypeDerived = [v.manufacturer, v.brand, v.model].filter(Boolean).join(' ')
    setVehicleType(vehicleTypeDerived)
    setProjectName(v.project_code || '')
    setShowSuggestions(false)
  }

  // ─── Dynamic rows ───
  const addLabor = () => setLabor(prev => [...prev, newLabor(prev.length + 1)])
  const removeLabor = (i: number) =>
    setLabor(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, row_number: idx + 1 })))
  const updateLabor = (i: number, patch: Partial<MisuseLaborItem>) =>
    setLabor(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const addPart = () => setParts(prev => [...prev, newPart(prev.length + 1)])
  const removePart = (i: number) =>
    setParts(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, row_number: idx + 1 })))
  const updatePart = (i: number, patch: Partial<MisuseSparePartItem>) =>
    setParts(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  // ─── Live totals ───
  const totals = useMemo(
    () => computeMisuseTotals(labor, parts, discountPct, vatPct),
    [labor, parts, discountPct, vatPct]
  )

  // ─── Save (+ optional PDF) ───
  const save = async (opts: { exportAfter?: boolean } = {}) => {
    if (!plateNumber.trim()) {
      toast.warning(isAr ? 'يرجى إدخال رقم اللوحة' : 'Please enter a plate number')
      return
    }
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const parentPayload = {
      registration_number: registrationNumber,
      registration_date:   registrationDate,
      project_name:        projectName || null,
      vehicle_id:          vehicleId,
      vehicle_type:        vehicleType || null,
      plate_number:        plateNumber,
      notes:               notes || null,
      subtotal:            totals.subtotal,
      discount_percentage: Number(discountPct) || 0,
      discount_amount:     totals.discount_amount,
      vat_percentage:      Number(vatPct) || 0,
      vat_amount:          totals.vat_amount,
      total:               totals.total,
      created_by:          user?.id ?? null,
      last_updated_by:     user?.id ?? null,
    }

    const { data: inserted, error } = await supabase
      .from('misuse_registrations')
      .insert(parentPayload)
      .select('*')
      .single()

    if (error || !inserted) {
      setSaving(false)
      toast.error(error?.message || (isAr ? 'فشل الحفظ' : 'Save failed'))
      return
    }

    // Insert children (labor + parts) — only rows that have content.
    const laborRows = labor
      .filter(l => l.description.trim())
      .map(l => ({
        misuse_id:   (inserted as any).id,
        row_number:  l.row_number,
        description: l.description.trim(),
        cost:        Number(l.cost) || 0,
      }))
    const partRows = parts
      .filter(p => p.part_name.trim())
      .map(p => ({
        misuse_id:  (inserted as any).id,
        row_number: p.row_number,
        part_name:  p.part_name.trim(),
        quantity:   Number(p.quantity) || 0,
        unit_price: Number(p.unit_price) || 0,
      }))

    if (laborRows.length > 0) {
      const { error: lErr } = await supabase.from('misuse_labor_items').insert(laborRows)
      if (lErr) { setSaving(false); toast.error(lErr.message); return }
    }
    if (partRows.length > 0) {
      const { error: pErr } = await supabase.from('misuse_spare_part_items').insert(partRows)
      if (pErr) { setSaving(false); toast.error(pErr.message); return }
    }

    setSaving(false)
    toast.success((isAr ? 'تم الحفظ ' : 'Saved ') + (inserted as any).registration_number + ' ✓')

    if (opts.exportAfter) {
      const pdfLang = await askPdfLanguage(language as 'ar' | 'en')
      if (pdfLang) {
        generateMisusePDF({
          ...(inserted as any),
          labor_items:      labor.filter(l => l.description.trim()),
          spare_part_items: parts.filter(p => p.part_name.trim()),
        } as MisuseRegistrationWithItems, pdfLang)
      }
    }
    router.push(`/forms/misuse/${(inserted as any).id}`)
  }

  if (roleLoading || !isCompanyManager) {
    return (
      <div className="p-10 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const cardCls = 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-4'

  return (
    <div className="space-y-5 max-w-6xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push('/forms/misuse')}
          className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'تسجيل حالة سوء استخدام جديدة' : 'New Misuse Registration'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isAr ? 'نموذج سوء الاستخدام / تحميل تكلفة الإصلاح' : 'Misuse form / Repair cost charge'}
          </p>
        </div>
      </div>

      {/* Basic info */}
      <div className={cardCls}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Car className="w-4 h-4 text-red-600" />
          {isAr ? 'المعلومات الأساسية' : 'Basic Information'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>{isAr ? 'رقم السجل' : 'Registration #'}</label>
            <input value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{isAr ? 'التاريخ' : 'Date'}</label>
            <input type="date" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)} className={inputCls} />
          </div>

          {/* Plate search (entry point) */}
          <div className="relative">
            <label className={labelCls}>{isAr ? 'رقم اللوحة (إنجليزي)' : 'Plate Number (English)'}</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={plateQuery}
                onChange={(e) => {
                  setPlateQuery(e.target.value)
                  setPlateNumber(e.target.value)
                  setShowSuggestions(true)
                  if (!e.target.value.trim()) { setVehicleId(null); setVehicleType(''); setProjectName('') }
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                placeholder={isAr ? 'ابحث برقم اللوحة' : 'Search by plate'}
                className={`${inputCls} ps-9`}
                dir="ltr"
              />
            </div>
            {showSuggestions && (plateSuggestions.length > 0 || searchingPlates) && (
              <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {searchingPlates && (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    <Loader2 className="w-3 h-3 inline-block animate-spin me-1" />
                    {isAr ? 'جاري البحث...' : 'Searching...'}
                  </div>
                )}
                {plateSuggestions.map(v => (
                  <button
                    type="button"
                    key={v.id}
                    onMouseDown={(e) => { e.preventDefault(); pickVehicle(v) }}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 border-b last:border-0 border-gray-100 dark:border-slate-700"
                  >
                    <div className="font-mono font-bold text-gray-900 dark:text-white" dir="ltr">
                      {v.plate_number || v.plate_number_ar || '-'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[v.manufacturer, v.brand, v.model].filter(Boolean).join(' · ')}
                      {v.project_code ? ` — ${v.project_code}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>{isAr ? 'اسم المشروع' : 'Project Name'}</label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>{isAr ? 'نوع السيارة' : 'Vehicle Type'}</label>
            <input value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls} placeholder={isAr ? 'يتم التعبئة تلقائياً عند اختيار اللوحة' : 'Auto-filled when you pick a plate'} />
          </div>
        </div>
      </div>

      {/* Labor items */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-red-600" />
            {isAr ? 'الأعمال' : 'Labor'}
          </h2>
          <button onClick={addLabor} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">
            <Plus className="w-3.5 h-3.5" /> {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {labor.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr,140px,auto] gap-2 items-start">
              <input placeholder={isAr ? 'وصف العمل' : 'Work description'} value={row.description} onChange={e => updateLabor(i, { description: e.target.value })} className={inputCls} />
              <input type="number" step="0.01" min={0} placeholder={isAr ? 'التكلفة' : 'Cost'} value={row.cost || ''} onChange={e => updateLabor(i, { cost: Number(e.target.value) || 0 })} className={`${inputCls} text-end font-mono`} />
              <button onClick={() => removeLabor(i)} className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end text-sm font-semibold text-gray-700 dark:text-gray-300">
          {isAr ? 'إجمالي تكلفة الأعمال:' : 'Labor total:'}&nbsp;
          <span className="font-mono">{formatCurrency(totals.labor_total)} ر.س</span>
        </div>
      </div>

      {/* Spare parts */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-red-600" />
            {isAr ? 'قطع الغيار' : 'Spare Parts'}
          </h2>
          <button onClick={addPart} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">
            <Plus className="w-3.5 h-3.5" /> {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {parts.map((row, i) => {
            const line = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)
            return (
              <div key={i} className="grid grid-cols-[1fr,100px,120px,120px,auto] gap-2 items-start">
                <input placeholder={isAr ? 'اسم القطعة' : 'Part name'} value={row.part_name} onChange={e => updatePart(i, { part_name: e.target.value })} className={inputCls} />
                <input type="number" step="0.01" min={0} placeholder={isAr ? 'الكمية' : 'Qty'} value={row.quantity || ''} onChange={e => updatePart(i, { quantity: Number(e.target.value) || 0 })} className={`${inputCls} text-end font-mono`} />
                <input type="number" step="0.01" min={0} placeholder={isAr ? 'سعر الوحدة' : 'Unit price'} value={row.unit_price || ''} onChange={e => updatePart(i, { unit_price: Number(e.target.value) || 0 })} className={`${inputCls} text-end font-mono`} />
                <div className={`${inputCls} text-end font-mono bg-gray-50 dark:bg-slate-900/50 cursor-default`}>{formatCurrency(line)}</div>
                <button onClick={() => removePart(i)} className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end text-sm font-semibold text-gray-700 dark:text-gray-300">
          {isAr ? 'إجمالي تكلفة قطع الغيار:' : 'Parts total:'}&nbsp;
          <span className="font-mono">{formatCurrency(totals.parts_total)} ر.س</span>
        </div>
      </div>

      {/* Notes */}
      <div className={cardCls}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-red-600" />
          {isAr ? 'ملاحظات' : 'Notes'}
        </h2>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder={isAr ? 'اختياري...' : 'Optional...'} />
      </div>

      {/* Totals + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save({ exportAfter: false })}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isAr ? 'حفظ التسجيل' : 'Save'}
          </button>
          <button
            onClick={() => save({ exportAfter: true })}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isAr ? 'حفظ وتصدير PDF' : 'Save & Export PDF'}
          </button>
          <button
            onClick={() => router.push('/forms/misuse')}
            className="px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
            {isAr ? 'الإجمالي' : 'Totals'}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
            <div className="flex justify-between px-4 py-2">
              <span className="text-gray-500">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="font-mono">{formatCurrency(totals.subtotal)} ر.س</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2">
              <span className="text-gray-500">{isAr ? 'الخصم %' : 'Discount %'}</span>
              <input type="number" step="0.01" min={0} max={100} value={discountPct} onChange={e => setDiscountPct(Number(e.target.value) || 0)} className="w-20 px-2 py-1 text-end font-mono border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800" />
            </div>
            <div className="flex justify-between px-4 py-2 text-gray-500">
              <span>{isAr ? 'قيمة الخصم' : 'Discount amt'}</span>
              <span className="font-mono">{formatCurrency(totals.discount_amount)} ر.س</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2">
              <span className="text-gray-500">{isAr ? 'ضريبة %' : 'VAT %'}</span>
              <input type="number" step="0.01" min={0} max={100} value={vatPct} onChange={e => setVatPct(Number(e.target.value) || 0)} className="w-20 px-2 py-1 text-end font-mono border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800" />
            </div>
            <div className="flex justify-between px-4 py-2 text-gray-500">
              <span>{isAr ? 'قيمة الضريبة' : 'VAT amt'}</span>
              <span className="font-mono">{formatCurrency(totals.vat_amount)} ر.س</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-red-600 text-white font-bold">
              <span>{isAr ? 'الإجمالي النهائي' : 'Grand Total'}</span>
              <span className="font-mono">{formatCurrency(totals.total)} ر.س</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
