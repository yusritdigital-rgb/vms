'use client'

// =====================================================
// AssignReplacementCard — late-assign a replacement vehicle.
// -----------------------------------------------------
// Rendered inside the case-detail Replacement-vehicle InfoBlock when
// (a) the case is OPEN and (b) no replacement is currently linked.
// The workshop officer picks an available RV alternative, types the
// handover odometer, and saves. The DB-side enforcement is identical
// to the Create Case flow (monotonic odometer trigger, plus the new
// `assignReplacementVehicle` helper that refuses on closed cases).
//
// Closed cases never render this card — the Replacement-vehicle block
// stays read-only as historical data per spec.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Gauge, Loader2, Plus } from 'lucide-react'

import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect'
import { toast } from '@/components/ui/Toast'
import {
  assignReplacementVehicle,
  listAvailableRvVehicles,
} from '@/lib/cases/queries'

interface RvOption {
  id: string
  plate_number: string | null
  plate_number_ar: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  project_code: string | null
  current_odometer: number | null
}

interface Props {
  caseId: string
  /** Main-vehicle id, excluded from the picker. */
  mainVehicleId: string | null
  isAr: boolean
  onAssigned: () => void | Promise<void>
}

export default function AssignReplacementCard({
  caseId, mainVehicleId, isAr, onAssigned,
}: Props) {
  const [open, setOpen]               = useState(false)
  const [pool, setPool]               = useState<RvOption[]>([])
  const [loadingPool, setLoadingPool] = useState(false)
  const [vehicleId, setVehicleId]     = useState('')
  const [odo, setOdo]                 = useState<string>('')
  const [saving, setSaving]           = useState(false)

  // Lazily load the RV pool only when the user opens the form, so the
  // case-detail page stays cheap on first paint.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingPool(true)
    listAvailableRvVehicles({ excludeVehicleId: mainVehicleId })
      .then(rows => { if (!cancelled) setPool(rows) })
      .finally(() => { if (!cancelled) setLoadingPool(false) })
    return () => { cancelled = true }
  }, [open, mainVehicleId])

  const selected = useMemo(
    () => pool.find(v => v.id === vehicleId) ?? null,
    [pool, vehicleId]
  )
  const lastKnown = selected?.current_odometer ?? null

  // Prefill odometer from the cached current_odometer when a vehicle is
  // picked (only if the user hasn't typed yet). DB trigger remains the
  // final guard.
  useEffect(() => {
    if (!selected) return
    if (odo !== '') return
    if (selected.current_odometer != null) {
      setOdo(String(selected.current_odometer))
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const options: SearchableOption[] = useMemo(
    () => pool.map(v => ({
      value: v.id,
      label: v.plate_number || v.plate_number_ar || '—',
      sublabel: [v.brand || v.manufacturer, v.model].filter(Boolean).join(' ').trim()
        || (v.project_code ?? ''),
      searchText: [
        v.plate_number, v.plate_number_ar,
        v.brand, v.manufacturer, v.model, v.project_code,
      ].filter(Boolean).join(' '),
    })),
    [pool]
  )

  const validation: string | null = useMemo(() => {
    if (!vehicleId) return isAr ? 'اختر المركبة البديلة' : 'Pick a replacement vehicle'
    if (odo === '' || Number.isNaN(Number(odo))) {
      return isAr ? 'أدخل عداد المركبة البديلة' : 'Enter the replacement odometer'
    }
    if (Number(odo) < 0) {
      return isAr ? 'العداد غير صالح' : 'Odometer must be ≥ 0'
    }
    if (lastKnown != null && Number(odo) < lastKnown) {
      return isAr
        ? `العداد أقل من آخر قراءة معروفة (${lastKnown.toLocaleString('en-US')} كم)`
        : `Odometer is below last known reading (${lastKnown.toLocaleString('en-US')} km)`
    }
    return null
  }, [vehicleId, odo, lastKnown, isAr])

  const handleSave = async () => {
    if (validation) { toast.error(validation); return }
    setSaving(true)
    const res = await assignReplacementVehicle({
      caseId,
      replacementVehicleId: vehicleId,
      replacementOdometer:  Number(odo),
    })
    setSaving(false)
    if (!res.ok) {
      const msg =
        res.error === 'case_closed'
          ? (isAr ? 'لا يمكن التعديل، الحالة مغلقة' : 'Case is closed; assignment not allowed')
        : res.error === 'replacement_already_assigned'
          ? (isAr ? 'يوجد بديلة مرتبطة بالفعل' : 'A replacement is already assigned')
        : res.error === 'replacement_same_as_main_vehicle'
          ? (isAr ? 'لا يمكن اختيار المركبة الأساسية كبديلة' : 'Cannot use the main vehicle as its own replacement')
        : (res.error || (isAr ? 'فشل التخصيص' : 'Assignment failed'))
      toast.error(msg)
      return
    }
    toast.success(isAr ? 'تم تخصيص المركبة البديلة' : 'Replacement vehicle assigned')
    // Reset + collapse, then notify parent so it can reload the case row.
    setOpen(false)
    setVehicleId('')
    setOdo('')
    void onAssigned()
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          {isAr ? 'لا توجد مركبة بديلة مرتبطة' : 'No replacement linked'}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          <Plus className="w-3.5 h-3.5" />
          {isAr ? 'تخصيص بديلة' : 'Assign replacement'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
          <Briefcase className="w-3 h-3 inline-block -mt-0.5 me-1" />
          {isAr ? 'المركبة البديلة (RV)' : 'Replacement vehicle (RV)'}
        </label>
        {loadingPool ? (
          <div className="flex items-center gap-2 py-1 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {isAr ? 'جاري تحميل البدائل...' : 'Loading alternatives...'}
          </div>
        ) : options.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {isAr ? 'لا توجد مركبات بديلة متاحة حالياً.' : 'No replacement vehicles available right now.'}
          </p>
        ) : (
          <SearchableSelect
            options={options}
            value={vehicleId}
            onChange={(v) => setVehicleId(v)}
            placeholder={isAr ? 'اختر مركبة بديلة' : 'Choose a replacement'}
            searchPlaceholder={isAr ? 'ابحث برقم اللوحة...' : 'Search by plate...'}
            dir={isAr ? 'rtl' : 'ltr'}
          />
        )}
      </div>

      {vehicleId && (
        <div>
          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            <Gauge className="w-3 h-3 inline-block -mt-0.5 me-1" />
            {isAr ? 'عداد البديلة عند التسليم (كم) *' : 'Replacement odometer at handover (km) *'}
          </label>
          <input
            type="number"
            min={0}
            value={odo}
            onChange={(e) => setOdo(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
          />
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {lastKnown != null
              ? (isAr
                  ? `آخر قراءة معروفة: ${lastKnown.toLocaleString('en-US')} كم`
                  : `Last known: ${lastKnown.toLocaleString('en-US')} km`)
              : (isAr ? 'لا توجد قراءة سابقة' : 'No previous reading')}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !!validation || options.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isAr ? 'حفظ التخصيص' : 'Assign'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setVehicleId(''); setOdo('') }}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
