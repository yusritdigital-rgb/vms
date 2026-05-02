'use client'

// =====================================================
// CaseUpdateForm — status + note + (conditional expected date) + save.
// Shared between the Daily Update card and the detail page.
//
// The expected-completion date is only requested when the operator
// flips the status to one of the in-progress states. It's saved as a
// snapshot on the case_updates row (history) AND on job_cards
// (current state) — see applyCaseUpdate / migration 023.
// =====================================================

import { useEffect, useState } from 'react'
import { Loader2, Save, CalendarClock, Gauge, Check, Printer } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { applyCaseUpdate, recordReplacementReturn } from '@/lib/cases/queries'
import { generateReceivingHandoverPDF } from '@/lib/pdf/receivingHandover'
import { isClosedStatus } from '@/lib/cases/types'
import CaseStatusSelect from './CaseStatusSelect'

/** Statuses that REQUIRE an expected-completion date to be set on the
 *  case before the update is allowed to save. Per spec — these are the
 *  active "in-progress" states where a target finish date is meaningful.
 *  Keep in sync with the canonical list in `@/lib/cases/statuses`. */
const STATUSES_REQUIRING_EXPECTED_DATE: ReadonlySet<string> = new Set([
  'تحت الاصلاح الميكانيكي',
  'تحت اصلاح الهيكل',
  'تحت الدهان',
])

interface Props {
  caseId: string
  currentStatus: string
  isAr: boolean
  /** Called after a successful save; parent may also rely on Realtime. */
  onSaved?: () => void
  /** Compact layout for Daily-Update cards (2-line). Default: false. */
  compact?: boolean
  /** Case data to check for replacement vehicle */
  caseData?: {
    replacement_vehicle_id: string | null
    replacement_return_odometer: number | null
  }
  /** Vehicle data for handover form generation */
  vehicleData?: {
    mainVehicle: {
      plate_number: string | null
      make_model: string | null
      exit_odometer: number | null
    }
    replacementVehicle?: {
      plate_number: string | null
      make_model: string | null
      return_odometer: number | null
    }
  }
  caseNumber?: string | null
  workshopName?: string | null
  receivedAt?: string | null
}

