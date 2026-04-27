'use client'

// =====================================================
// /job-cards — Cases workspace (الحالات)
// -----------------------------------------------------
// Single source of truth for the whole page: `useCasesStream`.
// It keeps a live list of every case (open + closed); the page
// slices that list into open / archive views and applies the
// user's filters in memory.
//
// Layout:
//   ┌ Header: title + Create button + filters ──────┐
//   │                                                │
//   │  ▌ Daily Update (primary, full-width)         │
//   │    - only open cases                          │
//   │    - project / date / status / search         │
//   │    - each card has an inline update form      │
//   │                                                │
//   │  ▸ All cases (archive, secondary)             │
//   │    - full paginated list, open by default     │
//   └────────────────────────────────────────────────┘
// =====================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Archive, ChevronDown, ChevronUp, Loader2, Plus, RefreshCw,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { useCasesStream } from '@/lib/cases/useCasesStream'
import { isClosedStatus } from '@/lib/cases/types'
import { STATUS_COLOR, isCaseClosed } from '@/lib/cases/statuses'
import { daysSince, expectedDueLabel, fmtDate, relativeTime } from '@/lib/cases/formatCase'

import CaseCard from '@/components/cases/CaseCard'
import CaseFilters, {
  EMPTY_FILTERS, applyCaseFilters, type CaseFiltersValue,
} from '@/components/cases/CaseFilters'

