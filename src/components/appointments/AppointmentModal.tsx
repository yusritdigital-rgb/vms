'use client'

// =====================================================
// AppointmentModal — enhanced creation/edit UX.
// Sections:
//   1) Customer
//   2) Vehicle (DB-backed)  + mileage + complaint
//   3) تحديد الموعد  (Calendar + Time-slots + live summary)
//   4) Notes
//   Footer: إلغاء  ·  حفظ الموعد  (disabled until required fields set)
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import {
  X, User, Phone, Mail, Car, ClipboardList, StickyNote,
  CalendarDays, Loader2, Save, Gauge, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect'
import CalendarPicker from '@/components/ui/CalendarPicker'
import TimeSlotsPicker from '@/components/ui/TimeSlotsPicker'
import { toast } from '@/components/ui/Toast'
import {
  type Appointment,
  type AppointmentType,
  TYPE_LABEL_AR,
  formatAppointmentNumber,
  formatAppointmentSummaryAr,
  formatTimeLabelAr,
  normaliseTime,
  toYMD,
} from '@/lib/appointments/types'

interface Vehicle {
  id: string
  plate_number: string
  plate_number_ar?: string | null
  chassis_number: string | null
  brand: string | null
  manufacturer?: string | null
  model: string | null
  current_odometer?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (apt: Appointment) => void
  /** If provided, modal enters edit mode. */
  existing?: Appointment | null
}

export default function AppointmentModal({ open, onClose, onSaved, existing }: Props) {
  // ─── Form state ───
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [vehicleId, setVehicleId]         = useState('')
  const [mileage, setMileage]             = useState<number | ''>('')
  const [complaint, setComplaint]         = useState('')
  const [notes, setNotes]                 = useState('')
  const [aptType, setAptType]             = useState<AppointmentType>('maintenance')

  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState<string>('')    // "HH:MM"

  // ─── Data ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [saving, setSaving] = useState(false)

  // Reset + prefill when modal opens.
  useEffect(() => {
    if (!open) return
    if (existing) {
      setCustomerName(existing.customer_name)
      setCustomerPhone(existing.customer_phone ?? '')
      setCustomerEmail(existing.customer_email ?? '')
      setVehicleId(existing.vehicle_id ?? '')
      setMileage(existing.mileage ?? '')
      setComplaint(existing.complaint ?? '')
      setNotes(existing.notes ?? '')
      setAptType((existing.appointment_type as AppointmentType) ?? 'maintenance')
      setDate(existing.scheduled_date ? new Date(existing.scheduled_date + 'T00:00:00') : null)
      setTime(normaliseTime(existing.scheduled_time))
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setVehicleId('')
      setMileage('')
      setComplaint('')
      setNotes('')
      setAptType('maintenance')
      setDate(null)
      setTime('')
    }
  }, [open, existing])

  // Load vehicles once when modal opens.
  // Paginates internally so the full fleet is reachable, not just the
  // first 1000 rows (PostgREST default cap).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoadingVehicles(true)
      const supabase = createClient()
      const PAGE = 1000
      const all: Vehicle[] = []
      let from = 0
      for (let p = 0; p < 50; p++) {
        const { data, error } = await supabase
          .from('vehicles')
          .select('id, plate_number, plate_number_ar, chassis_number, brand, manufacturer, model, current_odometer')
          .order('plate_number')
          .range(from, from + PAGE - 1)
        if (error || !data) break
        all.push(...(data as Vehicle[]))
        if ((data as any[]).length < PAGE) break
        from += PAGE
      }
      if (cancelled) return
      setVehicles(all)
      setLoadingVehicles(false)
    })()
    return () => { cancelled = true }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId) ?? null,
    [vehicles, vehicleId]
  )

  const vehicleOptions: SearchableOption<Vehicle>[] = useMemo(
    () => vehicles.map(v => ({
      value: v.id,
      label: v.plate_number || v.plate_number_ar || v.chassis_number || '—',
      sublabel:
        [v.brand || v.manufacturer, v.model].filter(Boolean).join(' ')
        || (v.chassis_number ?? ''),
      // Rich haystack so search matches Arabic plate / manufacturer too.
      searchText: [
        v.plate_number, v.plate_number_ar, v.chassis_number,
        v.brand, v.manufacturer, v.model,
      ].filter(Boolean).join(' '),
      raw: v,
    })),
    [vehicles]
  )

  // Auto-prefill mileage when selecting a vehicle with a known odometer
  // (only if the user hasn't typed one yet and we're not editing).
  useEffect(() => {
    if (!selectedVehicle || mileage !== '' || existing) return
    if (typeof selectedVehicle.current_odometer === 'number') {
      setMileage(selectedVehicle.current_odometer)
    }
  }, [selectedVehicle, mileage, existing])

  const canSave = Boolean(customerName.trim() && date && time)
  const summary = formatAppointmentSummaryAr(date, time)

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!canSave) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload: Record<string, any> = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      customer_email: customerEmail.trim() || null,
      vehicle_id: vehicleId || null,
      vehicle_plate: selectedVehicle?.plate_number ?? null,
      vehicle_label: selectedVehicle
        ? [selectedVehicle.brand || selectedVehicle.manufacturer, selectedVehicle.model]
            .filter(Boolean).join(' ').trim() || null
        : null,
      mileage: mileage === '' ? null : Number(mileage),
      complaint: complaint.trim() || null,
      notes: notes.trim() || null,
      appointment_type: aptType,
      scheduled_date: toYMD(date!),
      scheduled_time: time,
      last_updated_by: user?.id ?? null,
    }

    let saved: Appointment | null = null
    let error: any = null

    if (existing) {
      const r = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single()
      saved = r.data as Appointment | null
      error = r.error
    } else {
      // Generate a friendly appointment number (UNIQUE; retry-on-conflict once).
      const year = new Date().getFullYear()
      const { data: last } = await supabase
        .from('appointments')
        .select('appointment_number')
        .like('appointment_number', `APT-${year}-%`)
        .order('appointment_number', { ascending: false })
        .limit(1)
      const seq = last?.[0]?.appointment_number
        ? (parseInt(last[0].appointment_number.split('-').pop() || '0', 10) || 0) + 1
        : 1
      const insertBody = {
        ...payload,
        appointment_number: formatAppointmentNumber(year, seq),
        created_by: user?.id ?? null,
      }
      let r = await supabase.from('appointments').insert(insertBody).select('*').single()
      if (r.error && /duplicate key|unique/i.test(r.error.message)) {
        insertBody.appointment_number = formatAppointmentNumber(year, seq + 1)
        r = await supabase.from('appointments').insert(insertBody).select('*').single()
      }
      saved = r.data as Appointment | null
      error = r.error
    }

    setSaving(false)
    if (error || !saved) {
      toast.error(error?.message || 'تعذر حفظ الموعد')
      return
    }

    // ── Optional confirmation email (only on create, only if an email was given).
    // Appointment creation must NEVER fail because of email issues, so this is
    // a fully isolated soft-path with its own toast copy.
    const email = customerEmail.trim()
    if (!existing && email) {
      let mailOk = false
      try {
        const summary = formatAppointmentSummaryAr(date, time)
        const res = await fetch('/api/appointments/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:                email,
            customer_name:     saved.customer_name,
            appointment_type:  TYPE_LABEL_AR[(saved.appointment_type as AppointmentType) ?? 'maintenance'],
            vehicle_plate:     saved.vehicle_plate,
            vehicle_label:     saved.vehicle_label,
            scheduled_date:    saved.scheduled_date,
            scheduled_time:    time ? formatTimeLabelAr(time) : null,
            workshop:          null,
            summary_ar:        summary,
          }),
        })
        const json = await res.json().catch(() => ({}))
        mailOk = !!(res.ok && json?.success)
        if (!mailOk) console.warn('[appointments] email send failed', json)
      } catch (err) {
        console.warn('[appointments] email send network error', err)
        mailOk = false
      }

      if (mailOk) toast.success('تم إنشاء الموعد وإرسال رسالة للعميل')
      else        toast.warning('تم إنشاء الموعد لكن تعذر إرسال البريد الإلكتروني')
    } else {
      toast.success(existing ? 'تم تحديث الموعد ✓' : `تم إنشاء الموعد ${saved.appointment_number} ✓`)
    }

    onSaved(saved)
  }

  if (!open) return null

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-colors'
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-black/5 my-4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 bg-gradient-to-l from-red-50 to-white dark:from-red-900/20 dark:to-slate-900">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {existing ? 'تعديل الموعد' : 'موعد صيانة جديد'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              إدارة وجدولة مواعيد الصيانة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* ── 1. Customer ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">بيانات العميل</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>اسم العميل *</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>رقم الجوال (اختياري)</label>
                <div className="relative">
                  <Phone className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    inputMode="tel"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>إيميل العميل (اختياري) · Customer Email</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    className={`${inputCls} ps-9`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  عند إدخال الإيميل سيتم إرسال رسالة تأكيد الموعد للعميل تلقائيًا.
                </p>
              </div>
            </div>
          </section>

          {/* ── 1b. Appointment type ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">نوع الموعد</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(TYPE_LABEL_AR) as AppointmentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAptType(t)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${aptType === t
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-red-300'}`}
                >
                  {TYPE_LABEL_AR[t]}
                </button>
              ))}
            </div>
          </section>

          {/* ── 2. Vehicle ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">المركبة</h3>
            </div>

            <label className={labelCls}>ابحث عن السيارة</label>
            {loadingVehicles ? (
              <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل المركبات...
              </div>
            ) : (
              <SearchableSelect
                options={vehicleOptions}
                value={vehicleId}
                onChange={(v) => setVehicleId(v)}
                placeholder="-- اختر مركبة --"
                searchPlaceholder="ابحث برقم اللوحة أو الموديل..."
                emptyText="لا توجد مركبات"
                dir="rtl"
              />
            )}

            {/* Selected vehicle card */}
            {selectedVehicle && (
              <div className="mt-3 flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{selectedVehicle.plate_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[selectedVehicle.brand, selectedVehicle.model].filter(Boolean).join(' ') || '—'}
                      {selectedVehicle.chassis_number && <span className="ms-2">· {selectedVehicle.chassis_number}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVehicleId('')}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold"
                >
                  تغيير
                </button>
              </div>
            )}

            {/* Mileage + complaint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelCls}>عداد السيارة</label>
                <div className="relative">
                  <Gauge className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
                  <input
                    type="number" min={0}
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>شكوى / وصف المشكلة</label>
                <div className="relative">
                  <ClipboardList className="absolute top-2.5 start-3 w-4 h-4 text-gray-400" />
                  <textarea
                    rows={2}
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="مثال: صوت غريب من المحرك..."
                    className={`${inputCls} ps-9 resize-y`}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── 3. Scheduling (hero) ── */}
          <section className="rounded-2xl border-2 border-red-200 dark:border-red-900/50 p-4 bg-gradient-to-bl from-red-50/60 to-white dark:from-red-900/10 dark:to-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">تحديد الموعد</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CalendarPicker value={date} onChange={setDate} />
              <TimeSlotsPicker value={time} onChange={setTime} />
            </div>

            {/* Live summary */}
            <div
              className={[
                'mt-3 p-3 rounded-xl text-sm flex items-center gap-2 transition-all',
                date && time
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                  : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-slate-600',
              ].join(' ')}
            >
              {date && time ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <CalendarDays className="w-5 h-5 shrink-0" />}
              <div className="min-w-0">
                {date && time ? (
                  <>
                    <span className="font-semibold">الموعد المحدد:</span>{' '}
                    <span className="font-bold">{summary}</span>
                  </>
                ) : (
                  <span>اختر التاريخ والوقت لإكمال الحجز</span>
                )}
              </div>
            </div>
          </section>

          {/* ── 4. Notes ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">ملاحظات إضافية (اختياري)</h3>
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات للفريق الداخلي..."
              className={`${inputCls} resize-y`}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave || saving}
            className="px-5 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ الموعد
          </button>
        </div>
      </div>
    </div>
  )
}
