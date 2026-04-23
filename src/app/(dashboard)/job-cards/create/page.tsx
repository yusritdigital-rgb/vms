'use client'

// =====================================================
// /job-cards/create — Create Case
// -----------------------------------------------------
// Minimal, focused form. After a successful insert the
// caller awaits `refresh()` from the caching layer implicitly
// (Realtime picks it up) and navigates to /job-cards?new=<id>.
// No polling, no BroadcastChannel, no force-dynamic.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/Toast'
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect'
import { createCase } from '@/lib/cases/queries'
import { WORKSHOPS } from '@/lib/workshops/workshops'

interface Vehicle {
  id: string
  plate_number: string | null
  chassis_number: string | null
  brand: string | null
  model: string | null
  project_code: string | null
  current_odometer: number | null
}

export default function CreateCasePage() {
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const router = useRouter()

  // Form state
  const [vehicles, setVehicles]     = useState<Vehicle[]>([])
  const [vehicleId, setVehicleId]   = useState('')
  const [type, setType]             = useState<'accident' | 'mechanical'>('mechanical')
  const [workshopId, setWorkshopId] = useState('')
  const [entryOdo, setEntryOdo]     = useState<string>('')
  const [receivedAt, setReceivedAt] = useState(() => {
    const d = new Date(); d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16) // yyyy-MM-ddTHH:mm
  })
  const [complaint, setComplaint]   = useState('')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('vehicles')
        .select('id, plate_number, chassis_number, brand, model, project_code, current_odometer')
        .order('plate_number')
      setVehicles((data as Vehicle[]) ?? [])
    }
    void load()
  }, [])

  // When vehicle changes, prefill odometer.
  useEffect(() => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (v && v.current_odometer != null) setEntryOdo(String(v.current_odometer))
  }, [vehicleId, vehicles])

  const vehicleOptions: SearchableOption[] = useMemo(
    () => vehicles.map(v => ({
      value: v.id,
      label: v.plate_number ?? '—',
      sublabel: [v.brand, v.model, v.project_code].filter(Boolean).join(' · '),
    })),
    [vehicles]
  )

  const workshopOptions: SearchableOption[] = useMemo(
    () => WORKSHOPS.map(w => ({ value: w.id, label: w.display_label, sublabel: w.city_ar })),
    []
  )

  const canSave = !!vehicleId && !!type && !saving

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    try {
      const ws = WORKSHOPS.find(w => w.id === workshopId) ?? null
      const row = await createCase({
        vehicle_id:              vehicleId,
        type,
        workshop_id:             ws?.id ?? null,
        workshop_name:           ws?.name_ar ?? null,
        workshop_city:           ws?.city_ar ?? null,
        entry_odometer:          Number(entryOdo) || 0,
        received_at:             new Date(receivedAt).toISOString(),
        complaint_description:   complaint.trim() || null,
        internal_notes:          notes.trim() || null,
        has_replacement_vehicle: false,
        replacement_vehicle_id:  null,
        no_replacement_reason:   null,
        no_replacement_reason_custom: null,
      })
      toast.success(isAr ? `تم إنشاء الحالة ${row.job_card_number}` : `Case ${row.job_card_number} created`)
      router.refresh()
      router.push(`/job-cards?new=${encodeURIComponent(row.id)}`)
    } catch (err: any) {
      toast.error(err?.message || (isAr ? 'فشل الإنشاء' : 'Create failed'))
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'إنشاء حالة' : 'Create Case'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAr ? 'اختر المركبة والورشة واحفظ.' : 'Pick vehicle + workshop and save.'}
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

      <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Vehicle */}
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            {isAr ? 'المركبة *' : 'Vehicle *'}
          </label>
          <SearchableSelect
            options={vehicleOptions}
            value={vehicleId}
            onChange={(v) => setVehicleId(v)}
            placeholder={isAr ? 'اختر المركبة' : 'Choose a vehicle'}
            searchPlaceholder={isAr ? 'ابحث برقم اللوحة...' : 'Search by plate...'}
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            {isAr ? 'نوع الحالة *' : 'Case type *'}
          </label>
          <div className="flex items-center gap-2">
            {(['mechanical', 'accident'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                  type === t
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-red-400'
                }`}
              >
                {t === 'mechanical' ? (isAr ? 'ميكانيكي' : 'Mechanical') : (isAr ? 'حوادث' : 'Accident')}
              </button>
            ))}
          </div>
        </div>

        {/* Workshop */}
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            {isAr ? 'الورشة' : 'Workshop'}
          </label>
          <SearchableSelect
            options={workshopOptions}
            value={workshopId}
            onChange={(v) => setWorkshopId(v)}
            placeholder={isAr ? 'اختر الورشة' : 'Choose a workshop'}
            searchPlaceholder={isAr ? 'ابحث بالاسم أو المدينة...' : 'Search by name/city...'}
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Date + odometer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
              {isAr ? 'تاريخ الاستلام *' : 'Received at *'}
            </label>
            <input
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
              {isAr ? 'عداد الدخول (كم)' : 'Entry odometer (km)'}
            </label>
            <input
              type="number"
              min={0}
              value={entryOdo}
              onChange={(e) => setEntryOdo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Complaint */}
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            {isAr ? 'الشكوى / الوصف' : 'Complaint / description'}
          </label>
          <textarea
            rows={3}
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Internal notes */}
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            {isAr ? 'ملاحظات داخلية' : 'Internal notes'}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2">
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
      </form>
    </div>
  )
}
