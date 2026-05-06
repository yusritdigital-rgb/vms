'use client'

// =====================================================
// /job-cards/create — Create Case (full operational form)
// -----------------------------------------------------
// Restores the full set of operational fields the workshop team
// relies on:
//   · vehicle (searchable, plate + project + odometer pre-fill)
//   · case type         (ميكانيكي / حوادث)
//   · workshop          (searchable, optional)
//   · received_at       (datetime-local)
//   · entry_odometer    (auto-prefilled from vehicle)
//   · complaint, internal notes
//   · initial status    (default: بانتظار تقدير)
//   · replacement vehicle:
//       - هل توجد بديلة؟ نعم/لا
//       - if YES: searchable picker over the RV-project pool
//       - if NO : reason dropdown (+ custom text when "أخرى")
//
// After a successful insert we toast, then navigate to
// /job-cards?new=<id>. Realtime picks the row up so it shows
// in Daily Update immediately.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Plus, Car, Wrench, Building2, ClipboardList,
  StickyNote, Gauge, CalendarClock, Tag, Repeat,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { useAllVehicles, buildVehicleSearchText, formatVehicleLabel, formatVehicleSublabel, type VehicleLite } from '@/hooks/useAllVehicles'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/Toast'
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect'
import { createCase, listAvailableRvVehicles, getLatestReplacementReturnOdometer } from '@/lib/cases/queries'
import { generateReceivingHandoverPDF } from '@/lib/pdf/receivingHandover'
import { CASE_STATUSES } from '@/lib/cases/statuses'
import { isRvProjectCode } from '@/lib/alternatives/rules'

// ─── No-replacement reasons ───────────────────────────────────────
// DB CHECK constraint (migration 009) only accepts these exact codes;
// "other" requires no_replacement_reason_custom to be populated.
const NO_REPLACEMENT_REASONS: { value: string; label_ar: string }[] = [
  { value: 'contract_non_binding',     label_ar: 'العقد غير ملزم ببديل' },
  { value: 'misuse',                   label_ar: 'سوء استخدام' },
  { value: 'no_alternative_available', label_ar: 'لا توجد بديلة متاحة' },
  { value: 'other',                    label_ar: 'أخرى' },
]

