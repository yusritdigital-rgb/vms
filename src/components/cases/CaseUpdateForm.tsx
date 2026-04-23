'use client'

// =====================================================
// CaseUpdateForm — status + note + save.
// Shared between the Daily Update card and the detail page.
// =====================================================

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { applyCaseUpdate } from '@/lib/cases/queries'
import CaseStatusSelect from './CaseStatusSelect'

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
  const [saving, setSaving] = useState(false)

  const changed = status !== currentStatus || note.trim() !== ''

  const save = async () => {
    if (!changed) return
    setSaving(true)
    const res = await applyCaseUpdate({
      caseId, newStatus: status, currentStatus, note: note.trim() || null,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error || (isAr ? 'فشل الحفظ' : 'Save failed'))
      return
    }
    toast.success(isAr ? 'تم حفظ التحديث' : 'Update saved')
    setNote('')
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
          disabled={!changed || saving}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isAr ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  )
}