export default function CasesPage() {
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('new')

  const { cases, loading, refresh } = useCasesStream()
  const [filters, setFilters] = useState<CaseFiltersValue>(EMPTY_FILTERS)
  const [archiveOpen, setArchiveOpen] = useState(true) // user chose "expanded by default"
  const [refreshing, setRefreshing] = useState(false)

  // ─── Open / archive split ──────────────────────────
  const { openCases, archiveCases } = useMemo(() => {
    const open: typeof cases = []
    const arc:  typeof cases = []
    for (const c of cases) (isClosedStatus(c.status) ? arc : open).push(c)
    return { openCases: open, archiveCases: arc }
  }, [cases])

  // Project options derived from the actual open cases in play.
  const projectOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of openCases) {
      const p = (c.vehicle?.project_code || '').trim()
      if (p) set.add(p)
    }
    return Array.from(set).sort()
  }, [openCases])

  const filteredOpen    = useMemo(() => applyCaseFilters(openCases, filters), [openCases, filters])
  const filteredArchive = useMemo(() => applyCaseFilters(cases,     filters), [cases,     filters])

  // Auto-scroll to the freshly-created card when arriving with ?new=<id>.
  const didScroll = useRef(false)
  useEffect(() => {
    if (!highlightId || didScroll.current || loading) return
    const el = document.getElementById(`case-${highlightId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      didScroll.current = true
    }
  }, [highlightId, loading, cases.length])

  const onRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setTimeout(() => setRefreshing(false), 400)
  }

  return (
    <div
      className="space-y-5 mx-auto w-full lg:w-[85%] xl:w-[80%]"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'الحالات' : 'Cases'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAr
              ? `${openCases.length} مفتوحة · ${archiveCases.length} مغلقة`
              : `${openCases.length} open · ${archiveCases.length} closed`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <Link
            href="/job-cards/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'إنشاء حالة' : 'Create Case'}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4">
        <CaseFilters
          value={filters}
          onChange={setFilters}
          projectOptions={projectOptions}
          isAr={isAr}
          openOnly
        />
      </div>

      {/* ── PRIMARY: Daily Update ── */}
      <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <header className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-l from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 flex items-center gap-3">
          <div className="p-2.5 bg-red-600 text-white rounded-xl font-bold text-xs">
            {isAr ? 'يومي' : 'Daily'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
              {isAr ? 'التحديث اليومي' : 'Daily Update'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAr
                ? `${filteredOpen.length} / ${openCases.length} حالة`
                : `${filteredOpen.length} / ${openCases.length} cases`}
            </p>
          </div>
          <span className="inline-flex items-center justify-center min-w-[2.5rem] h-9 px-3 rounded-full bg-red-600 text-white font-bold text-sm">
            {filteredOpen.length}
          </span>
        </header>

        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin inline-block" />
          </div>
        ) : filteredOpen.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {openCases.length === 0
              ? (isAr ? 'لا توجد حالات مفتوحة' : 'No open cases')
              : (isAr ? 'لا توجد حالات تطابق التصفية' : 'No cases match the current filters')}
          </div>
        ) : (
          <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4">
            {filteredOpen.map(c => (
              <li key={c.id}>
                <CaseCard
                  c={c}
                  isAr={isAr}
                  highlight={highlightId === c.id}
                  onSaved={() => void refresh()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── SECONDARY: archive ── */}
      <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setArchiveOpen(o => !o)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-gray-500" />
            <div className="text-start">
              <div className="font-semibold text-gray-900 dark:text-white">
                {isAr ? 'كل الحالات (أرشيف)' : 'All cases (archive)'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isAr
                  ? `${filteredArchive.length} / ${cases.length} حالة (شاملة المغلقة)`
                  : `${filteredArchive.length} / ${cases.length} cases (incl. closed)`}
              </div>
            </div>
          </div>
          {archiveOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {archiveOpen && (
          <div className="border-t border-gray-100 dark:border-slate-800 p-5 space-y-2">
            {loading ? (
              <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline-block text-red-600" /></div>
            ) : filteredArchive.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {isAr ? 'لا توجد حالات' : 'No cases'}
              </div>
            ) : (
              <ArchiveTable rows={filteredArchive} isAr={isAr} highlightId={highlightId} onOpen={(id) => router.push(`/job-cards/${id}`)} />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Archive row — compact line per case.
// ─────────────────────────────────────────────────────
function ArchiveTable({ rows, isAr, highlightId, onOpen }: {
  rows: Array<{
    id: string; job_card_number: string; status: string;
    received_at: string;
    expected_completion_date?: string | null;
    completed_at: string | null; last_updated_at: string | null;
    vehicle: { plate_number: string | null; project_code: string | null; brand: string | null; model: string | null } | null
  }>
  isAr: boolean
  highlightId: string | null
  onOpen: (id: string) => void
}) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
      {rows.map(r => {
        const badge = STATUS_COLOR[r.status as keyof typeof STATUS_COLOR]
          || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        const isNew = highlightId === r.id
        // Expected-completion is open-only; closed rows skip the inline label.
        const due = !isCaseClosed(r.status)
          ? expectedDueLabel(r.expected_completion_date, isAr)
          : null
        const dueClass =
          due?.tone === 'overdue' ? 'text-red-600 dark:text-red-400 font-semibold'
          : due?.tone === 'near'  ? 'text-orange-600 dark:text-orange-400 font-semibold'
          :                         'text-gray-500 dark:text-gray-400'
        return (
          <li
            key={r.id}
            id={`case-${r.id}`}
            onClick={() => onOpen(r.id)}
            className={`flex flex-wrap items-center gap-3 py-2.5 px-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/40 ${isNew ? 'ring-2 ring-red-400 bg-red-50/40 dark:bg-red-900/10' : ''}`}
          >
            <span className="font-mono text-sm font-bold text-red-600 min-w-[120px]">{r.job_card_number}</span>
            <span className="text-sm text-gray-800 dark:text-gray-200 min-w-[120px]">{r.vehicle?.plate_number ?? '—'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[100px] truncate">
              {r.vehicle?.project_code ?? '—'}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${badge}`}>{r.status}</span>
            <span className="ms-auto flex items-center gap-4 text-[11px] text-gray-400 font-mono">
              <span title={isAr ? 'الاستلام' : 'Received'}>
                {fmtDate(r.received_at)}
                {due && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600 mx-1.5">|</span>
                    <span className={dueClass}>{due.text}</span>
                  </>
                )}
              </span>
              <span title={isAr ? 'في الورشة' : 'In shop'}>{(daysSince(r.received_at) ?? 0)}d</span>
              <span title={isAr ? 'آخر تحديث' : 'Last update'}>{relativeTime(r.last_updated_at, isAr) ?? '—'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
