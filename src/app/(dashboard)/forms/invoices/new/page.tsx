'use client'

// =====================================================
// Create Invoice page — /forms/invoices/new
// -----------------------------------------------------
// Matches the layout of the mock (3 horizontal cards stacked):
//   1) Invoice info
//   2) Vehicle info (DB-backed searchable select)
//   3) Items table + totals panel
//   4) Notes + footer actions (إلغاء · إنشاء الفاتورة)
// Style tokens come from the rest of the dashboard so this page
// inherits the same look/spacing automatically.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, Loader2, Car, ClipboardList, Receipt, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect'
import { toast } from '@/components/ui/Toast'
import { generateInvoicePDF } from '@/lib/pdf/invoice'
import { askPdfLanguage } from '@/lib/pdf/shared'
import {
  type Invoice,
  type InvoiceItem,
  type InvoiceItemType,
  type InvoiceStatus,
  type InvoiceWithItems,
  DEFAULT_VAT_PERCENTAGE,
  INTERNAL_WORKSHOP_AR,
  ITEM_TYPE_LABEL_AR,
  REPAIR_TYPES,
  STATUS_LABEL_AR,
  computeTotals,
  formatCurrency,
  formatInvoiceNumber,
} from '@/lib/invoices/types'

interface Vehicle {
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

function newBlankItem(row: number): InvoiceItem {
  return { row_number: row, item_type: 'spare_part', description: '', quantity: 1, unit_price: 0 }
}

export default function CreateInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useTranslation()

  // Check if we're in edit mode
  const editInvoiceId = searchParams.get('edit')
  const isEditMode = !!editInvoiceId

  // ─── DB-backed vehicle list ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [loadingInvoice, setLoadingInvoice] = useState(false)

