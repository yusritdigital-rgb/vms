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
import { Loader2, Save, CalendarClock } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { applyCaseUpdate } from '@/lib/cases/queries'
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
}

export default function CaseUpdateForm({ caseId, currentStatus, isAr, onSaved, compact }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [note, setNote]     = useState('')
  const [expectedDate, setExpectedDate] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const requiresDate = STATUSES_REQUIRING_EXPECTED_DATE.has(status)

  // Drop a stale date when the operator switches off the in-progress
  // statuses, so we never accidentally PATCH job_cards with an old value.
  useEffect(() => {
    if (!requiresDate && expectedDate) setExpectedDate('')
  }, [requiresDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = status !== currentStatus || note.trim() !== '' || (requiresDate && !!expectedDate)

  const save = async () => {
    if (!changed) return
    if (requiresDate && !expectedDate) {
      toast.error(isAr ? 'حدد تاريخ متوقع للانتهاء' : 'Pick the expected completion date')
      return
    }
    setSaving(true)
    const res = await applyCaseUpdate({
      caseId,
      newStatus:              status,
      currentStatus,
      note:                   note.trim() || null,
      expectedCompletionDate: requiresDate ? expectedDate : undefined,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error || (isAr ? 'فشل الحفظ' : 'Save failed'))
      return
    }
    toast.success(isAr ? 'تم حفظ التحديث' : 'Update saved')
    setNote('')
    setExpectedDate('')
    onSaved?.()
  }

  return (
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
          disabled={!changed || saving || (requiresDate && !expectedDate)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isAr ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  )
}
