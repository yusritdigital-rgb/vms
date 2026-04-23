'use client'

// =====================================================
// /history — سجل الحالات (Case History)
// -----------------------------------------------------
// Closed cases only. Clicking a row expands the full timeline
// powered by `case_updates`. No open cases ever appear here.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown, ChevronUp, ClipboardList, ExternalLink, History as HistoryIcon,
  Loader2, Search, Car, Wrench,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { listClosedCases } from '@/lib/cases/queries'
import { STATUS_COLOR } from '@/lib/cases/statuses'
import { fmtDate } from '@/lib/cases/formatCase'
import type { CaseRow } from '@/lib/cases/types'
import CaseTimeline from '@/components/cases/CaseTimeline'

export default function CaseHistoryPage() {
  const { language } = useTranslation()
  const isAr = language === 'ar'

  const [rows, setRows] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const data = await listClosedCases()
      if (!mounted) return
      setRows(data); setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => {
      const hay = [
        r.job_card_number,
        r.vehicle?.plate_number,
        r.vehicle?.brand,
        r.vehicle?.model,
        r.workshop_name,
        r.status,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, q])

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <HistoryIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isAr ? 'سجل الحالات' : 'Case History'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isAr ? 'الحالات المغلقة مع سجل التحديثات الكامل' : 'Closed cases with full update timeline'}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium text-xs">
          {isAr ? 'مغلقة' : 'Closed'}: <strong>{rows.length.toLocaleString('en-US')}</strong>
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'بحث (رقم الحالة، اللوحة، الورشة...)' : 'Search (case #, plate, workshop...)'}
          className="w-full ps-10 pe-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {isAr ? 'لا توجد حالات مغلقة بعد' : 'No closed cases yet'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(r => {
            const isOpen = expanded === r.id
            const endDate = r.completed_at || r.delivered_at
            const badge = STATUS_COLOR[r.status as keyof typeof STATUS_COLOR]
              || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            return (
              <li
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-start"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-red-600">
                      {r.job_card_number}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-200">
                      <Car className="w-3.5 h-3.5 text-gray-400" />
                      {r.vehicle?.plate_number || '—'}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {[r.vehicle?.brand, r.vehicle?.model].filter(Boolean).join(' ')}
                    </span>
                    {r.workshop_name && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                        <Wrench className="w-3 h-3" />
                        {r.workshop_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <div className="hidden md:flex flex-col items-end text-[11px] text-gray-400">
                      <span>{isAr ? 'من' : 'Start'}: {fmtDate(r.received_at)}</span>
                      <span>{isAr ? 'إلى' : 'End'}: {fmtDate(endDate)}</span>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge}`}>
                      {r.status}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-slate-800 p-4 bg-gray-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span>{isAr ? 'تاريخ البدء' : 'Start'}: <strong className="text-gray-700 dark:text-gray-300">{fmtDate(r.received_at)}</strong></span>
                        <span>{isAr ? 'تاريخ الإغلاق' : 'End'}: <strong className="text-gray-700 dark:text-gray-300">{fmtDate(endDate)}</strong></span>
                        <span>{isAr ? 'النوع' : 'Type'}: <strong className="text-gray-700 dark:text-gray-300">{r.type}</strong></span>
                      </div>
                      <Link
                        href={`/job-cards/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {isAr ? 'فتح الحالة' : 'Open case'}
                      </Link>
                    </div>
                    <CaseTimeline caseId={r.id} language={isAr ? 'ar' : 'en'} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