  // ─── Form state ───
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate]     = useState<string>(todayStr())
  const [status, setStatus]               = useState<InvoiceStatus>('draft')
  const [repairType, setRepairType]       = useState<string>(REPAIR_TYPES[1]) // ميكانيكا
  const [workshopName, setWorkshopName]   = useState<string>(INTERNAL_WORKSHOP_AR)
  const [maintenanceManager, setMaintenanceManager] = useState('')
  const [technician, setTechnician]       = useState('')
  const [workHours, setWorkHours]         = useState<number>(0)
  const [beneficiaryCompany, setBeneficiaryCompany] = useState('')

  const [vehicleId, setVehicleId]   = useState('')
  const [project, setProject]       = useState('')

  const [items, setItems] = useState<InvoiceItem[]>([newBlankItem(1)])
  const [vatPercentage, setVatPercentage] = useState<number>(DEFAULT_VAT_PERCENTAGE)
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)

  // ─── Effects ───
  useEffect(() => { loadVehicles(); if (!isEditMode) reserveNextInvoiceNumber() }, [isEditMode])

  // Load existing invoice data if in edit mode
  useEffect(() => {
    if (!isEditMode || !editInvoiceId) return
    loadInvoiceData(editInvoiceId)
  }, [isEditMode, editInvoiceId])

  const loadVehicles = async () => {
    setLoadingVehicles(true)
    const supabase = createClient()
    // Paginate internally so every vehicle is selectable, not just the
    // first 1000 rows (PostgREST default cap).
    const PAGE = 1000
    const all: Vehicle[] = []
    let from = 0
    for (let p = 0; p < 50; p++) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate_number, plate_number_ar, chassis_number, brand, manufacturer, model, project_code')
        .order('plate_number')
        .range(from, from + PAGE - 1)
      if (error || !data) break
      all.push(...(data as Vehicle[]))
      if ((data as any[]).length < PAGE) break
      from += PAGE
    }
    setVehicles(all)
    setLoadingVehicles(false)
  }

  const loadInvoiceData = async (invoiceId: string) => {
    setLoadingInvoice(true)
    try {
      const supabase = createClient()
      const [{ data: invoice }, { data: invoiceItems }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', invoiceId).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('row_number'),
      ])

      if (invoice) {
        const inv = invoice as Invoice
        setInvoiceNumber(inv.invoice_number)
        setInvoiceDate(inv.invoice_date)
        setStatus(inv.status)
        setRepairType(inv.repair_type || REPAIR_TYPES[1])
        setWorkshopName(inv.workshop_name)
        setMaintenanceManager(inv.maintenance_manager || '')
        setTechnician(inv.technician || '')
        setWorkHours(inv.work_hours || 0)
        setBeneficiaryCompany(inv.beneficiary_company || '')
        setVehicleId(inv.vehicle_id || '')
        setProject(inv.project || '')
        setVatPercentage(inv.vat_percentage)
        setNotes(inv.notes || '')

        if (invoiceItems && invoiceItems.length > 0) {
          setItems(invoiceItems as InvoiceItem[])
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load invoice data')
    } finally {
      setLoadingInvoice(false)
    }
  }

  /**
   * Suggest an invoice number. This is purely a UX hint — the DB has a
   * UNIQUE constraint and the save flow retries if a collision happens.
   */
  const reserveNextInvoiceNumber = async () => {
    const year = new Date().getFullYear()
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${year}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1)
    const last = data?.[0]?.invoice_number as string | undefined
    const seq = last ? (parseInt(last.split('-').pop() || '0', 10) || 0) + 1 : 1
    setInvoiceNumber(formatInvoiceNumber(year, seq))
  }

  // ─── Derived ───
  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId) || null,
    [vehicles, vehicleId]
  )

  // Auto-fill project when vehicle is selected
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.project_code && !project) {
      setProject(selectedVehicle.project_code)
    }
  }, [selectedVehicle, project])

  const vehicleOptions: SearchableOption<Vehicle>[] = useMemo(
    () => vehicles.map(v => ({
      value: v.id,
      label: v.plate_number || v.plate_number_ar || v.chassis_number || '—',
      sublabel:
        [v.brand || v.manufacturer, v.model].filter(Boolean).join(' ')
        || (v.chassis_number ?? ''),
      // Rich haystack: Arabic plate, English plate, chassis, brand, manufacturer, model.
      searchText: [
        v.plate_number, v.plate_number_ar, v.chassis_number,
        v.brand, v.manufacturer, v.model,
      ].filter(Boolean).join(' '),
      raw: v,
    })),
    [vehicles]
  )

  const totals = useMemo(() => computeTotals(items, vatPercentage), [items, vatPercentage])

  // ─── Items handlers ───
  const addItem = () => setItems(prev => [...prev, newBlankItem(prev.length + 1)])
  const removeItem = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, row_number: i + 1 })))
  const updateItem = <K extends keyof InvoiceItem>(index: number, key: K, value: InvoiceItem[K]) =>
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, [key]: value } : it)))

  // ─── Submit ───
  const validate = (): string | null => {
    if (!invoiceNumber) return 'رقم الفاتورة مطلوب'
    if (!invoiceDate)   return 'تاريخ الفاتورة مطلوب'
    if (!workshopName)  return 'اسم الورشة مطلوب'
    if (items.length === 0) return 'أضف بند واحد على الأقل'
    const hasEmptyRow = items.some(it => !it.description.trim() && !it.unit_price)
    if (hasEmptyRow) return 'بعض بنود الفاتورة فارغة — يرجى تعبئتها أو حذفها'
    return null
  }

  const buildVehicleLabel = (v: Vehicle | null): string => {
    if (!v) return ''
    return [v.brand, v.model].filter(Boolean).join(' ').trim()
  }

  const handleSubmit = async (opts: { exportAfter?: boolean } = {}) => {
    const err = validate()
    if (err) { toast.warning(err); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const nowIso = new Date().toISOString()

    const payload = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      status,
      repair_type: repairType,
      workshop_name: workshopName,
      maintenance_manager: maintenanceManager || null,
      technician: technician || null,
      work_hours: workHours || 0,
      beneficiary_company: beneficiaryCompany || null,
      notes: notes || null,

      vehicle_id: vehicleId || null,
      vehicle_plate: selectedVehicle?.plate_number || null,
      vehicle_label: buildVehicleLabel(selectedVehicle) || null,
      project: project || null,

      subtotal: totals.subtotal,
      vat_percentage: vatPercentage,
      vat_amount: totals.vat_amount,
      total: totals.total,

      last_updated_by: user?.id ?? null,
      last_updated_at: nowIso,
    }

    let invoiceId: string

    if (isEditMode && editInvoiceId) {
      // Update existing invoice
      const { data, error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', editInvoiceId)
        .select('*')
        .single()

      if (error || !data) {
        setSaving(false)
        toast.error(error?.message || 'تعذر تحديث الفاتورة')
        return
      }
      invoiceId = data.id

      // Delete existing items and insert new ones
      await supabase.from('invoice_items').delete().eq('invoice_id', editInvoiceId)
    } else {
      // Create new invoice
      const tryInsert = async (num: string) => {
        const { data, error } = await supabase
          .from('invoices')
          .insert({ ...payload, invoice_number: num, created_by: user?.id ?? null })
          .select('*')
          .single()
        return { data, error }
      }

      let { data: inserted, error } = await tryInsert(invoiceNumber)
      if (error && /duplicate key|unique/i.test(error.message)) {
        const year = new Date().getFullYear()
        const { data: last } = await supabase
          .from('invoices')
          .select('invoice_number')
          .like('invoice_number', `INV-${year}-%`)
          .order('invoice_number', { ascending: false })
          .limit(1)
        const seq = last?.[0]?.invoice_number
          ? (parseInt(last[0].invoice_number.split('-').pop() || '0', 10) || 0) + 1
          : 1
        const retryNum = formatInvoiceNumber(year, seq)
        const r = await tryInsert(retryNum)
        inserted = r.data
        error = r.error
        if (!error) setInvoiceNumber(retryNum)
      }

      if (error || !inserted) {
        setSaving(false)
        toast.error(error?.message || 'تعذر حفظ الفاتورة')
        return
      }
      invoiceId = inserted.id
    }

    // Insert items
    const rows = items.map((it, i) => ({
      invoice_id: invoiceId,
      row_number: i + 1,
      item_type: it.item_type,
      description: it.description,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
    }))
    if (rows.length) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(rows)
      if (itemsErr) {
        setSaving(false)
        toast.error(itemsErr.message)
        return
      }
    }
    setSaving(false)
    toast.success(isEditMode ? `تم تحديث الفاتورة ${invoiceNumber} ✓` : `تم إنشاء الفاتورة ${invoiceNumber} ✓`)

    if (opts.exportAfter) {
      const lang = await askPdfLanguage(language as 'ar' | 'en')
      if (lang) {
        // Get user full name
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('full_name')
          .eq('user_id', user?.id)
          .single()

        generateInvoicePDF({
          id: invoiceId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          status,
          repair_type: repairType,
          workshop_name: workshopName,
          maintenance_manager: maintenanceManager || null,
          technician: technician || null,
          work_hours: workHours || 0,
          beneficiary_company: beneficiaryCompany || null,
          notes: notes || null,
          vehicle_id: vehicleId || null,
          vehicle_plate: selectedVehicle?.plate_number || null,
          vehicle_label: buildVehicleLabel(selectedVehicle) || null,
          project: project || null,
          subtotal: totals.subtotal,
          vat_percentage: vatPercentage,
          vat_amount: totals.vat_amount,
          total: totals.total,
          created_by: user?.id ?? null,
          created_at: nowIso,
          last_updated_by: user?.id ?? null,
          last_updated_at: nowIso,
          items: rows.map(r => ({ ...r, line_total: r.quantity * r.unit_price })),
        } as InvoiceWithItems, lang, prefs?.full_name || undefined)
      }
    }
    router.push(`/forms/invoices/${invoiceId}`)
  }

  // ─── Render ───
  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  if (loadingInvoice) {
    return (
      <div className="p-10 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
      </div>
    )
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? (language === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice') : (language === 'ar' ? 'فاتورة جديدة' : 'New Invoice')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            صادرة باسم <span className="font-bold text-red-600">{workshopName}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/forms/invoices')}
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          العودة
        </button>
      </div>

      {/* ═══ Card 1: Invoice Information ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-gray-900 dark:text-white">معلومات الفاتورة</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>رقم الفاتورة</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>تاريخ الفاتورة</label>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>نوع الإصلاح</label>
            <select value={repairType} onChange={(e) => setRepairType(e.target.value)} className={inputCls}>
              {REPAIR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>الحالة</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} className={inputCls}>
              <option value="draft">{STATUS_LABEL_AR.draft}</option>
              <option value="issued">{STATUS_LABEL_AR.issued}</option>
              <option value="cancelled">{STATUS_LABEL_AR.cancelled}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>الورشة</label>
            <input value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-1">الافتراضي: {INTERNAL_WORKSHOP_AR}</p>
          </div>
          <div>
            <label className={labelCls}>مدير الصيانة</label>
            <input value={maintenanceManager} onChange={(e) => setMaintenanceManager(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>الشركة المستفيدة</label>
            <input value={beneficiaryCompany} onChange={(e) => setBeneficiaryCompany(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>اسم الفني المسؤول</label>
            <input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="اسم الفني المسؤول" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>عدد ساعات العمل</label>
            <input
              type="number" min={0} step={0.5}
              value={workHours}
              onChange={(e) => setWorkHours(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ═══ Card 2: Vehicle Information ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Car className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-gray-900 dark:text-white">بيانات المركبة</h3>
        </div>

        <div className="mb-4">
          <label className={labelCls}>ابحث برقم اللوحة، الهيكل، أو الموديل</label>
          {loadingVehicles ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل المركبات...
            </div>
          ) : (
            <SearchableSelect
              options={vehicleOptions}
              value={vehicleId}
              onChange={(v) => setVehicleId(v)}
              placeholder="-- اختر مركبة --"
              searchPlaceholder="رقم اللوحة، الهيكل، الموديل..."
              emptyText="لا توجد مركبات"
              dir="rtl"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>رقم اللوحة</label>
            <input readOnly value={selectedVehicle?.plate_number || ''} placeholder="—" className={`${inputCls} bg-gray-50 dark:bg-slate-900/60`} />
          </div>
          <div>
            <label className={labelCls}>بيانات المركبة</label>
            <input readOnly value={buildVehicleLabel(selectedVehicle)} placeholder="الماركة / الموديل / السنة" className={`${inputCls} bg-gray-50 dark:bg-slate-900/60`} />
          </div>
          <div>
            <label className={labelCls}>المشروع</label>
            <input value={project} onChange={(e) => setProject(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* ═══ Card 3: Items + Totals ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-gray-900 dark:text-white">بنود الفاتورة</h3>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة بند
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-800">
                <th className="px-2 py-2 text-start font-semibold w-[14%]">النوع</th>
                <th className="px-2 py-2 text-start font-semibold">الوصف</th>
                <th className="px-2 py-2 text-start font-semibold w-[10%]">الكمية</th>
                <th className="px-2 py-2 text-start font-semibold w-[14%]">سعر الوحدة</th>
                <th className="px-2 py-2 text-start font-semibold w-[14%]">الإجمالي</th>
                <th className="px-2 py-2 text-start w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-slate-800">
                  <td className="px-1 py-2">
                    <select
                      value={it.item_type}
                      onChange={(e) => updateItem(i, 'item_type', e.target.value as InvoiceItemType)}
                      className={inputCls}
                    >
                      <option value="spare_part">{ITEM_TYPE_LABEL_AR.spare_part}</option>
                      <option value="labor">{ITEM_TYPE_LABEL_AR.labor}</option>
                      <option value="inspection">{ITEM_TYPE_LABEL_AR.inspection}</option>
                      <option value="other">{ITEM_TYPE_LABEL_AR.other}</option>
                    </select>
                  </td>
                  <td className="px-1 py-2">
                    <input
                      value={it.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                      placeholder="وصف البند"
                      className={inputCls}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="number" min={0} step={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="number" min={0} step={0.01}
                      value={it.unit_price}
                      onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <div className="px-3 py-2 text-sm font-mono font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 text-center">
                      {formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                      <span className="text-[10px] text-gray-400 ms-1">ر.س</span>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      title="حذف البند"
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-end">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              الإجماليات تُحتسب تلقائياً من بنود الفاتورة والنسبة أدناه.
            </p>
          </div>
          <div className="bg-gradient-to-bl from-red-50 to-white dark:from-red-900/10 dark:to-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">المجموع قبل الضريبة</span>
              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.subtotal)} <span className="text-xs text-gray-400">ر.س</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">ضريبة %</span>
              <input
                type="number" min={0} max={100} step={0.5}
                value={vatPercentage}
                onChange={(e) => setVatPercentage(Number(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">مبلغ الضريبة</span>
              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.vat_amount)} <span className="text-xs text-gray-400">ر.س</span>
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-red-200 dark:border-red-900/50">
              <span className="font-bold text-red-700 dark:text-red-300">الإجمالي</span>
              <span className="font-mono font-extrabold text-red-700 dark:text-red-300 text-lg">
                {formatCurrency(totals.total)} <span className="text-xs text-gray-400">ر.س</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Card 4: Notes ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-gray-900 dark:text-white">ملاحظات</h3>
        </div>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات إضافية للفاتورة..."
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* ═══ Footer actions ═══ */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/forms/invoices')}
          className="px-4 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => handleSubmit({ exportAfter: false })}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {isEditMode ? 'تحديث الفاتورة' : 'إنشاء الفاتورة'}
        </button>
      </div>
    </div>
  )
}
