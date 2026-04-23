'use client'

// =====================================================
// CaseFilters — pure controlled filter bar.
// Handles project / date range / status / search.
// No internal data fetch.
// =====================================================

import { Briefcase, Clock, Filter, Search, X } from 'lucide-react'
import { CASE_STATUSES } from '@/lib/cases/statuses'
import { isClosedStatus } from '@/lib/cases/types'

export type DateRangeKey = 'all' | 'today' | '7d' | '30d'

export interface CaseFiltersValue {
  project: 'all' | string
  date:    DateRangeKey
  status:  'all' | string
  search:  string
}

export const EMPTY_FILTERS: CaseFiltersValue = {
  project: 'all',
  date:    'all',
  status:  'all',
  search:  '',
}

interface Props {
  value: CaseFiltersValue
  onChange: (next: CaseFiltersValue) => void
  projectOptions: string[]
  isAr: boolean
  /** When true, the status dropdown only lists open statuses. */
  openOnly?: boolean
}

export default function CaseFilters({ value, onChange, projectOptions, isAr, openOnly = true }: Props) {
  const set = <K extends keyof CaseFiltersValue>(k: K, v: CaseFiltersValue[K]) =>
    onChange({ ...value, [k]: v })

  const statusOptions = openOnly
    ? CASE_STATUSES.filter(s => !isClosedStatus(s))
    : CASE_STATUSES

  const active =
    value.project !== 'all' ||
    value.date    !== 'all' ||
    value.status  !== 'all' ||
    value.search.trim() !== ''

  return (
    <div className="flex flex-wrap items-end gap-3" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Project */}
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          {isAr ? 'المشروع' : 'Project'}
        </span>
        <select
          value={value.project}
          onChange={(e) => set('project', e.target.value)}
          className="text-sm px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white min-w-[160px]"
        >
          <option value="all">{isAr ? 'كل المشاريع' : 'All projects'}</option>
          {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {isAr ? 'الفترة' : 'Period'}
        </span>
        <div className="flex items-center gap-1">
          {([
            ['all',   isAr ? 'الكل'   : 'All'],
            ['today', isAr ? 'اليوم'  : 'Today'],
            ['7d',    isAr ? '7 أيام' : '7 days'],
            ['30d',   isAr ? '30 يوم' : '30 days'],
          ] as Array<[DateRangeKey, string]>).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set('date', k)}
              className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                value.date === k
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-red-300'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          {isAr ? 'الحالة' : 'Status'}
        </span>
        <select
          value={value.status}
          onChange={(e) => set('status', e.target.value)}
          className="text-sm px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white min-w-[200px]"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Search */}
      <div className="flex flex-col flex-1 min-w-[200px]">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
          <Search className="w-3 h-3" />
          {isAr ? 'بحث' : 'Search'}
        </span>
        <input
          type="text"
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder={isAr ? 'رقم الحالة / اللوحة' : 'Case # / plate'}
          className="text-sm px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
        />
      </div>

      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
          {isAr ? 'مسح التصفية' : 'Clear filters'}
        </button>
      )}
    </div>
  )
}

/** Apply CaseFiltersValue to a list of cases. Pure, memo-friendly. */
export function applyCaseFilters<T extends {
  status: string
  received_at: string
  job_card_number: string
  vehicle: { plate_number: string | null; project_code: string | null } | null
}>(list: T[], f: CaseFiltersValue): T[] {
  if (
    f.project === 'all' &&
    f.date    === 'all' &&
    f.status  === 'all' &&
    f.search.trim() === ''
  ) return list

  const msDay = 24 * 60 * 60 * 1000
  const now   = Date.now()
  const needle = f.search.trim().toLowerCase()

  return list.filter(c => {
    if (f.project !== 'all' && (c.vehicle?.project_code || '') !== f.project) return false
    if (f.status  !== 'all' && c.status !== f.status)                           return false
    if (f.date !== 'all') {
      const t = new Date(c.received_at).getTime()
      if (Number.isFinite(t)) {
        if (f.date === 'today' && now - t > msDay)        return false
        if (f.date === '7d'    && now - t > 7 * msDay)   return false
        if (f.date === '30d'   && now - t > 30 * msDay)  return false
      }
    }
    if (needle) {
      const hay = `${c.job_card_number} ${c.vehicle?.plate_number ?? ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}