export default function CreateCasePage() {
  const { language, t } = useTranslation()
  const isAr = language === 'ar'
  const router = useRouter()

  // ─── Load all vehicles with pagination ───
  const { vehicles, loading: loadingVehicles } = useAllVehicles()
  console.log('[create-case] vehicles loaded', vehicles.length, vehicles)

  // ─── Load available RV vehicles (already filters reserved ones) ───
  const [availableRvVehicles, setAvailableRvVehicles] = useState<Array<{
    id: string
    plate_number: string | null
    plate_number_ar: string | null
    brand: string | null
    manufacturer: string | null
    model: string | null
    project_code: string | null
    current_odometer: number | null
    chassis_number: string | null
  }>>([])
  const [loadingRvVehicles, setLoadingRvVehicles] = useState(true)

  // ─── Load workshops from database ───
  const [workshops, setWorkshops] = useState<Array<{
    id: string
    workshop_name_ar: string
    city_ar: string | null
  }>>([])
  const [loadingWorkshops, setLoadingWorkshops] = useState(true)

  useEffect(() => {
    const loadRvVehicles = async () => {
      setLoadingRvVehicles(true)
      try {
        const rv = await listAvailableRvVehicles()
        setAvailableRvVehicles(rv)
      } catch (e) {
        console.error('[create-case] failed to load RV vehicles', e)
      } finally {
        setLoadingRvVehicles(false)
      }
    }
    loadRvVehicles()
  }, [])

  useEffect(() => {
    const loadWorkshops = async () => {
      setLoadingWorkshops(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('workshops')
          .select('id, workshop_name_ar, city_ar')
          .eq('active_status', true)
          .order('workshop_name_ar')
        if (error) throw error
        setWorkshops((data as any[]) ?? [])
      } catch (e) {
        console.error('[create-case] failed to load workshops', e)
      } finally {
        setLoadingWorkshops(false)
      }
    }
    loadWorkshops()
  }, [])

  // ─── Form state ───
  const [vehicleId, setVehicleId]   = useState('')
  const [type, setType]             = useState<'accident' | 'mechanical'>('mechanical')
  const [workshopId, setWorkshopId] = useState('')
  const [entryOdo, setEntryOdo]     = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  // Odometer of the replacement vehicle at handover. Required when a
  // replacement is assigned; persisted as a `vehicle_odometer_readings`
  // row alongside the main vehicle's reading.
  const [altEntryOdo, setAltEntryOdo] = useState<string>('')
  const [receivedAt, setReceivedAt] = useState(() => {
    const d = new Date(); d.setSeconds(0, 0)
    // Format as local datetime-local string (yyyy-MM-ddTHH:mm)
    const offset = d.getTimezoneOffset() * 60000
    const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16)
    return localISOTime
  })
  // Expected completion date is no longer captured at create time.
  // It is collected later — only when the operator flips the case
  // status to one of the in-progress states (تحت الاصلاح الميكانيكي /
  // تحت اصلاح الهيكل / تحت الدهان) via CaseUpdateForm.
  const [complaint, setComplaint]   = useState('')
  const [notes, setNotes]           = useState('')
  const [status, setStatus]         = useState<string>('بانتظار تقدير')

  // Replacement vehicle sub-form.
  const [hasAlt, setHasAlt]                 = useState<boolean>(false)
  const [altVehicleId, setAltVehicleId]     = useState<string>('')
  const [noAltReason, setNoAltReason]       = useState<string>('')
  const [noAltReasonCustom, setNoAltReasonCustom] = useState<string>('')
  const [latestReturnOdo, setLatestReturnOdo] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)

  // Prefill odometer fields when vehicles are picked. We seed the input
  // with the cached `current_odometer` so the user only has to type when
  // the actual handover reading differs. The DB trigger enforces that
  // the saved reading is >= last known.
  useEffect(() => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (v && v.current_odometer != null && !entryOdo) {
      setEntryOdo(String(v.current_odometer))
    }
  }, [vehicleId, vehicles]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = vehicles.find(x => x.id === altVehicleId)
    if (v && v.current_odometer != null && !altEntryOdo) {
      setAltEntryOdo(String(v.current_odometer))
    }
  }, [altVehicleId, vehicles]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch latest return odometer for replacement vehicle
  useEffect(() => {
    if (!altVehicleId) {
      setLatestReturnOdo(null)
      return
    }
    getLatestReplacementReturnOdometer(altVehicleId)
      .then(odo => setLatestReturnOdo(odo))
      .catch(e => console.error('[create-case] failed to fetch latest return odometer', e))
  }, [altVehicleId])

  // Prefill alt odometer from latest return (preferred) or current_odometer
  useEffect(() => {
    if (!altVehicleId) return
    if (altEntryOdo) return // Don't override if user already typed
    if (latestReturnOdo != null) {
      setAltEntryOdo(String(latestReturnOdo))
    }
  }, [altVehicleId, latestReturnOdo, altEntryOdo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Last-known readings for the inline hints under each odometer input.
  const mainVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId) ?? null,
    [vehicles, vehicleId]
  )
  const altVehicle = useMemo(
    () => vehicles.find(v => v.id === altVehicleId) ?? null,
    [vehicles, altVehicleId]
  )
  const mainLastKnown = mainVehicle?.current_odometer ?? null
  const altLastKnown  = altVehicle?.current_odometer ?? null
  const altMinOdo = latestReturnOdo != null ? latestReturnOdo : altLastKnown

  // ─── Options ───
  const vehicleOptions: SearchableOption[] = useMemo(
    () => vehicles.map(v => ({
      value: v.id,
      label: formatVehicleLabel(v),
      sublabel: formatVehicleSublabel(v),
      searchText: buildVehicleSearchText(v),
    })),
    [vehicles]
  )

  // Replacement vehicles are the available RV vehicles (already filtered to exclude reserved ones)
  const altVehicleOptions: SearchableOption[] = useMemo(() => {
    return availableRvVehicles
      .filter(v => v.id !== vehicleId)
      .map(v => ({
        value: v.id,
        label: formatVehicleLabel(v),
        sublabel: formatVehicleSublabel(v),
        searchText: buildVehicleSearchText(v),
      }))
  }, [availableRvVehicles, vehicleId])

  const workshopOptions: SearchableOption[] = useMemo(
    () => workshops.map(w => ({
      value: w.id,
      label: isAr ? w.workshop_name_ar : (t(`jobCards.workshops.${w.workshop_name_ar}` as any) || w.workshop_name_ar),
      sublabel: w.city_ar || ''
    })),
    [workshops, isAr, t]
  )

  // ─── Validation ───
  // Block save until all DB invariants are satisfiable; surface the
  // reason inline so the user isn't guessing why the button is disabled.
  const validationError: string | null = useMemo(() => {
    if (!vehicleId)  return isAr ? 'اختر المركبة' : 'Pick a vehicle'
    if (!type)       return isAr ? 'اختر نوع الحالة' : 'Pick a case type'
    if (!receivedAt) return isAr ? 'اختر تاريخ الاستلام' : 'Pick a received date'
    // Main vehicle odometer is required and must be >= last known reading
    // (the DB trigger is the final guard; this catches it client-side).
    if (entryOdo === '' || Number.isNaN(Number(entryOdo))) {
      return isAr ? 'أدخل عداد الدخول للمركبة' : 'Enter the entry odometer'
    }
    if (Number(entryOdo) < 0) {
      return isAr ? 'عداد المركبة غير صالح' : 'Odometer must be ≥ 0'
    }
    if (mainLastKnown != null && Number(entryOdo) < mainLastKnown) {
      return isAr
        ? `عداد الدخول أقل من آخر قراءة معروفة (${mainLastKnown.toLocaleString('en-US')} كم)`
        : `Entry odometer is below last known reading (${mainLastKnown.toLocaleString('en-US')} km)`
    }
    if (hasAlt) {
      if (!altVehicleId) return isAr ? 'اختر المركبة البديلة' : 'Pick a replacement vehicle'
      if (altEntryOdo === '' || Number.isNaN(Number(altEntryOdo))) {
        return isAr ? 'أدخل عداد المركبة البديلة' : 'Enter the replacement vehicle odometer'
      }
      if (Number(altEntryOdo) < 0) {
        return isAr ? 'عداد البديلة غير صالح' : 'Replacement odometer must be ≥ 0'
      }
      if (altMinOdo != null && Number(altEntryOdo) < altMinOdo) {
        return isAr
          ? `عداد البديلة أقل من آخر عداد عودة مسجل (${altMinOdo.toLocaleString('en-US')} كم)`
          : `Replacement odometer is below last return reading (${altMinOdo.toLocaleString('en-US')} km)`
      }
    } else {
      if (!noAltReason) return isAr ? 'اختر سبب عدم وجود بديلة' : 'Pick a no-replacement reason'
      if (noAltReason === 'other' && !noAltReasonCustom.trim()) {
        return isAr ? 'اكتب السبب عند اختيار "أخرى"' : 'Describe the "other" reason'
      }
    }
    return null
  }, [vehicleId, type, receivedAt, entryOdo, mainLastKnown, hasAlt, altVehicleId, altEntryOdo, altMinOdo, latestReturnOdo, noAltReason, noAltReasonCustom, isAr])

  const canSave = !validationError && !saving

  // ─── Submit ───
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) {
      if (validationError) toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const ws = workshops.find(w => w.id === workshopId) ?? null

      const row = await createCase({
        vehicle_id:              vehicleId,
        type,
        status,
        workshop_id:             ws?.id ?? null,
        workshop_name:           ws?.workshop_name_ar ?? null,
        workshop_city:           ws?.city_ar ?? null,
        entry_odometer:          Number(entryOdo) || 0,
        received_at:             new Date(receivedAt).toISOString(),
        // Expected completion is no longer set at creation — captured
        // later by the case-update form when status flips to in-progress.
        expected_completion_date: null,
        complaint_description:   complaint.trim() || null,
        internal_notes:          notes.trim() || null,
        customer_phone:          customerPhone.trim() || null,
        has_replacement_vehicle: hasAlt,
        replacement_vehicle_id:  hasAlt ? (altVehicleId || null) : null,
        replacement_entry_odometer:
          hasAlt && altEntryOdo !== '' ? Number(altEntryOdo) : null,
        no_replacement_reason:   hasAlt ? null : (noAltReason || null),
        no_replacement_reason_custom:
          hasAlt || noAltReason !== 'other' ? null : (noAltReasonCustom.trim() || null),
      })

      toast.success(isAr ? `تم إنشاء الحالة ${row.job_card_number}` : `Case ${row.job_card_number} created`)

      // Generate receiving handover form
      const workshop = workshops.find(w => w.id === workshopId)
      const mainVehicle = vehicles.find(v => v.id === vehicleId)
      const altVehicle = hasAlt ? vehicles.find(v => v.id === altVehicleId) : null
      
      const handoverVehicles = [
        {
          plateNumber: mainVehicle?.plate_number || mainVehicle?.plate_number_ar || null,
          vehicleLabel: isAr ? 'المركبة الأساسية' : 'Main Vehicle',
          movementType: 'دخول' as const,
          odometer: Number(entryOdo) || null,
          vehicleMakeModel: [mainVehicle?.brand || mainVehicle?.manufacturer, mainVehicle?.model].filter(Boolean).join(' ') || null,
          projectCode: mainVehicle?.project_code || null,
        },
        ...(altVehicle ? [{
          plateNumber: altVehicle.plate_number || altVehicle.plate_number_ar || null,
          vehicleLabel: isAr ? 'المركبة البديلة' : 'Replacement Vehicle',
          movementType: 'خروج' as const,
          odometer: Number(altEntryOdo) || null,
          vehicleMakeModel: [altVehicle.brand || altVehicle.manufacturer, altVehicle.model].filter(Boolean).join(' ') || null,
          projectCode: altVehicle.project_code || null,
        }] : []),
      ]

      generateReceivingHandoverPDF({
        caseNumber: row.job_card_number,
        caseDate: row.received_at,
        workshop: workshop?.workshop_name_ar || null,
        vehicles: handoverVehicles,
      })

      router.refresh()
      router.push(`/job-cards?new=${encodeURIComponent(row.id)}`)
    } catch (err: any) {
      console.error('[create-case] submit failed', err)
      toast.error(err?.message || (isAr ? 'فشل إنشاء الحالة' : 'Create failed'))
      setSaving(false)
    }
  }

  // ─── Styles ───
  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500'
  const labelCls = 'text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block'
  const sectionCls = 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4'
  const sectionHeaderCls = 'flex items-center gap-2 mb-1'


  return (
    <div className="max-w-7xl mx-auto px-4 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'إنشاء حالة' : 'Create Case'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAr
              ? 'أدخل بيانات الحالة الأساسية، الورشة، والمركبة البديلة.'
              : 'Enter the basic case info, workshop, and replacement vehicle.'}
          </p>
        </div>
        <Link
          href="/job-cards"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAr ? 'العودة' : 'Back'}
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 pb-24">
        {/* ═══ Row 1: Vehicle + Case Type  (2-col on md+) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className={`${sectionCls} lg:col-span-2`}>
            <div className={sectionHeaderCls}>
              <Car className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {isAr ? 'المركبة' : 'Vehicle'}
              </h2>
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'المركبة *' : 'Vehicle *'}</label>
              {loadingVehicles ? (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isAr ? 'جاري تحميل المركبات...' : 'Loading vehicles...'}
                </div>
              ) : (
                <SearchableSelect
                  options={vehicleOptions}
                  value={vehicleId}
                  onChange={(v) => setVehicleId(v)}
                  placeholder={isAr ? 'اختر المركبة' : 'Choose a vehicle'}
                  searchPlaceholder={isAr ? 'ابحث برقم اللوحة أو الموديل...' : 'Search by plate or model...'}
                  dir={isAr ? 'rtl' : 'ltr'}
                />
              )}
            </div>
          </section>

          <section className={sectionCls}>
            <div className={sectionHeaderCls}>
              <Wrench className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {isAr ? 'نوع الحالة' : 'Case Type'}
              </h2>
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'النوع *' : 'Type *'}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['mechanical', 'accident'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${
                      type === t
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-red-400'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {t === 'mechanical' ? (isAr ? 'ميكانيكي' : 'Mechanical') : (isAr ? 'حوادث' : 'Accident')}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ═══ Row 2: Workshop + Received date + Odometer  (3-col) ═══ */}
        <section className={sectionCls}>
          <div className={sectionHeaderCls}>
            <Building2 className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {isAr ? 'الورشة والتوقيت' : 'Workshop & Timing'}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isAr ? 'الورشة' : 'Workshop'}</label>
              <SearchableSelect
                options={workshopOptions}
                value={workshopId}
                onChange={(v) => setWorkshopId(v)}
                placeholder={isAr ? 'اختر الورشة' : 'Choose a workshop'}
                searchPlaceholder={isAr ? 'ابحث بالاسم أو المدينة...' : 'Search by name/city...'}
                dir={isAr ? 'rtl' : 'ltr'}
              />
            </div>
            <div>
              <label className={labelCls}>
                <Gauge className="w-3.5 h-3.5 inline-block -mt-0.5 me-1" />
                {isAr ? 'عداد الدخول (كم) *' : 'Entry odometer (km) *'}
              </label>
              <input
                type="number"
                min={0}
                value={entryOdo}
                onChange={(e) => setEntryOdo(e.target.value)}
                className={inputCls}
                required
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {mainLastKnown != null
                  ? (isAr
                      ? `آخر قراءة معروفة: ${mainLastKnown.toLocaleString('en-US')} كم`
                      : `Last known: ${mainLastKnown.toLocaleString('en-US')} km`)
                  : (isAr ? 'لا توجد قراءة سابقة' : 'No previous reading')}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                <CalendarClock className="w-3.5 h-3.5 inline-block -mt-0.5 me-1" />
                {isAr ? 'تاريخ الاستلام *' : 'Received at *'}
              </label>
              <input
                type="datetime-local"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>
        </section>

        {/* ═══ Row 3: Description + Internal notes + Customer phone  (3-col) ═══ */}
        <section className={sectionCls}>
          <div className={sectionHeaderCls}>
            <ClipboardList className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {isAr ? 'الوصف والملاحظات' : 'Description & Notes'}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{isAr ? 'الشكوى / الوصف' : 'Complaint / description'}</label>
              <textarea
                rows={4}
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder={isAr ? 'مثال: صوت غريب من المحرك...' : 'e.g. Strange noise from the engine...'}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <StickyNote className="w-3.5 h-3.5 inline-block -mt-0.5 me-1" />
                {isAr ? 'ملاحظات داخلية' : 'Internal notes'}
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'رقم جوال العميل' : 'Customer phone'}</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={isAr ? '05xxxxxxxx' : '05xxxxxxxx'}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* ═══ Row 4: Initial status + Replacement vehicle  (2-col) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className={sectionCls}>
            <div className={sectionHeaderCls}>
              <Tag className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {isAr ? 'الحالة المبدئية' : 'Initial Status'}
              </h2>
            </div>
            <div>
              <label className={labelCls}>
                {isAr ? 'الحالة *' : 'Status *'}
                <span className="ms-2 text-[11px] font-normal text-gray-400">
                  {isAr ? '(الافتراضي: بانتظار تقدير)' : '(default: بانتظار تقدير)'}
                </span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputCls}
              >
                {CASE_STATUSES.map(s => (
                  <option key={s} value={s}>{isAr ? s : (t(`jobCards.statuses.${s}` as any) || s)}</option>
                ))}
              </select>
            </div>
          </section>

          <section className={sectionCls}>
            <div className={sectionHeaderCls}>
              <Repeat className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {isAr ? 'المركبة البديلة' : 'Replacement Vehicle'}
              </h2>
            </div>

            <div>
              <label className={labelCls}>{isAr ? 'هل توجد مركبة بديلة؟' : 'Is there a replacement vehicle?'}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasAlt(true)}
                  className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    hasAlt
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400'
                  }`}
                >
                  {isAr ? 'نعم' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setHasAlt(false)}
                  className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    !hasAlt
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-red-400'
                  }`}
                >
                  {isAr ? 'لا' : 'No'}
                </button>
              </div>
            </div>

            {hasAlt ? (
              <>
                <div>
                  <label className={labelCls}>
                    {isAr ? 'اختر المركبة البديلة *' : 'Pick replacement vehicle *'}
                    <span className="ms-2 text-[11px] font-normal text-gray-400">
                      {isAr ? '(من مخزون RV)' : '(from the RV pool)'}
                    </span>
                  </label>
                  {altVehicleOptions.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {isAr
                        ? 'لا توجد مركبات بديلة متاحة في مخزون RV.'
                        : 'No replacement vehicles available in the RV pool.'}
                    </p>
                  ) : (
                    <SearchableSelect
                      options={altVehicleOptions}
                      value={altVehicleId}
                      onChange={(v) => setAltVehicleId(v)}
                      placeholder={isAr ? 'اختر مركبة بديلة' : 'Choose a replacement vehicle'}
                      searchPlaceholder={isAr ? 'ابحث برقم اللوحة...' : 'Search by plate...'}
                      dir={isAr ? 'rtl' : 'ltr'}
                    />
                  )}
                </div>
                {altVehicleId && (
                  <div>
                    <label className={labelCls}>
                      <Gauge className="w-3.5 h-3.5 inline-block -mt-0.5 me-1" />
                      {isAr ? 'عداد البديلة عند التسليم (كم) *' : 'Replacement odometer at handover (km) *'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={altEntryOdo}
                      onChange={(e) => setAltEntryOdo(e.target.value)}
                      className={inputCls}
                      required
                    />
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {latestReturnOdo != null
                        ? (isAr
                            ? `آخر عداد عودة: ${latestReturnOdo.toLocaleString('en-US')} كم`
                            : `Last return odometer: ${latestReturnOdo.toLocaleString('en-US')} km`)
                        : altLastKnown != null
                        ? (isAr
                            ? `آخر قراءة معروفة: ${altLastKnown.toLocaleString('en-US')} كم`
                            : `Last known: ${altLastKnown.toLocaleString('en-US')} km`)
                        : (isAr ? 'لا توجد قراءة سابقة' : 'No previous reading')}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>{isAr ? 'سبب عدم وجود بديلة *' : 'No-replacement reason *'}</label>
                  <select
                    value={noAltReason}
                    onChange={(e) => setNoAltReason(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{isAr ? '-- اختر السبب --' : '-- Pick a reason --'}</option>
                    {NO_REPLACEMENT_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label_ar}</option>
                    ))}
                  </select>
                </div>
                {noAltReason === 'other' && (
                  <div>
                    <label className={labelCls}>{isAr ? 'اكتب السبب *' : 'Describe the reason *'}</label>
                    <input
                      value={noAltReasonCustom}
                      onChange={(e) => setNoAltReasonCustom(e.target.value)}
                      placeholder={isAr ? 'السبب...' : 'Reason...'}
                      className={inputCls}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ═══ Sticky footer — submit ═══ */}
        <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-gray-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="text-xs text-amber-600 dark:text-amber-400 min-h-[1rem]">
            {validationError ?? ''}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/job-cards"
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Link>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isAr ? 'حفظ الحالة' : 'Save case'}
            </button>
          </div>
          </div>
        </div>
      </form>
    </div>
  )
}