export default function CaseUpdateForm({ caseId, currentStatus, isAr, onSaved, compact, caseData, vehicleData, caseNumber, workshopName, receivedAt }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [note, setNote]     = useState('')
  const [expectedDate, setExpectedDate] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Replacement return state
  const [returnOdometer, setReturnOdometer] = useState<string>('')
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(); d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16) // yyyy-MM-ddTHH:mm (local)
  })
  const [returnNotes, setReturnNotes] = useState('')
  const [savingReturn, setSavingReturn] = useState(false)

  // Main vehicle exit odometer state
  const [exitOdometer, setExitOdometer] = useState<string>('')

  const requiresDate = STATUSES_REQUIRING_EXPECTED_DATE.has(status)
  const hasReplacement = caseData?.replacement_vehicle_id != null
  const returnAlreadyRecorded = caseData?.replacement_return_odometer != null

  // Drop a stale date when the operator switches off the in-progress
  // statuses, so we never accidentally PATCH job_cards with an old value.
  useEffect(() => {
    if (!requiresDate && expectedDate) setExpectedDate('')
  }, [requiresDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = status !== currentStatus || note.trim() !== '' || (requiresDate && !!expectedDate)

  const saveReplacementReturn = async () => {
    if (!returnOdometer || Number.isNaN(Number(returnOdometer))) {
      toast.error(isAr ? 'أدخل عداد العودة' : 'Enter return odometer')
      return
    }
    setSavingReturn(true)
    const res = await recordReplacementReturn({
      caseId,
      returnOdometer: Number(returnOdometer),
      returnDate: new Date(returnDate).toISOString(),
      returnNotes: returnNotes.trim() || null,
    })
    setSavingReturn(false)
    if (!res.ok) {
      toast.error(res.error || (isAr ? 'فشل تسجيل العودة' : 'Return recording failed'))
      return
    }
    toast.success(isAr ? 'تم تسجيل عودة المركبة البديلة' : 'Replacement return recorded')
    setReturnOdometer('')
    setReturnNotes('')
    onSaved?.()
  }

  const save = async () => {
    if (!changed) return
    if (requiresDate && !expectedDate) {
      toast.error(isAr ? 'حدد تاريخ متوقع للانتهاء' : 'Pick the expected completion date')
      return
    }
    
    // Require exit odometer when closing the case
    if (isClosedStatus(status) && !isClosedStatus(currentStatus) && !exitOdometer) {
      toast.error(isAr ? 'أدخل عداد خروج المركبة الأساسية' : 'Enter main vehicle exit odometer')
      return
    }
    
    setSaving(true)
    const res = await applyCaseUpdate({
      caseId,
      newStatus:              status,
      currentStatus,
      note:                   note.trim() || null,
      expectedCompletionDate: requiresDate ? expectedDate : undefined,
      exitOdometer:           isClosedStatus(status) && !isClosedStatus(currentStatus) ? Number(exitOdometer) : undefined,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error || (isAr ? 'فشل الحفظ' : 'Save failed'))
      return
    }
    toast.success(isAr ? 'تم حفظ التحديث' : 'Update saved')
    setNote('')
    setExpectedDate('')
    setExitOdometer('')
    
    // Generate handover form on case closure
    if (isClosedStatus(status) && !isClosedStatus(currentStatus) && vehicleData) {
      const handoverVehicles = [
        {
          plateNumber: vehicleData.mainVehicle.plate_number,
          vehicleLabel: isAr ? 'المركبة الأساسية' : 'Main Vehicle',
          movementType: 'خروج' as const,
          odometer: Number(exitOdometer),
          vehicleMakeModel: vehicleData.mainVehicle.make_model,
        },
        ...(vehicleData.replacementVehicle ? [{
          plateNumber: vehicleData.replacementVehicle.plate_number,
          vehicleLabel: isAr ? 'المركبة البديلة' : 'Replacement Vehicle',
          movementType: 'دخول' as const,
          odometer: vehicleData.replacementVehicle.return_odometer,
          vehicleMakeModel: vehicleData.replacementVehicle.make_model,
        }] : []),
      ]

      // No PDF generation on closing - form is printed once at case opening
    }
    
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-col sm:flex-row gap-3'} items-stretch`}>
        <div className={compact ? 'w-full' : 'flex-1'}>
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
            {isAr ? 'الحالة' : 'Status'}
          </label>
          <CaseStatusSelect value={status} onChange={setStatus} disabled={saving} />
        </div>

        {/* Expected completion — only when the chosen status is one of the
            in-progress states. Required in that case. */}
        {requiresDate && (
          <div className={compact ? 'w-full' : 'flex-1'}>
            <label className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1 block">
              <CalendarClock className="w-3 h-3 inline-block -mt-0.5 me-1" />
              {isAr ? 'تاريخ متوقع للانتهاء *' : 'Expected completion *'}
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              disabled={saving}
              required
              className="text-sm px-2.5 py-1.5 border border-red-300 dark:border-red-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
            />
          </div>
        )}

        {/* Exit odometer — required when closing the case */}
        {isClosedStatus(status) && !isClosedStatus(currentStatus) && (
          <div className={compact ? 'w-full' : 'flex-1'}>
            <label className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1 block">
              <Gauge className="w-3 h-3 inline-block -mt-0.5 me-1" />
              {isAr ? 'عداد خروج المركبة الأساسية (كم) *' : 'Main Vehicle Exit Odometer (km) *'}
            </label>
            <input
              type="number"
              min={0}
              value={exitOdometer}
              onChange={(e) => setExitOdometer(e.target.value)}
              disabled={saving}
              required
              className="text-sm px-2.5 py-1.5 border border-red-300 dark:border-red-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
            />
          </div>
        )}

        <div className={compact ? 'w-full' : 'flex-[2]'}>
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
            {isAr ? 'ملاحظة (اختياري)' : 'Note (optional)'}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            placeholder={isAr ? 'أضف ملاحظة...' : 'Add a note...'}
            className="text-sm px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
          />
        </div>
        <div className={compact ? 'w-full' : 'flex items-end'}>
          <button
            type="button"
            onClick={save}
            disabled={!changed || saving || (requiresDate && !expectedDate) || (isClosedStatus(status) && !isClosedStatus(currentStatus) && !exitOdometer)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>

      {/* Replacement return section */}
      {hasReplacement && !returnAlreadyRecorded && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {isAr ? 'استلام المركبة البديلة' : 'Replacement Vehicle Return'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                {isAr ? 'عداد العودة (كم) *' : 'Return Odometer (km) *'}
              </label>
              <input
                type="number"
                min={0}
                value={returnOdometer}
                onChange={(e) => setReturnOdometer(e.target.value)}
                disabled={savingReturn}
                className="text-sm px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                {isAr ? 'تاريخ العودة' : 'Return Date'}
              </label>
              <input
                type="datetime-local"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                disabled={savingReturn}
                className="text-sm px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
              {isAr ? 'ملاحظات العودة (اختياري)' : 'Return Notes (optional)'}
            </label>
            <input
              type="text"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              disabled={savingReturn}
              placeholder={isAr ? 'أضف ملاحظات...' : 'Add notes...'}
              className="text-sm px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50"
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={saveReplacementReturn}
              disabled={savingReturn || !returnOdometer}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isAr ? 'تسجيل العودة' : 'Record Return'}
            </button>
          </div>
        </div>
      )}

      {/* Return already recorded info */}
      {hasReplacement && returnAlreadyRecorded && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {isAr ? 'تم تسجيل عودة المركبة البديلة' : 'Replacement Return Recorded'}
            </span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {isAr ? `عداد العودة: ${caseData?.replacement_return_odometer?.toLocaleString('en-US')} كم` : `Return Odometer: ${caseData?.replacement_return_odometer?.toLocaleString('en-US')} km`}
          </p>
          {/* Handover form button - only available after main vehicle exit odometer is recorded */}
          {vehicleData?.mainVehicle.exit_odometer != null && (
            <button
              type="button"
              onClick={() => {
                if (!vehicleData) return
                const handoverVehicles: any[] = [
                  {
                    plateNumber: vehicleData.mainVehicle.plate_number ?? null,
                    vehicleLabel: isAr ? 'المركبة الأساسية' : 'Main Vehicle',
                    movementType: 'خروج' as const, // Main vehicle is exiting
                    odometer: vehicleData.mainVehicle.exit_odometer,
                    vehicleMakeModel: vehicleData.mainVehicle.make_model,
                  },
                ]
                if (vehicleData.replacementVehicle?.plate_number) {
                  handoverVehicles.push({
                    plateNumber: vehicleData.replacementVehicle.plate_number,
                    vehicleLabel: isAr ? 'المركبة البديلة' : 'Replacement Vehicle',
                    movementType: 'دخول' as const, // Replacement vehicle is entering
                    odometer: caseData?.replacement_return_odometer,
                    vehicleMakeModel: vehicleData.replacementVehicle.make_model,
                  })
                }
                generateReceivingHandoverPDF({
                  caseNumber: caseNumber || null,
                  caseDate: receivedAt || null,
                  workshop: workshopName || null,
                  vehicles: handoverVehicles,
                })
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Printer className="w-3.5 h-3.5" />
              {isAr ? 'نموذج التسليم' : 'Handover Form'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
