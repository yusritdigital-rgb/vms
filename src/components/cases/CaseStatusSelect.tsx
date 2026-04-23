'use client'

// =====================================================
// CaseStatusSelect — controlled dropdown of all case statuses.
// Used inline in the Daily Update card and in the detail page.
// =====================================================

import { CASE_STATUSES } from '@/lib/cases/statuses'

interface Props {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}

export default function CaseStatusSelect({ value, onChange, disabled, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={
        className ??
        'text-sm px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white w-full disabled:opacity-50'
      }
    >
      {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
